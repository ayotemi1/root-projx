import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const PRESET_AMOUNTS = [10, 25, 50, 100];

export default function DonateScreen() {
  const colors = useColors();
  const router = useRouter();
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const { isAuthenticated, token } = useAuth();

  const [preset, setPreset] = useState<number | null>(25);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");

  const orgQ = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId!, token),
  });

  const org = orgQ.data;
  const amount = custom ? parseFloat(custom) : (preset ?? 0);

  function handleDonate() {
    if (!isAuthenticated) {
      Alert.alert(
        "Sign in required",
        "Please sign in to make a donation.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign in", onPress: () => router.push("/(auth)/login") },
        ],
      );
      return;
    }
    if (!amount || amount <= 0) {
      Alert.alert("Invalid amount", "Please select or enter a valid amount.");
      return;
    }
    Alert.alert(
      "Stripe Payments — Coming in Step 9",
      `Your donation of £${amount.toFixed(2)} to ${org?.name ?? "this organisation"} will be processed once Stripe is integrated.`,
      [{ text: "OK" }],
    );
  }

  const s = styles(colors);
  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Org banner */}
        <View style={s.orgBanner}>
          <View style={s.orgAvatar}>
            <Text style={s.orgAvatarText}>
              {(org?.name ?? "")
                .split(" ")
                .map((w: string) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() || "??"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.orgName}>{org?.name ?? "Loading..."}</Text>
            {org && (
              <Text style={s.orgLocation}>
                {[org.city, org.country].filter(Boolean).join(", ")}
              </Text>
            )}
          </View>
        </View>

        <View style={s.body}>
          <Text style={s.sectionLabel}>Choose amount (GBP)</Text>

          {/* Preset amounts */}
          <View style={s.presetsRow}>
            {PRESET_AMOUNTS.map((amt) => (
              <Pressable
                key={amt}
                style={[s.presetBtn, preset === amt && !custom && s.presetActive]}
                onPress={() => {
                  setPreset(amt);
                  setCustom("");
                }}
              >
                <Text style={[s.presetText, preset === amt && !custom && s.presetTextActive]}>
                  £{amt}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Custom amount */}
          <Text style={s.sectionLabel}>Or enter a custom amount</Text>
          <View style={s.customWrap}>
            <Text style={s.currency}>£</Text>
            <TextInput
              style={s.customInput}
              value={custom}
              onChangeText={(t) => {
                setCustom(t);
                if (t) setPreset(null);
              }}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          {/* Note */}
          <Text style={s.sectionLabel}>Add a note (optional)</Text>
          <TextInput
            style={s.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="A message of support..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
          />

          {/* Summary */}
          {amount > 0 && (
            <View style={s.summary}>
              <Text style={s.summaryText}>
                You are donating{" "}
                <Text style={s.summaryAmt}>£{amount.toFixed(2)}</Text>
                {org ? ` to ${org.name}` : ""}
              </Text>
            </View>
          )}

          {/* Stripe notice */}
          <View style={s.notice}>
            <Text style={s.noticeText}>
              💳 Secure payments powered by Stripe — coming soon
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [s.donateBtn, pressed && s.donateBtnPressed]}
            onPress={handleDonate}
          >
            <Text style={s.donateBtnText}>
              Donate {amount > 0 ? `£${amount.toFixed(2)}` : ""}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: 40 },
    orgBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.navBackground,
      paddingHorizontal: 20,
      paddingVertical: 20,
      paddingTop: 30,
    },
    orgAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    orgAvatarText: { fontSize: 20, fontWeight: "800", color: c.accentForeground },
    orgName: { fontSize: 17, fontWeight: "800", color: c.navForeground },
    orgLocation: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
    body: { padding: 20 },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: c.mutedForeground,
      textTransform: "uppercase",
      marginTop: 20,
      marginBottom: 10,
    },
    presetsRow: { flexDirection: "row", gap: 10 },
    presetBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: c.radius,
      alignItems: "center",
      backgroundColor: c.secondary,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    presetActive: { backgroundColor: c.primary, borderColor: c.primary },
    presetText: { fontSize: 16, fontWeight: "700", color: c.mutedForeground },
    presetTextActive: { color: c.primaryForeground },
    customWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: c.radius,
      paddingHorizontal: 14,
    },
    currency: { fontSize: 18, fontWeight: "700", color: c.foreground, marginRight: 4 },
    customInput: {
      flex: 1,
      fontSize: 22,
      fontWeight: "700",
      color: c.foreground,
      paddingVertical: 12,
    },
    noteInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: c.radius,
      padding: 14,
      fontSize: 14,
      color: c.foreground,
      height: 80,
      textAlignVertical: "top",
    },
    summary: {
      marginTop: 20,
      padding: 14,
      backgroundColor: c.card,
      borderRadius: c.radius,
      borderWidth: 1,
      borderColor: c.border,
    },
    summaryText: { fontSize: 15, color: c.foreground, textAlign: "center" },
    summaryAmt: { fontWeight: "800", color: c.primary },
    notice: {
      marginTop: 12,
      padding: 12,
      backgroundColor: "#FFF8E1",
      borderRadius: c.radius,
    },
    noticeText: { fontSize: 13, color: "#7B6000", textAlign: "center" },
    donateBtn: {
      backgroundColor: c.accent,
      borderRadius: c.radius,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 20,
    },
    donateBtnPressed: { opacity: 0.85 },
    donateBtnText: {
      color: c.accentForeground,
      fontWeight: "800",
      fontSize: 17,
    },
  });
