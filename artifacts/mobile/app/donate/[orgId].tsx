import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as api from "@/lib/api";

export default function DonateScreen() {
  const { orgId, campaign } = useLocalSearchParams<{ orgId: string; campaign?: string }>();
  const colors = useColors();
  const { token } = useAuth();
  const [opening, setOpening] = useState(false);
  const orgQ = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId, token),
    enabled: !!orgId,
  });
  const org = orgQ.data;
  const s = styles(colors);

  async function handleDonate() {
    if (!orgId || opening) return;
    setOpening(true);
    try {
      const url = `https://rootprojx.com/donate/${encodeURIComponent(orgId)}` +
        (campaign ? `?campaign=${encodeURIComponent(campaign)}` : "");
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert("Could not open website", "Please try again, or visit rootprojx.com in your browser.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.orgBanner}>
          <View style={s.orgAvatar}>
            <Text style={s.orgAvatarText}>
              {(org?.name ?? "").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "??"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.orgName}>{org?.name ?? (orgQ.isError ? "Organisation" : "Loading...")}</Text>
            {org && <Text style={s.orgLocation}>{[org.city, org.country].filter(Boolean).join(", ")}</Text>}
          </View>
        </View>
        <View style={s.body}>
          {orgQ.isError && (
            <Pressable onPress={() => orgQ.refetch()}>
              <Text style={s.explanation}>Could not load organisation details. Tap to retry.</Text>
            </Pressable>
          )}
          <Text style={s.explanation}>
            Support {org?.name ?? "this organisation"} by donating on our website.
            Choose your amount and make a one-time or monthly donation there.
          </Text>
          <View style={s.notice}>
            <Text style={s.noticeText}>Secured by Stripe · 5% platform fee supports Root ProjX</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Donate on rootprojx.com"
            style={({ pressed }) => [s.donateBtn, (opening || !orgId) && s.disabled, pressed && s.pressed]}
            onPress={handleDonate}
            disabled={opening || !orgId}
          >
            {opening ? <ActivityIndicator color={colors.accentForeground} /> : (
              <Text style={s.donateBtnText}>Donate on rootprojx.com</Text>
            )}
          </Pressable>
          <Text style={s.websiteNote}>Donations are processed securely on our website.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  scroll: { paddingBottom: 40 },
  orgBanner: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: c.navBackground, paddingHorizontal: 20,
    paddingVertical: 20, paddingTop: 30,
  },
  orgAvatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: c.accent,
    alignItems: "center", justifyContent: "center",
  },
  orgAvatarText: { fontSize: 20, fontWeight: "800", color: c.accentForeground },
  orgName: { fontSize: 17, fontWeight: "800", color: c.navForeground },
  orgLocation: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  body: { padding: 20 },
  explanation: { fontSize: 15, lineHeight: 23, color: c.foreground, marginBottom: 12 },
  notice: { marginTop: 12, padding: 12, backgroundColor: "#FFF8E1", borderRadius: c.radius },
  noticeText: { fontSize: 12, color: "#7B6000", textAlign: "center" },
  donateBtn: {
    backgroundColor: c.accent, borderRadius: c.radius, paddingVertical: 16,
    paddingHorizontal: 12, alignItems: "center", marginTop: 20,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  donateBtnText: { color: c.accentForeground, fontWeight: "800", fontSize: 17, textAlign: "center" },
  websiteNote: { fontSize: 12, lineHeight: 18, color: c.mutedForeground, textAlign: "center", marginTop: 12 },
});
