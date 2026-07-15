
Action: file_editor create /app/frontend/app/admin.tsx --file-text "import { useCallback, useEffect, useState } from \"react\";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from \"react-native\";
import { SafeAreaView } from \"react-native-safe-area-context\";
import { router } from \"expo-router\";
import { Ionicons } from \"@expo/vector-icons\";
import { apiFetch } from \"@/src/api/client\";
import { useAuth } from \"@/src/context/AuthContext\";
import { theme } from \"@/src/theme\";

type Tournament = {
  id: string;
  title: string;
  match_time: string;
  map_name?: string;
  entry_fee: number;
  slots: number;
  prize_per_kill: number;
  prize_chicken: number;
  upi_id?: string;
  room_id?: string;
  room_password?: string;
  status: string;
};

type AdminReg = {
  id: string;
  tournament_id: string;
  tournament_title: string;
  user_name: string;
  user_email: string;
  user_phone: string;
  ign: string;
  bgmi_id: string;
  utr: string;
  payment_status: string;
  kills: number;
  chicken_dinner: boolean;
  earnings: number;
};

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState<\"tournaments\" | \"regs\">(\"tournaments\");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [regs, setRegs] = useState<AdminReg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ts, rs] = await Promise.all([
        apiFetch<Tournament[]>(\"/tournaments\"),
        apiFetch<AdminReg[]>(\"/admin/registrations\"),
      ]);
      setTournaments(ts);
      setRegs(rs);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.container} edges={[\"top\"]}>
        <View style={styles.center}>
          <Ionicons name=\"lock-closed\" size={48} color={theme.colors.error} />
          <Text style={styles.deniedText}>Admin access only.</Text>
          <Pressable onPress={() => router.back()} style={styles.cta}><Text style={styles.ctaText}>GO BACK</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[\"top\"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID=\"admin-back\">
          <Ionicons name=\"chevron-back\" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>ADMIN PANEL</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabsRow}>
        <TabBtn active={tab === \"tournaments\"} label=\"TOURNAMENTS\" onPress={() => setTab(\"tournaments\")} testID=\"admin-tab-tournaments\" />
        <TabBtn active={tab === \"regs\"} label=\"REGISTRATIONS\" onPress={() => setTab(\"regs\")} testID=\"admin-tab-regs\" />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} /></View>
      ) : tab === \"tournaments\" ? (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: theme.spacing.md }}>
          <Pressable testID=\"show-create-tournament\" onPress={() => setShowCreate((v) => !v)} style={styles.addBtn}>
            <Ionicons name={showCreate ? \"close\" : \"add\"} size={20} color={theme.colors.onBrand} />
            <Text style={styles.addBtnText}>{showCreate ? \"CANCEL\" : \"CREATE TOURNAMENT\"}</Text>
          </Pressable>
          {showCreate && <CreateTournamentForm onCreated={() => { setShowCreate(false); load(); }} />}
          {tournaments.map((t) => <AdminTournamentCard key={t.id} t={t} onChanged={load} />)}
          {tournaments.length === 0 && <Text style={{ color: theme.colors.onSurface3, textAlign: \"center\" }}>No tournaments</Text>}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: theme.spacing.md }}>
          {regs.map((r) => <AdminRegCard key={r.id} r={r} onChanged={load} />)}
          {regs.length === 0 && <Text style={{ color: theme.colors.onSurface3, textAlign: \"center\" }}>No registrations</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TabBtn({ active, label, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      <Text style={[styles.tabBtnText, active && { color: theme.colors.brand }]}>{label}</Text>
    </Pressable>
  );
}

function CreateTournamentForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState(\"\");
  const [when, setWhen] = useState(\"\"); // yyyy-mm-dd HH:MM
  const [upi, setUpi] = useState(\"7xgaming@upi\");
  const [map, setMap] = useState(\"Erangel\");
  const [err, setErr] = useState(\"\");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(\"\");
    if (!title || !when || !upi) return setErr(\"Fill title, time (YYYY-MM-DD HH:MM), UPI ID\");
    // Convert \"YYYY-MM-DD HH:MM\" to ISO
    const iso = new Date(when.replace(\" \", \"T\")).toISOString();
    if (isNaN(new Date(iso).getTime())) return setErr(\"Invalid date. Use YYYY-MM-DD HH:MM\");
    setBusy(true);
    try {
      await apiFetch(\"/tournaments\", {
        method: \"POST\",
        body: { title, match_time: iso, map_name: map, upi_id: upi, entry_fee: 20, slots: 100, prize_per_kill: 5, prize_chicken: 500, status: \"upcoming\" },
      });
      onCreated();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.formCard}>
      <TInput testID=\"new-title\" placeholder=\"Match title (e.g. FRIDAY NIGHT #12)\" value={title} onChangeText={setTitle} />
      <TInput testID=\"new-time\" placeholder=\"Match time (YYYY-MM-DD HH:MM)\" value={when} onChangeText={setWhen} />
      <TInput testID=\"new-map\" placeholder=\"Map (Erangel / Miramar / Sanhok)\" value={map} onChangeText={setMap} />
      <TInput testID=\"new-upi\" placeholder=\"UPI ID (yourname@upi)\" value={upi} onChangeText={setUpi} autoCap=\"none\" />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Pressable testID=\"submit-create-tournament\" onPress={submit} disabled={busy} style={styles.cta}>
        {busy ? <ActivityIndicator color={theme.colors.onBrand} /> : <Text style={styles.ctaText}>CREATE</Text>}
      </Pressable>
    </View>
  );
}

function AdminTournamentCard({ t, onChanged }: { t: Tournament; onChanged: () => void }) {
  const [roomId, setRoomId] = useState(\"\");
  const [roomPass, setRoomPass] = useState(\"\");
  const [status, setStatus] = useState(t.status);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(\"\");

  useEffect(() => {
    (async () => {
      // fetch full incl room details
      try {
        const detail = await apiFetch<Tournament>(`/tournaments/${t.id}`);
        setStatus(detail.status);
      } catch {}
    })();
  }, [t.id]);

  const update = async (patch: any) => {
    setBusy(true); setMsg(\"\");
    try {
      await apiFetch(`/tournaments/${t.id}`, { method: \"PATCH\", body: patch });
      setMsg(\"Updated\");
      onChanged();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const del = async () => {
    setBusy(true);
    try { await apiFetch(`/tournaments/${t.id}`, { method: \"DELETE\" }); onChanged(); }
    catch {} finally { setBusy(false); }
  };

  return (
    <View style={styles.adminCard}>
      <View style={{ flexDirection: \"row\", justifyContent: \"space-between\", alignItems: \"flex-start\" }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.adminTitle}>{t.title}</Text>
          <Text style={styles.adminSub}>{new Date(t.match_time).toLocaleString(\"en-IN\")} • {t.map_name}</Text>
        </View>
        <View style={[styles.statusPill, { borderColor: status === \"live\" ? theme.colors.brandSecondary : status === \"completed\" ? theme.colors.onSurface3 : theme.colors.brand }]}>
          <Text style={{ color: status === \"live\" ? theme.colors.brandSecondary : status === \"completed\" ? theme.colors.onSurface3 : theme.colors.brand, fontSize: 10, fontWeight: \"800\", letterSpacing: 1 }}>
            {status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
        <Text style={styles.label}>ROOM ID</Text>
        <TInput testID={`admin-room-id-${t.id}`} placeholder=\"Enter room id\" value={roomId} onChangeText={setRoomId} />
        <Text style={styles.label}>ROOM PASSWORD</Text>
        <TInput testID={`admin-room-pass-${t.id}`} placeholder=\"Enter password\" value={roomPass} onChangeText={setRoomPass} />
        <Pressable testID={`admin-send-room-${t.id}`} disabled={busy || !roomId || !roomPass}
          onPress={() => update({ room_id: roomId, room_password: roomPass })}
          style={[styles.cta, (!roomId || !roomPass) && styles.ctaDisabled]}>
          <Text style={styles.ctaText}>SEND ROOM DETAILS</Text>
        </Pressable>

        <View style={{ flexDirection: \"row\", gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          <Pressable testID={`admin-mark-live-${t.id}`} onPress={() => update({ status: \"live\" })} style={[styles.pillBtn, { borderColor: theme.colors.brandSecondary }]}>
            <Text style={[styles.pillText, { color: theme.colors.brandSecondary }]}>LIVE</Text>
          </Pressable>
          <Pressable testID={`admin-mark-completed-${t.id}`} onPress={() => update({ status: \"completed\" })} style={[styles.pillBtn, { borderColor: theme.colors.onSurface3 }]}>
            <Text style={[styles.pillText, { color: theme.colors.onSurface3 }]}>COMPLETED</Text>
          </Pressable>
          <Pressable testID={`admin-delete-${t.id}`} onPress={del} style={[styles.pillBtn, { borderColor: theme.colors.error }]}>
            <Text style={[styles.pillText, { color: theme.colors.error }]}>DELETE</Text>
          </Pressable>
        </View>
        {msg ? <Text style={{ color: theme.colors.brand, fontSize: 12 }}>{msg}</Text> : null}
      </View>
    </View>
  );
}

function AdminRegCard({ r, onChanged }: { r: AdminReg; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [kills, setKills] = useState(String(r.kills || 0));
  const [wwcd, setWwcd] = useState(r.chicken_dinner);

  const verify = async (v: boolean) => {
    setBusy(true);
    try { await apiFetch(\"/registrations/verify\", { method: \"POST\", body: { registration_id: r.id, verify: v } }); onChanged(); }
    catch {} finally { setBusy(false); }
  };

  const saveStats = async () => {
    setBusy(true);
    try {
      await apiFetch(\"/registrations/stats\", {
        method: \"POST\",
        body: { registration_id: r.id, kills: parseInt(kills || \"0\"), chicken_dinner: wwcd },
      });
      onChanged();
    } catch {} finally { setBusy(false); }
  };

  const c = r.payment_status === \"verified\" ? theme.colors.brand : r.payment_status === \"rejected\" ? theme.colors.error : theme.colors.warning;

  return (
    <View style={styles.adminCard}>
      <View style={{ flexDirection: \"row\", justifyContent: \"space-between\", alignItems: \"flex-start\" }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.adminTitle}>{r.ign} <Text style={{ color: theme.colors.onSurface3, fontSize: 12 }}>({r.user_name})</Text></Text>
          <Text style={styles.adminSub}>{r.tournament_title}</Text>
          <Text style={styles.adminSub}>{r.user_email} • {r.user_phone}</Text>
          <Text style={styles.adminSub}>BGMI ID: {r.bgmi_id}</Text>
          <Text style={styles.adminSub}>UTR: {r.utr}</Text>
        </View>
        <View style={[styles.statusPill, { borderColor: c }]}>
          <Text style={{ color: c, fontSize: 10, fontWeight: \"800\", letterSpacing: 1 }}>{r.payment_status.toUpperCase()}</Text>
        </View>
      </View>

      {r.payment_status === \"pending\" && (
        <View style={{ flexDirection: \"row\", gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
          <Pressable testID={`verify-${r.id}`} onPress={() => verify(true)} style={[styles.pillBtn, { borderColor: theme.colors.brand, flex: 1 }]}>
            <Text style={[styles.pillText, { color: theme.colors.brand }]}>VERIFY</Text>
          </Pressable>
          <Pressable testID={`reject-${r.id}`} onPress={() => verify(false)} style={[styles.pillBtn, { borderColor: theme.colors.error, flex: 1 }]}>
            <Text style={[styles.pillText, { color: theme.colors.error }]}>REJECT</Text>
          </Pressable>
        </View>
      )}

      {r.payment_status === \"verified\" && (
        <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
          <Text style={styles.label}>KILLS</Text>
          <TInput testID={`kills-${r.id}`} value={kills} onChangeText={setKills} keyboardType=\"number-pad\" placeholder=\"0\" />
          <Pressable testID={`toggle-wwcd-${r.id}`} onPress={() => setWwcd((v) => !v)} style={[styles.wwcdToggle, wwcd && { borderColor: theme.colors.brandSecondary, backgroundColor: \"rgba(255,42,85,0.1)\" }]}>
            <Ionicons name={wwcd ? \"checkbox\" : \"square-outline\"} size={20} color={wwcd ? theme.colors.brandSecondary : theme.colors.onSurface3} />
            <Text style={{ color: wwcd ? theme.colors.brandSecondary : theme.colors.onSurface, fontWeight: \"800\", letterSpacing: 1 }}>CHICKEN DINNER</Text>
          </Pressable>
          <Pressable testID={`save-stats-${r.id}`} disabled={busy} onPress={saveStats} style={styles.cta}>
            <Text style={styles.ctaText}>SAVE STATS (₹{parseInt(kills || \"0\") * 5 + (wwcd ? 500 : 0)})</Text>
          </Pressable>
          <Text style={{ color: theme.colors.onSurface3, fontSize: 11 }}>Current earnings: ₹{r.earnings}</Text>
        </View>
      )}
    </View>
  );
}

function TInput({ testID, placeholder, value, onChangeText, keyboardType, autoCap }: any) {
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.onSurface3}
      style={styles.tinput}
      keyboardType={keyboardType}
      autoCapitalize={autoCap}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  center: { flex: 1, alignItems: \"center\", justifyContent: \"center\", gap: theme.spacing.md, padding: theme.spacing.xl },
  deniedText: { color: theme.colors.onSurface, fontSize: 16, fontWeight: \"700\" },
  topBar: { flexDirection: \"row\", alignItems: \"center\", padding: theme.spacing.md, justifyContent: \"space-between\" },
  backBtn: { width: 40, height: 40, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface2, alignItems: \"center\", justifyContent: \"center\" },
  topTitle: { color: theme.colors.brand, fontSize: 14, fontWeight: \"900\", letterSpacing: 3 },
  tabsRow: { flexDirection: \"row\", paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tabBtn: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, borderBottomWidth: 2, borderBottomColor: \"transparent\" },
  tabBtnActive: { borderBottomColor: theme.colors.brand },
  tabBtnText: { color: theme.colors.onSurface3, fontSize: 12, fontWeight: \"800\", letterSpacing: 2 },
  addBtn: { flexDirection: \"row\", alignItems: \"center\", justifyContent: \"center\", gap: 8, backgroundColor: theme.colors.brand, padding: theme.spacing.md, borderRadius: theme.radius.md },
  addBtnText: { color: theme.colors.onBrand, fontWeight: \"900\", letterSpacing: 2 },
  formCard: { backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing.md, gap: theme.spacing.sm },
  adminCard: { backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing.md },
  adminTitle: { color: theme.colors.onSurface, fontSize: 15, fontWeight: \"800\" },
  adminSub: { color: theme.colors.onSurface3, fontSize: 12, marginTop: 2 },
  statusPill: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  label: { color: theme.colors.onSurface3, fontSize: 10, letterSpacing: 1.5, fontWeight: \"700\" },
  tinput: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, height: 46, color: theme.colors.onSurface, fontSize: 14 },
  err: { color: theme.colors.error, fontSize: 12 },
  cta: { backgroundColor: theme.colors.brand, height: 46, borderRadius: theme.radius.md, alignItems: \"center\", justifyContent: \"center\" },
  ctaDisabled: { backgroundColor: theme.colors.surface3 },
  ctaText: { color: theme.colors.onBrand, fontWeight: \"900\", letterSpacing: 2 },
  pillBtn: { flex: 1, height: 40, borderRadius: theme.radius.sm, borderWidth: 1, alignItems: \"center\", justifyContent: \"center\" },
  pillText: { fontWeight: \"800\", letterSpacing: 1.5, fontSize: 12 },
  wwcdToggle: { flexDirection: \"row\", alignItems: \"center\", gap: theme.spacing.sm, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md },
});
"
Observation: Create successful: /app/frontend/app/admin.tsx
