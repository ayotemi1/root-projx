import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";

export default function LandingScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) return null;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7A0000" />

      <SafeAreaView style={s.safe}>
        <View style={s.centerBlock}>
          <Image
            source={require("../assets/images/logo.png")}
            style={s.logo}
            resizeMode="contain"
          />

          <View style={s.divider} />

          <Text style={s.subtitle}>RESTORATION. CULTURE. ACCESS.</Text>
          <Text style={s.caption}>Support straight to the source.</Text>
        </View>

        <View style={s.bottomBlock}>
          <Pressable
            style={({ pressed }) => [s.enterBtn, pressed && s.enterBtnPressed]}
            onPress={() => router.push("/(tabs)")}
          >
            <Text style={s.enterBtnText}>Enter</Text>
          </Pressable>

          <View style={s.authRow}>
            <Pressable onPress={() => router.push("/(auth)/register")}>
              <Text style={s.authLink}>Join as supporter</Text>
            </Pressable>
            <Text style={s.authSep}>·</Text>
            <Pressable onPress={() => router.push("/(auth)/register-org")}>
              <Text style={s.authLink}>Join as organisation</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => router.push("/(auth)/login")}>
            <Text style={s.signInLink}>Already a member? Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#B50000",
  },
  safe: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  centerBlock: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 0,
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 8,
  },
  tagline: {
    textAlign: "center",
    marginBottom: 16,
  },
  divider: {
    width: 48,
    height: 2,
    backgroundColor: "#F5B800",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 8,
  },
  caption: {
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
  bottomBlock: {
    width: "100%",
    alignItems: "center",
    gap: 16,
  },
  enterBtn: {
    backgroundColor: "#F5B800",
    borderRadius: 10,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
  },
  enterBtnPressed: {
    opacity: 0.85,
  },
  enterBtnText: {
    color: "#1A1A1A",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  authRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  authLink: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "600",
  },
  authSep: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 16,
  },
  signInLink: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "400",
  },
});
