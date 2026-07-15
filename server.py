Action: file_editor create /app/backend/server.py --file-text "from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / \".env\")

mongo_url = os.environ[\"MONGO_URL\"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ[\"DB_NAME\"]]

JWT_SECRET = os.environ.get(\"JWT_SECRET\", \"7xgaming-super-secret-key-change-in-prod\")
JWT_ALGO = \"HS256\"
JWT_EXPIRY_HOURS = 24 * 30  # 30 days

app = FastAPI(title=\"7X GAMING API\")
api_router = APIRouter(prefix=\"/api\")
security = HTTPBearer(auto_error=False)

# ---------- Utilities ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(\"utf-8\"), bcrypt.gensalt()).decode(\"utf-8\")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(\"utf-8\"), hashed.encode(\"utf-8\"))
    except Exception:
        return False

def create_token(user_id: str) -> str:
    payload = {
        \"sub\": user_id,
        \"exp\": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        \"iat\": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload.get(\"sub\")
    except Exception:
        return None

async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds:
        raise HTTPException(status_code=401, detail=\"Not authenticated\")
    user_id = decode_token(creds.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail=\"Invalid token\")
    user = await db.users.find_one({\"id\": user_id}, {\"_id\": 0, \"password_hash\": 0})
    if not user:
        raise HTTPException(status_code=401, detail=\"User not found\")
    return user

async def get_admin_user(user=Depends(get_current_user)):
    if not user.get(\"is_admin\"):
        raise HTTPException(status_code=403, detail=\"Admin access required\")
    return user

# ---------- Models ----------
class SignupIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TournamentIn(BaseModel):
    title: str
    match_time: str  # ISO datetime
    map_name: Optional[str] = \"Erangel\"
    entry_fee: int = 20
    slots: int = 100
    prize_per_kill: int = 5
    prize_chicken: int = 500
    upi_id: str
    room_id: Optional[str] = \"\"
    room_password: Optional[str] = \"\"
    status: str = \"upcoming\"  # upcoming | live | completed

class TournamentUpdate(BaseModel):
    title: Optional[str] = None
    match_time: Optional[str] = None
    map_name: Optional[str] = None
    room_id: Optional[str] = None
    room_password: Optional[str] = None
    status: Optional[str] = None

class RegisterIn(BaseModel):
    tournament_id: str
    ign: str  # in-game name
    bgmi_id: str
    utr: str

class VerifyPaymentIn(BaseModel):
    registration_id: str
    verify: bool  # true=verified, false=rejected

class UpdateStatsIn(BaseModel):
    registration_id: str
    kills: int = 0
    chicken_dinner: bool = False

# ---------- Auth Routes ----------
@api_router.post(\"/auth/signup\")
async def signup(data: SignupIn):
    existing = await db.users.find_one({\"$or\": [{\"email\": data.email}, {\"phone\": data.phone}]})
    if existing:
        raise HTTPException(status_code=400, detail=\"Email or phone already registered\")
    user = {
        \"id\": str(uuid.uuid4()),
        \"name\": data.name,
        \"email\": data.email,
        \"phone\": data.phone,
        \"password_hash\": hash_password(data.password),
        \"is_admin\": False,
        \"wallet_balance\": 0,
        \"created_at\": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_token(user[\"id\"])
    user_out = {k: v for k, v in user.items() if k not in (\"_id\", \"password_hash\")}
    return {\"token\": token, \"user\": user_out}

@api_router.post(\"/auth/login\")
async def login(data: LoginIn):
    user = await db.users.find_one({\"email\": data.email})
    if not user or not verify_password(data.password, user.get(\"password_hash\", \"\")):
        raise HTTPException(status_code=401, detail=\"Invalid email or password\")
    token = create_token(user[\"id\"])
    user_out = {k: v for k, v in user.items() if k not in (\"_id\", \"password_hash\")}
    return {\"token\": token, \"user\": user_out}

@api_router.get(\"/auth/me\")
async def me(user=Depends(get_current_user)):
    return user

# ---------- Tournament Routes ----------
@api_router.get(\"/tournaments\")
async def list_tournaments():
    tournaments = await db.tournaments.find({}, {\"_id\": 0, \"room_id\": 0, \"room_password\": 0}).sort(\"match_time\", 1).to_list(200)
    # attach registration count
    for t in tournaments:
        t[\"registered_count\"] = await db.registrations.count_documents({\"tournament_id\": t[\"id\"]})
    return tournaments

@api_router.get(\"/tournaments/{tid}\")
async def get_tournament(tid: str):
    t = await db.tournaments.find_one({\"id\": tid}, {\"_id\": 0, \"room_id\": 0, \"room_password\": 0})
    if not t:
        raise HTTPException(status_code=404, detail=\"Tournament not found\")
    t[\"registered_count\"] = await db.registrations.count_documents({\"tournament_id\": tid})
    return t

@api_router.post(\"/tournaments\")
async def create_tournament(data: TournamentIn, admin=Depends(get_admin_user)):
    t = data.dict()
    t[\"id\"] = str(uuid.uuid4())
    t[\"created_at\"] = now_iso()
    await db.tournaments.insert_one(t)
    t.pop(\"_id\", None)
    return t

@api_router.patch(\"/tournaments/{tid}\")
async def update_tournament(tid: str, data: TournamentUpdate, admin=Depends(get_admin_user)):
    upd = {k: v for k, v in data.dict().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail=\"No fields to update\")
    result = await db.tournaments.update_one({\"id\": tid}, {\"$set\": upd})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=\"Tournament not found\")
    t = await db.tournaments.find_one({\"id\": tid}, {\"_id\": 0})
    return t

@api_router.delete(\"/tournaments/{tid}\")
async def delete_tournament(tid: str, admin=Depends(get_admin_user)):
    await db.tournaments.delete_one({\"id\": tid})
    await db.registrations.delete_many({\"tournament_id\": tid})
    return {\"ok\": True}

# ---------- Registration Routes ----------
@api_router.post(\"/registrations\")
async def create_registration(data: RegisterIn, user=Depends(get_current_user)):
    t = await db.tournaments.find_one({\"id\": data.tournament_id})
    if not t:
        raise HTTPException(status_code=404, detail=\"Tournament not found\")
    existing = await db.registrations.find_one({\"tournament_id\": data.tournament_id, \"user_id\": user[\"id\"]})
    if existing:
        raise HTTPException(status_code=400, detail=\"You have already registered for this tournament\")
    count = await db.registrations.count_documents({\"tournament_id\": data.tournament_id})
    if count >= t.get(\"slots\", 100):
        raise HTTPException(status_code=400, detail=\"Tournament is full\")
    reg = {
        \"id\": str(uuid.uuid4()),
        \"tournament_id\": data.tournament_id,
        \"user_id\": user[\"id\"],
        \"user_name\": user[\"name\"],
        \"user_email\": user[\"email\"],
        \"user_phone\": user[\"phone\"],
        \"ign\": data.ign,
        \"bgmi_id\": data.bgmi_id,
        \"utr\": data.utr,
        \"payment_status\": \"pending\",  # pending | verified | rejected
        \"kills\": 0,
        \"chicken_dinner\": False,
        \"earnings\": 0,
        \"room_sent\": False,
        \"created_at\": now_iso(),
    }
    await db.registrations.insert_one(reg)
    reg.pop(\"_id\", None)
    return reg

@api_router.get(\"/registrations/mine\")
async def my_registrations(user=Depends(get_current_user)):
    regs = await db.registrations.find({\"user_id\": user[\"id\"]}, {\"_id\": 0}).sort(\"created_at\", -1).to_list(200)
    # attach tournament + room details if verified
    for r in regs:
        t = await db.tournaments.find_one({\"id\": r[\"tournament_id\"]}, {\"_id\": 0})
        if t:
            r[\"tournament\"] = {
                \"id\": t[\"id\"],
                \"title\": t.get(\"title\"),
                \"match_time\": t.get(\"match_time\"),
                \"map_name\": t.get(\"map_name\"),
                \"entry_fee\": t.get(\"entry_fee\"),
                \"status\": t.get(\"status\"),
            }
            # only reveal room if payment verified
            if r.get(\"payment_status\") == \"verified\":
                r[\"room_id\"] = t.get(\"room_id\", \"\")
                r[\"room_password\"] = t.get(\"room_password\", \"\")
    return regs

@api_router.get(\"/registrations/tournament/{tid}\")
async def registrations_for_tournament(tid: str, admin=Depends(get_admin_user)):
    regs = await db.registrations.find({\"tournament_id\": tid}, {\"_id\": 0}).sort(\"created_at\", 1).to_list(500)
    return regs

@api_router.post(\"/registrations/verify\")
async def verify_payment(data: VerifyPaymentIn, admin=Depends(get_admin_user)):
    new_status = \"verified\" if data.verify else \"rejected\"
    result = await db.registrations.update_one(
        {\"id\": data.registration_id}, {\"$set\": {\"payment_status\": new_status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=\"Registration not found\")
    return {\"ok\": True, \"status\": new_status}

@api_router.post(\"/registrations/stats\")
async def update_stats(data: UpdateStatsIn, admin=Depends(get_admin_user)):
    reg = await db.registrations.find_one({\"id\": data.registration_id})
    if not reg:
        raise HTTPException(status_code=404, detail=\"Registration not found\")
    t = await db.tournaments.find_one({\"id\": reg[\"tournament_id\"]})
    if not t:
        raise HTTPException(status_code=404, detail=\"Tournament not found\")
    earnings = data.kills * int(t.get(\"prize_per_kill\", 5)) + (int(t.get(\"prize_chicken\", 500)) if data.chicken_dinner else 0)
    await db.registrations.update_one(
        {\"id\": data.registration_id},
        {\"$set\": {\"kills\": data.kills, \"chicken_dinner\": data.chicken_dinner, \"earnings\": earnings}},
    )
    # recompute wallet
    await recompute_wallet(reg[\"user_id\"])
    return {\"ok\": True, \"earnings\": earnings}

async def recompute_wallet(user_id: str):
    pipeline = [
        {\"$match\": {\"user_id\": user_id, \"payment_status\": \"verified\"}},
        {\"$group\": {\"_id\": \"$user_id\", \"total\": {\"$sum\": \"$earnings\"}}},
    ]
    async for doc in db.registrations.aggregate(pipeline):
        await db.users.update_one({\"id\": user_id}, {\"$set\": {\"wallet_balance\": int(doc.get(\"total\", 0))}})
        return
    await db.users.update_one({\"id\": user_id}, {\"$set\": {\"wallet_balance\": 0}})

# ---------- Leaderboard ----------
@api_router.get(\"/leaderboard/{tid}\")
async def leaderboard(tid: str):
    regs = await db.registrations.find(
        {\"tournament_id\": tid, \"payment_status\": \"verified\"},
        {\"_id\": 0, \"utr\": 0, \"user_email\": 0, \"user_phone\": 0, \"bgmi_id\": 0},
    ).to_list(500)
    regs.sort(key=lambda r: (r.get(\"chicken_dinner\", False), r.get(\"kills\", 0)), reverse=True)
    for i, r in enumerate(regs):
        r[\"rank\"] = i + 1
    return regs

# ---------- Wallet ----------
@api_router.get(\"/wallet/mine\")
async def my_wallet(user=Depends(get_current_user)):
    regs = await db.registrations.find(
        {\"user_id\": user[\"id\"], \"payment_status\": \"verified\"},
        {\"_id\": 0}
    ).sort(\"created_at\", -1).to_list(200)
    total = sum(int(r.get(\"earnings\", 0)) for r in regs)
    transactions = []
    for r in regs:
        t = await db.tournaments.find_one({\"id\": r[\"tournament_id\"]}, {\"_id\": 0, \"title\": 1, \"match_time\": 1})
        transactions.append({
            \"tournament_title\": (t or {}).get(\"title\", \"Match\"),
            \"match_time\": (t or {}).get(\"match_time\"),
            \"kills\": r.get(\"kills\", 0),
            \"chicken_dinner\": r.get(\"chicken_dinner\", False),
            \"earnings\": r.get(\"earnings\", 0),
            \"created_at\": r.get(\"created_at\"),
        })
    return {\"balance\": total, \"transactions\": transactions}

# ---------- Admin Utility ----------
@api_router.get(\"/admin/registrations\")
async def all_registrations(admin=Depends(get_admin_user)):
    regs = await db.registrations.find({}, {\"_id\": 0}).sort(\"created_at\", -1).to_list(1000)
    for r in regs:
        t = await db.tournaments.find_one({\"id\": r[\"tournament_id\"]}, {\"_id\": 0, \"title\": 1})
        r[\"tournament_title\"] = (t or {}).get(\"title\", \"-\")
    return regs

@api_router.get(\"/\")
async def root():
    return {\"message\": \"7X GAMING API\"}

# ---------- Startup: seed admin ----------
@app.on_event(\"startup\")
async def seed_admin():
    admin_email = \"admin@7xgaming.com\"
    existing = await db.users.find_one({\"email\": admin_email})
    if not existing:
        await db.users.insert_one({
            \"id\": str(uuid.uuid4()),
            \"name\": \"7X Admin\",
            \"email\": admin_email,
            \"phone\": \"9999999999\",
            \"password_hash\": hash_password(\"admin123\"),
            \"is_admin\": True,
            \"wallet_balance\": 0,
            \"created_at\": now_iso(),
        })
        logger.info(\"Seeded admin user: admin@7xgaming.com / admin123\")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[\"*\"],
    allow_methods=[\"*\"],
    allow_headers=[\"*\"],
)

logging.basicConfig(level=logging.INFO, format=\"%(asctime)s - %(name)s - %(levelname)s - %(message)s\")
logger = logging.getLogger(__name__)

@app.on_event(\"shutdown\")
async def shutdown_db_client():
    client.close()
"
Observation: Overwrite successful: /app/backend/server.py
