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

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#B50000" />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.header}>
              <Pressable style={s.backBtn} onPress={() => router.back()}>
                <Text style={s.backBtnText}>← Back</Text>
              </Pressable>
              <Image
                source={require("../../assets/images/logo.png")}
                style={s.logo}
                resizeMode="contain"
              />
              <Text style={s.tagline}>Connecting diaspora with grassroots change.</Text>
            </View>

            <View style={s.card}>
              <Text style={s.title}>Sign in</Text>

              {!!error && (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
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

              <Text style={s.label}>Password</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                placeholder="••••••••"
                placeholderTextColor="#888888"
                onSubmitEditing={handleLogin}
              />

              <Pressable
                style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1A1A1A" />
                ) : (
                  <Text style={s.btnText}>Sign in</Text>
                )}
              </Pressable>

              <Pressable onPress={() => router.push("/(auth)/register")}>
                <Text style={s.link}>
                  Don't have an account?{" "}
                  <Text style={s.linkAccent}>Create one</Text>
                </Text>
              </Pressable>

              <Pressable onPress={() => router.push("/(tabs)")} style={{ marginTop: 8 }}>
                <Text style={[s.link, { textAlign: "center" }]}>
                  <Text style={{ color: "#888888" }}>Continue as guest</Text>
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
  root: { flex: 1, backgroundColor: "#B50000" },
  scroll: { flexGrow: 1 },
  backBtn: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 2, marginBottom: 8 },
  backBtnText: { color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: "500" },
  header: {
    backgroundColor: "#B50000",
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  logo: { width: 140, height: 140 },
  tagline: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  title: { fontSize: 26, fontWeight: "800", color: "#1A1A1A", marginBottom: 20 },
  errorBox: {
    backgroundColor: "#FDECEA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: "#B50000", fontSize: 14 },
  label: { fontSize: 13, fontWeight: "600", color: "#1A1A1A", marginBottom: 6, marginTop: 14 },
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
