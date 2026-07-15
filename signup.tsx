Action: file_editor create /app/frontend/app/signup.tsx --file-text "import { useState } from \"react\";
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from \"react-native\";
import { Link, router } from \"expo-router\";
import { Ionicons } from \"@expo/vector-icons\";
import { useAuth } from \"@/src/context/AuthContext\";
import { theme } from \"@/src/theme\";

export default function Signup() {
  const { signup } = useAuth();
  const [name, setName] = useState(\"\");
  const [email, setEmail] = useState(\"\");
  const [phone, setPhone] = useState(\"\");
  const [password, setPassword] = useState(\"\");
  const [error, setError] = useState(\"\");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(\"\");
    if (!name || !email || !phone || !password) return setError(\"All fields required\");
    if (password.length < 6) return setError(\"Password must be at least 6 characters\");
    if (phone.length < 10) return setError(\"Enter valid phone number\");
    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), phone.trim(), password);
      router.replace(\"/(tabs)/home\");
    } catch (e: any) {
      setError(e.message || \"Signup failed\");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === \"ios\" ? \"padding\" : \"height\"} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps=\"handled\">
        <View style={styles.header}>
          <Text style={styles.brand}>7X <Text style={{ color: theme.colors.onSurface }}>GAMING</Text></Text>
          <Text style={styles.title}>JOIN THE ARENA</Text>
          <View style={styles.line} />
        </View>

        <View style={styles.form}>
          <Field icon=\"person-outline\" placeholder=\"Full Name\" value={name} onChangeText={setName} testID=\"signup-name-input\" />
          <Field icon=\"mail-outline\" placeholder=\"Email\" value={email} onChangeText={setEmail}
            keyboardType=\"email-address\" autoCap=\"none\" testID=\"signup-email-input\" />
          <Field icon=\"call-outline\" placeholder=\"Phone Number\" value={phone} onChangeText={setPhone}
            keyboardType=\"phone-pad\" testID=\"signup-phone-input\" />
          <Field icon=\"lock-closed-outline\" placeholder=\"Password (min 6)\" value={password} onChangeText={setPassword}
            secure testID=\"signup-password-input\" />

          {error ? <Text style={styles.error} testID=\"signup-error\">{error}</Text> : null}

          <Pressable testID=\"signup-submit-button\" onPress={onSubmit} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.8 }]}>
            {loading ? <ActivityIndicator color={theme.colors.onBrand} /> : <Text style={styles.ctaText}>CREATE ACCOUNT</Text>}
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already a player? </Text>
            <Link href=\"/login\" asChild>
              <Pressable testID=\"go-to-login\"><Text style={styles.link}>Login</Text></Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ icon, placeholder, value, onChangeText, secure, keyboardType, autoCap, testID }: any) {
  return (
    <View style={styles.inputBox}>
      <Ionicons name={icon} size={18} color={theme.colors.onSurface3} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.onSurface3}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCap}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: theme.spacing.xl, paddingTop: 80, gap: theme.spacing.lg },
  header: { marginBottom: theme.spacing.lg },
  brand: { color: theme.colors.brand, fontSize: 40, fontWeight: \"900\", letterSpacing: 3 },
  title: { color: theme.colors.onSurface, fontSize: 24, fontWeight: \"800\", letterSpacing: 3, marginTop: theme.spacing.sm },
  line: { height: 3, width: 50, backgroundColor: theme.colors.brandSecondary, marginTop: theme.spacing.sm },
  form: { gap: theme.spacing.md },
  inputBox: {
    flexDirection: \"row\", alignItems: \"center\", gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, height: 52,
  },
  input: { flex: 1, color: theme.colors.onSurface, fontSize: 15 },
  cta: {
    backgroundColor: theme.colors.brand, height: 52, borderRadius: theme.radius.md,
    alignItems: \"center\", justifyContent: \"center\", marginTop: theme.spacing.md,
  },
  ctaText: { color: theme.colors.onBrand, fontSize: 16, fontWeight: \"800\", letterSpacing: 3 },
  error: { color: theme.colors.error, fontSize: 13 },
  footerRow: { flexDirection: \"row\", justifyContent: \"center\", marginTop: theme.spacing.md },
  footerText: { color: theme.colors.onSurface3 },
  link: { color: theme.colors.brand, fontWeight: \"700\" },
});
"
Observation: Create successful: /app/frontend/app/signup.tsx
