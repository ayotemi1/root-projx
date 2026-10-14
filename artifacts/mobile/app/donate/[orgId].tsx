import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StripeProvider, usePaymentSheet } from "@stripe/stripe-react-native";

import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

function DonateForm({ orgId }: { orgId: string }) {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated, token } = useAuth();

  const [preset, setPreset] = useState<number | null>(25);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [donationType, setDonationType] = useState<"one_time" | "recurring">("one_time");
  const [guestEmail, setGuestEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<"select" | "success">("select");

  const { initPaymentSheet, presentPaymentSheet, loading: sheetLoading } = usePaymentSheet();

  const orgQ = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId!, token),
  });

  const org = orgQ.data;
  const amount = custom ? parseFloat(custom) : (preset ?? 0);

  async function handleDonate() {
    if (!amount || amount <= 0) {
      Alert.alert("Invalid amount", "Please select or enter a valid amount.");
      return;
    }

    // Guests must provide email for one-time donations; recurring requires account
    if (!isAuthenticated) {
      if (donationType === "recurring") {
        Alert.alert(
          "Account required",
          "Monthly donations require a Root ProjX account so we can manage your subscription.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Sign in", onPress: () => router.push("/(auth)/login") },
          ],
        );
        return;
      }
      if (!guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        Alert.alert("Email required", "Please enter a valid email address to receive your receipt.");
        return;
      }
    }

    setCreating(true);
    try {
      let clientSecret: string;

      if (!isAuthenticated) {
        // Guest one-time donation
        const res = await api.createGuestPaymentIntent({
          orgId: orgId!,
          amountGbp: amount,
          guestEmail: guestEmail.trim(),
          note: note.trim() || undefined,
        });
        clientSecret = res.clientSecret;
      } else if (donationType === "one_time") {
        const res = await api.createPaymentIntent(
          { orgId: orgId!, amountGbp: amount, note: note.trim() || undefined },
          token!,
        );
        clientSecret = res.clientSecret;
      } else {
        const res = await api.createSubscription(
          { orgId: orgId!, amountGbp: amount, note: note.trim() || undefined },
          token!,
        );
        clientSecret = res.clientSecret;
      }

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Root ProjX",
        style: "alwaysLight",
        primaryButtonLabel:
          donationType === "one_time" || !isAuthenticated
            ? `Donate £${amount.toFixed(2)}`
            : `Start £${amount.toFixed(2)}/month`,
      });

      if (initError) {
        Alert.alert("Payment setup failed", initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== "Canceled") {
          Alert.alert("Payment failed", presentError.message);
        }
      } else {
        setStep("success");
      }
    } catch (err: unknown) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  const s = styles(colors);
  const isLoading = creating || sheetLoading;

  if (step === "success") {
    return (
      <View style={s.successContainer}>
        <View style={s.successIcon}>
          <Text style={s.successIconText}>✓</Text>
        </View>
        <Text style={s.successTitle}>Thank you!</Text>
        <Text style={s.successMsg}>
          Your {donationType === "recurring" && isAuthenticated ? "monthly " : ""}donation of{" "}
          <Text style={s.successAmt}>£{amount.toFixed(2)}</Text>{" "}
          to <Text style={{ fontWeight: "700" }}>{org?.name ?? "this organisation"}</Text> was successful.
        </Text>
        {!isAuthenticated && (
          <Text style={s.successSub}>
            Your receipt has been sent to {guestEmail}. Join Root ProjX to track your impact.
          </Text>
        )}
        {donationType === "recurring" && isAuthenticated && (
          <Text style={s.successSub}>
            You will be charged monthly. You can manage this from your account.
          </Text>
        )}
        {isAuthenticated && (
          <Text style={s.successSub}>
            You now follow this organisation and will see their updates in your feed.
          </Text>
        )}
        <Pressable style={s.successBtn} onPress={() => router.push(`/organisations/${orgId}`)}>
          <Text style={s.successBtnText}>Back to Organisation</Text>
        </Pressable>
        {!isAuthenticated && (
          <Pressable
            style={[s.successBtn, { backgroundColor: colors.primary, borderColor: colors.primary, marginTop: 10 }]}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={[s.successBtnText, { color: "#fff" }]}>Create an account →</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
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
        {/* Frequency toggle — only for authenticated users (recurring needs account) */}
        {isAuthenticated && (
          <>
            <Text style={s.sectionLabel}>Frequency</Text>
            <View style={s.typeRow}>
              {(["one_time", "recurring"] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[s.typeBtn, donationType === t && s.typeBtnActive]}
                  onPress={() => setDonationType(t)}
                >
                  <Text style={[s.typeBtnText, donationType === t && s.typeBtnTextActive]}>
                    {t === "one_time" ? "One-time" : "Monthly"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={s.sectionLabel}>Amount (GBP)</Text>
        <View style={s.presetsRow}>
          {PRESET_AMOUNTS.map((amt) => (
            <Pressable
              key={amt}
              style={[s.presetBtn, preset === amt && !custom && s.presetActive]}
              onPress={() => { setPreset(amt); setCustom(""); }}
            >
              <Text style={[s.presetText, preset === amt && !custom && s.presetTextActive]}>
                £{amt}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.sectionLabel}>Custom amount</Text>
        <View style={s.customWrap}>
          <Text style={s.currency}>£</Text>
          <TextInput
            style={s.customInput}
            value={custom}
            onChangeText={(t) => { setCustom(t); if (t) setPreset(null); }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

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

        {/* Guest email field — shown only when not authenticated */}
        {!isAuthenticated && (
          <>
            <Text style={s.sectionLabel}>Your email address</Text>
            <TextInput
              style={s.emailInput}
              value={guestEmail}
              onChangeText={setGuestEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Text style={s.guestNote}>
              Your receipt will be sent here. No account required.{" "}
              <Text
                style={{ color: colors.primary, fontWeight: "700" }}
                onPress={() => router.push("/(auth)/login")}
              >
                Sign in
              </Text>{" "}
              to track your impact.
            </Text>
          </>
        )}

        {amount > 0 && (
          <View style={s.summary}>
            <Text style={s.summaryText}>
              You are donating{" "}
              <Text style={s.summaryAmt}>£{amount.toFixed(2)}</Text>
              {donationType === "recurring" && isAuthenticated && <Text style={s.summarySub}> / month</Text>}
              {org ? ` to ${org.name}` : ""}
            </Text>
          </View>
        )}

        <View style={s.notice}>
          <Text style={s.noticeText}>
            🔒 Secured by Stripe · 5% platform fee supports Root ProjX
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            s.donateBtn,
            (!amount || amount <= 0 || isLoading) && s.donateBtnDisabled,
            pressed && s.donateBtnPressed,
          ]}
          onPress={handleDonate}
          disabled={!amount || amount <= 0 || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.accentForeground} />
          ) : (
            <Text style={s.donateBtnText}>
              {amount > 0
                ? donationType === "recurring" && isAuthenticated
                  ? `Start £${amount.toFixed(2)}/month →`
                  : `Donate £${amount.toFixed(2)} →`
                : "Select an amount"}
            </Text>
          )}
        </Pressable>

        {!isAuthenticated && (
          <Pressable style={s.signInLink} onPress={() => router.push("/(auth)/login")}>
            <Text style={[s.signInLinkText, { color: colors.mutedForeground }]}>
              Have an account?{" "}
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Sign in</Text>
              {" "}for monthly giving & impact tracking
            </Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

export default function DonateScreen() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const colors = useColors();

  useEffect(() => {
    api.getStripePublishableKey()
      .then((r) => setPublishableKey(r.publishableKey))
      .catch(() => setPublishableKey(""));
  }, []);

  const s = styles(colors);

  if (publishableKey === null) {
    return (
      <SafeAreaView style={s.safe} edges={["bottom"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <StripeProvider
        publishableKey={publishableKey}
        merchantIdentifier="merchant.com.rootprojx"
      >
        <DonateForm orgId={orgId!} />
      </StripeProvider>
    </SafeAreaView>
  );
}

const styles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: 40 },
    orgBanner: {
      flexDirection: "row", alignItems: "center", gap: 14,
      backgroundColor: c.navBackground, paddingHorizontal: 20,
      paddingVertical: 20, paddingTop: 30,
    },
    orgAvatar: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: c.accent, alignItems: "center", justifyContent: "center",
    },
    orgAvatarText: { fontSize: 20, fontWeight: "800", color: c.accentForeground },
    orgName: { fontSize: 17, fontWeight: "800", color: c.navForeground },
    orgLocation: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
    body: { padding: 20 },
    sectionLabel: {
      fontSize: 13, fontWeight: "700", color: c.mutedForeground,
      textTransform: "uppercase", marginTop: 20, marginBottom: 10,
    },
    typeRow: { flexDirection: "row", gap: 10 },
    typeBtn: {
      flex: 1, paddingVertical: 12, borderRadius: c.radius,
      alignItems: "center", borderWidth: 2, borderColor: c.border, backgroundColor: c.secondary,
    },
    typeBtnActive: { borderColor: c.primary, backgroundColor: c.primary + "20" },
    typeBtnText: { fontSize: 15, fontWeight: "700", color: c.mutedForeground },
    typeBtnTextActive: { color: c.primary },
    presetsRow: { flexDirection: "row", gap: 10 },
    presetBtn: {
      flex: 1, paddingVertical: 12, borderRadius: c.radius, alignItems: "center",
      backgroundColor: c.secondary, borderWidth: 1.5, borderColor: c.border,
    },
    presetActive: { backgroundColor: c.primary, borderColor: c.primary },
    presetText: { fontSize: 16, fontWeight: "700", color: c.mutedForeground },
    presetTextActive: { color: c.primaryForeground },
    customWrap: {
      flexDirection: "row", alignItems: "center", borderWidth: 1,
      borderColor: c.border, borderRadius: c.radius, paddingHorizontal: 14,
    },
    currency: { fontSize: 18, fontWeight: "700", color: c.foreground, marginRight: 4 },
    customInput: { flex: 1, fontSize: 22, fontWeight: "700", color: c.foreground, paddingVertical: 12 },
    noteInput: {
      borderWidth: 1, borderColor: c.border, borderRadius: c.radius,
      padding: 14, fontSize: 14, color: c.foreground, height: 80, textAlignVertical: "top",
    },
    emailInput: {
      borderWidth: 1, borderColor: c.border, borderRadius: c.radius,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.foreground,
    },
    guestNote: { fontSize: 12, color: c.mutedForeground, marginTop: 8, lineHeight: 18 },
    signInLink: { marginTop: 16, alignItems: "center" },
    signInLinkText: { fontSize: 13, textAlign: "center", lineHeight: 20 },
    summary: {
      marginTop: 20, padding: 14, backgroundColor: c.card,
      borderRadius: c.radius, borderWidth: 1, borderColor: c.border,
    },
    summaryText: { fontSize: 15, color: c.foreground, textAlign: "center" },
    summaryAmt: { fontWeight: "800", color: c.primary },
    summarySub: { color: c.mutedForeground },
    notice: { marginTop: 12, padding: 12, backgroundColor: "#FFF8E1", borderRadius: c.radius },
    noticeText: { fontSize: 12, color: "#7B6000", textAlign: "center" },
    donateBtn: {
      backgroundColor: c.accent, borderRadius: c.radius,
      paddingVertical: 16, alignItems: "center", marginTop: 20,
    },
    donateBtnDisabled: { opacity: 0.5 },
    donateBtnPressed: { opacity: 0.85 },
    donateBtnText: { color: c.accentForeground, fontWeight: "800", fontSize: 17 },
    successContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
    successIcon: {
      width: 80, height: 80, borderRadius: 40, backgroundColor: "#D1FAE5",
      borderWidth: 2, borderColor: "#6EE7B7", alignItems: "center",
      justifyContent: "center", marginBottom: 24,
    },
    successIconText: { fontSize: 36, color: "#065F46" },
    successTitle: { fontSize: 26, fontWeight: "800", marginBottom: 12 },
    successMsg: { fontSize: 15, textAlign: "center", marginBottom: 8, lineHeight: 22 },
    successAmt: { fontWeight: "800", color: c.primary },
    successSub: { fontSize: 13, color: c.mutedForeground, textAlign: "center", marginTop: 6 },
    successBtn: {
      marginTop: 24, backgroundColor: c.secondary, borderRadius: c.radius,
      paddingVertical: 14, paddingHorizontal: 28, borderWidth: 1, borderColor: c.border,
    },
    successBtnText: { fontSize: 15, fontWeight: "700", color: c.foreground },
  });
