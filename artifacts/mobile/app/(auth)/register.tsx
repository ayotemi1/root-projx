import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";

type AccountType = "supporter" | "organisation";

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("supporter");
  const [orgName, setOrgName] = useState("");
  const [orgCountry, setOrgCountry] = useState("");
  const [orgRegNumber, setOrgRegNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password) {
      setError("Name, email and password are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (accountType === "organisation" && !orgName.trim()) {
      setError("Organisation name is required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register({
        name: accountType === "organisation" ? orgName.trim() : name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        accountType,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#7A0000" />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.header}>
              <Image
                source={require("../../assets/images/logo.png")}
                style={s.logo}
                resizeMode="contain"
              />
              <Text style={s.tagline}>Join the community.</Text>
            </View>

            <View style={s.card}>
              <Text style={s.title}>Create account</Text>

              {!!error && (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}

              <Text style={s.label}>I am a</Text>
              <View style={s.typeRow}>
                {(["supporter", "organisation"] as AccountType[]).map((type) => (
                  <Pressable
                    key={type}
                    style={[s.typeBtn, accountType === type && s.typeBtnActive]}
                    onPress={() => setAccountType(type)}
                  >
                    <Text style={[s.typeBtnText, accountType === type && s.typeBtnTextActive]}>
                      {type === "supporter" ? "Supporter" : "Organisation"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {accountType === "supporter" ? (
                <>
                  <Text style={s.label}>Full name</Text>
                  <TextInput
                    style={s.input}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    placeholder="Your name"
                    placeholderTextColor="#888888"
                  />
                </>
              ) : (
                <>
                  <Text style={s.label}>Organisation name</Text>
                  <TextInput
                    style={s.input}
                    value={orgName}
                    onChangeText={setOrgName}
                    autoCapitalize="words"
                    placeholder="Name of your organisation"
                    placeholderTextColor="#888888"
                  />
                  <Text style={s.label}>Your name (contact person)</Text>
                  <TextInput
                    style={s.input}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    placeholder="Your full name"
                    placeholderTextColor="#888888"
                  />
                  <Text style={s.label}>Country of operation</Text>
                  <TextInput
                    style={s.input}
                    value={orgCountry}
                    onChangeText={setOrgCountry}
                    placeholder="e.g. Jamaica, United Kingdom"
                    placeholderTextColor="#888888"
                  />
                  <Text style={s.label}>Registration number (optional)</Text>
                  <TextInput
                    style={s.input}
                    value={orgRegNumber}
                    onChangeText={setOrgRegNumber}
                    placeholder="Charity/Company reg number"
                    placeholderTextColor="#888888"
                  />
                </>
              )}

              <Text style={s.label}>Email</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                placeholder="you@example.com"
                placeholderTextColor="#888888"
              />

              <Text style={s.label}>Phone (optional)</Text>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+44 7700 000000"
                placeholderTextColor="#888888"
              />

              <Text style={s.label}>Password</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Min. 6 characters"
                placeholderTextColor="#888888"
                onSubmitEditing={handleRegister}
              />

              <Pressable
                style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1A1A1A" />
                ) : (
                  <Text style={s.btnText}>Create account</Text>
                )}
              </Pressable>

              <Pressable onPress={() => router.back()}>
                <Text style={s.link}>
                  Already have an account?{" "}
                  <Text style={s.linkAccent}>Sign in</Text>
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#7A0000" },
  scroll: { flexGrow: 1 },
  header: {
    backgroundColor: "#7A0000",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  logo: { width: 110, height: 110 },
  tagline: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4 },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#1A1A1A", marginBottom: 16 },
  errorBox: { backgroundColor: "#FDECEA", borderRadius: 8, padding: 12, marginBottom: 14 },
  errorText: { color: "#B50000", fontSize: 14 },
  label: { fontSize: 13, fontWeight: "600", color: "#1A1A1A", marginBottom: 6, marginTop: 14 },
  typeRow: { flexDirection: "row", gap: 10 },
  typeBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E0D8CC",
    alignItems: "center",
    backgroundColor: "#F9F6F0",
  },
  typeBtnActive: { borderColor: "#B50000", backgroundColor: "#FFF0F0" },
  typeBtnText: { color: "#888888", fontWeight: "600", fontSize: 14 },
  typeBtnTextActive: { color: "#B50000", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#E0D8CC",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: "#1A1A1A",
    backgroundColor: "#FFFFFF",
  },
  btn: {
    backgroundColor: "#F5B800",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  btnText: { color: "#1A1A1A", fontWeight: "800", fontSize: 16 },
  link: { textAlign: "center", marginTop: 20, color: "#888888", fontSize: 14 },
  linkAccent: { color: "#B50000", fontWeight: "600" },
});
