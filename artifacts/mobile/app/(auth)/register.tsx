import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type AccountType = "supporter" | "organisation";

export default function RegisterScreen() {
  const colors = useColors();
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("supporter");
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
    setLoading(true);
    setError("");
    try {
      await register({
        name: name.trim(),
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

  const s = styles(colors);
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={s.header}>
            <Text style={s.logo}>Root ProjX</Text>
            <Text style={s.tagline}>Join the community.</Text>
          </View>

          {/* Form */}
          <View style={s.card}>
            <Text style={s.title}>Create account</Text>

            {!!error && <Text style={s.error}>{error}</Text>}

            {/* Account type toggle */}
            <Text style={s.label}>I am a</Text>
            <View style={s.toggleRow}>
              {(["supporter", "organisation"] as AccountType[]).map((type) => (
                <Pressable
                  key={type}
                  style={[s.toggleBtn, accountType === type && s.toggleActive]}
                  onPress={() => setAccountType(type)}
                >
                  <Text
                    style={[
                      s.toggleText,
                      accountType === type && s.toggleTextActive,
                    ]}
                  >
                    {type === "supporter" ? "Supporter" : "Organisation"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.label}>Full name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={s.label}>Phone (optional)</Text>
            <TextInput
              style={s.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+44 7700 000000"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={s.label}>Password</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Min. 6 characters"
              placeholderTextColor={colors.mutedForeground}
              onSubmitEditing={handleRegister}
            />

            <Pressable
              style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
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
  );
}

const styles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.navBackground },
    scroll: { flexGrow: 1 },
    header: {
      backgroundColor: c.navBackground,
      alignItems: "center",
      paddingVertical: 32,
      paddingHorizontal: 24,
    },
    logo: { fontSize: 28, fontWeight: "800", color: c.accent, letterSpacing: 1 },
    tagline: { color: c.navForeground, fontSize: 14, marginTop: 4, opacity: 0.85 },
    card: {
      flex: 1,
      backgroundColor: c.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 40,
    },
    title: { fontSize: 22, fontWeight: "700", color: c.foreground, marginBottom: 16 },
    error: {
      backgroundColor: "#FDECEA",
      color: c.destructive,
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
      fontSize: 14,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: c.foreground,
      marginBottom: 6,
      marginTop: 14,
    },
    toggleRow: { flexDirection: "row", gap: 10 },
    toggleBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: c.radius,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
    },
    toggleActive: { borderColor: c.primary, backgroundColor: "#FFF0F0" },
    toggleText: { color: c.mutedForeground, fontWeight: "600", fontSize: 14 },
    toggleTextActive: { color: c.primary },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: c.radius,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: c.foreground,
      backgroundColor: c.background,
    },
    btn: {
      backgroundColor: c.primary,
      borderRadius: c.radius,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 24,
    },
    btnPressed: { opacity: 0.85 },
    btnText: { color: c.primaryForeground, fontWeight: "700", fontSize: 15 },
    link: {
      textAlign: "center",
      marginTop: 20,
      color: c.mutedForeground,
      fontSize: 14,
    },
    linkAccent: { color: c.primary, fontWeight: "600" },
  });
