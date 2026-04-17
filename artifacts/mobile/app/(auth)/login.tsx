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

export default function LoginScreen() {
  const colors = useColors();
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
            <Text style={s.tagline}>Connecting diaspora with grassroots change.</Text>
          </View>

          {/* Form */}
          <View style={s.card}>
            <Text style={s.title}>Sign in</Text>

            {!!error && <Text style={s.error}>{error}</Text>}

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

            <Text style={s.label}>Password</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
              placeholderTextColor={colors.mutedForeground}
              onSubmitEditing={handleLogin}
            />

            <Pressable
              style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
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
      paddingVertical: 40,
      paddingHorizontal: 24,
    },
    logo: {
      fontSize: 32,
      fontWeight: "800",
      color: c.accent,
      letterSpacing: 1,
    },
    tagline: {
      color: c.navForeground,
      fontSize: 14,
      marginTop: 6,
      opacity: 0.85,
      textAlign: "center",
    },
    card: {
      flex: 1,
      backgroundColor: c.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 40,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: c.foreground,
      marginBottom: 20,
    },
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
    btnText: {
      color: c.primaryForeground,
      fontWeight: "700",
      fontSize: 15,
    },
    link: {
      textAlign: "center",
      marginTop: 20,
      color: c.mutedForeground,
      fontSize: 14,
    },
    linkAccent: { color: c.primary, fontWeight: "600" },
  });
