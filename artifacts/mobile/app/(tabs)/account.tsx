import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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

function Avatar({ initials, size = 72 }: { initials: string; size?: number }) {
  const colors = useColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.primaryForeground, fontWeight: "800", fontSize: size * 0.35 }}>
        {initials}
      </Text>
    </View>
  );
}

function EditProfileModal({
  visible,
  onClose,
  token,
  currentName,
  currentPhone,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  token: string;
  currentName: string;
  currentPhone: string;
  onSaved: () => void;
}) {
  const colors = useColors();
  const [name, setName] = useState(currentName);
  const [phone, setPhone] = useState(currentPhone);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!name.trim()) { setErr("Name is required."); return; }
    setSaving(true);
    setErr("");
    try {
      await api.updateProfile({ name: name.trim(), phone: phone.trim() || undefined }, token);
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Update failed.");
    } finally { setSaving(false); }
  }

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
    title: { fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 16 },
    label: { fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 6, marginTop: 12 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12, fontSize: 15, color: colors.foreground },
    err: { color: colors.destructive, fontSize: 13, marginTop: 8 },
    row: { flexDirection: "row", gap: 10, marginTop: 20 },
    btn: { flex: 1, paddingVertical: 13, borderRadius: colors.radius, alignItems: "center" },
    cancel: { backgroundColor: colors.secondary },
    save: { backgroundColor: colors.primary },
    cancelText: { color: colors.foreground, fontWeight: "600" },
    saveText: { color: colors.primaryForeground, fontWeight: "700" },
  });

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.overlay}>
        <View style={s.sheet}>
          <Text style={s.title}>Edit Profile</Text>
          {!!err && <Text style={s.err}>{err}</Text>}
          <Text style={s.label}>Name</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} />
          <Text style={s.label}>Phone</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <View style={s.row}>
            <Pressable style={[s.btn, s.cancel]} onPress={onClose}><Text style={s.cancelText}>Cancel</Text></Pressable>
            <Pressable style={[s.btn, s.save]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={s.saveText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function AccountScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, token, isAuthenticated, logout } = useAuth();
  const [editVisible, setEditVisible] = useState(false);

  const followsQ = useQuery({
    queryKey: ["follows", "my"],
    queryFn: () => api.getMyFollows(token!),
    enabled: isAuthenticated,
  });

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.getProfile(token!),
    enabled: isAuthenticated,
  });

  async function handleLogout() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => logout() },
    ]);
  }

  const s = styles(colors);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <Text style={s.guestTitle}>Root ProjX</Text>
          <Text style={s.guestSubtitle}>Sign in to follow organisations, track donations, and more.</Text>
          <Pressable style={s.primaryBtn} onPress={() => router.push("/(auth)/login")}>
            <Text style={s.primaryBtnText}>Sign in</Text>
          </Pressable>
          <Pressable style={s.secondaryBtn} onPress={() => router.push("/(auth)/register")}>
            <Text style={s.secondaryBtnText}>Create account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const profile = profileQ.data ?? user;
  const follows = followsQ.data ?? [];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Profile header */}
        <View style={s.profileHeader}>
          <Avatar initials={profile?.avatarInitials ?? "??"} size={80} />
          <View style={s.profileInfo}>
            <Text style={s.name}>{profile?.name ?? "—"}</Text>
            <Text style={s.email}>{profile?.email ?? "—"}</Text>
            <View style={s.typeBadge}>
              <Text style={s.typeBadgeText}>
                {profile?.accountType === "organisation" ? "Organisation" : "Supporter"}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statNum}>{follows.length}</Text>
            <Text style={s.statLabel}>Following</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={s.section}>
          <Pressable style={s.menuItem} onPress={() => setEditVisible(true)}>
            <Text style={s.menuLabel}>✏️  Edit Profile</Text>
            <Text style={s.chevron}>›</Text>
          </Pressable>

          {profile?.accountType === "organisation" && (
            <Pressable style={s.menuItem} onPress={() => router.push("/dashboard")}>
              <Text style={s.menuLabel}>📊  Organisation Dashboard</Text>
              <Text style={s.chevron}>›</Text>
            </Pressable>
          )}

          <Pressable style={[s.menuItem, { borderBottomWidth: 0 }]} onPress={handleLogout}>
            <Text style={[s.menuLabel, { color: colors.destructive }]}>🚪  Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>

      {token && profile && (
        <EditProfileModal
          visible={editVisible}
          onClose={() => setEditVisible(false)}
          token={token}
          currentName={profile.name}
          currentPhone={profile.phone ?? ""}
          onSaved={() => profileQ.refetch()}
        />
      )}
    </SafeAreaView>
  );
}

const styles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: 100 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
    guestTitle: { fontSize: 28, fontWeight: "800", color: c.primary },
    guestSubtitle: { fontSize: 15, color: c.mutedForeground, textAlign: "center", marginBottom: 8 },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: c.radius,
      paddingVertical: 14,
      paddingHorizontal: 40,
      width: "100%",
      alignItems: "center",
    },
    primaryBtnText: { color: c.primaryForeground, fontWeight: "700", fontSize: 15 },
    secondaryBtn: {
      borderWidth: 1.5,
      borderColor: c.primary,
      borderRadius: c.radius,
      paddingVertical: 13,
      paddingHorizontal: 40,
      width: "100%",
      alignItems: "center",
    },
    secondaryBtnText: { color: c.primary, fontWeight: "600", fontSize: 15 },
    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 20,
      gap: 16,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    profileInfo: { flex: 1 },
    name: { fontSize: 18, fontWeight: "700", color: c.foreground },
    email: { fontSize: 13, color: c.mutedForeground, marginTop: 2 },
    typeBadge: {
      alignSelf: "flex-start",
      marginTop: 6,
      backgroundColor: c.goldDim,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    typeBadgeText: { fontSize: 11, fontWeight: "700", color: c.accentForeground },
    statsRow: {
      flexDirection: "row",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    stat: { alignItems: "center", minWidth: 80 },
    statNum: { fontSize: 22, fontWeight: "800", color: c.foreground },
    statLabel: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
    section: {
      marginTop: 16,
      backgroundColor: c.card,
      marginHorizontal: 16,
      borderRadius: c.radius,
      borderWidth: 1,
      borderColor: c.border,
    },
    menuItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    menuLabel: { fontSize: 15, color: c.foreground },
    chevron: { fontSize: 20, color: c.mutedForeground },
  });
