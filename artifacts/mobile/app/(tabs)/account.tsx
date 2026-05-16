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
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.35 }}>
        {initials}
      </Text>
    </View>
  );
}

function EditProfileModal({
  visible, onClose, token, currentName, currentPhone, onSaved,
}: {
  visible: boolean; onClose: () => void; token: string;
  currentName: string; currentPhone: string; onSaved: () => void;
}) {
  const colors = useColors();
  const [name, setName] = useState(currentName);
  const [phone, setPhone] = useState(currentPhone);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!name.trim()) { setErr("Name is required."); return; }
    setSaving(true); setErr("");
    try {
      await api.updateProfile({ name: name.trim(), phone: phone.trim() || undefined }, token);
      onSaved(); onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Update failed.");
    } finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View style={[es.sheet, { backgroundColor: colors.background }]}>
          <Text style={[es.title, { color: colors.foreground }]}>Edit Profile</Text>
          {!!err && <Text style={{ color: colors.destructive, fontSize: 13, marginBottom: 8 }}>{err}</Text>}
          <Text style={[es.label, { color: colors.foreground }]}>Name</Text>
          <TextInput style={[es.input, { borderColor: colors.border, color: colors.foreground }]} value={name} onChangeText={setName} />
          <Text style={[es.label, { color: colors.foreground }]}>Phone</Text>
          <TextInput style={[es.input, { borderColor: colors.border, color: colors.foreground }]} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <View style={es.row}>
            <Pressable style={[es.btn, { backgroundColor: colors.secondary }]} onPress={onClose}>
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
            <Pressable style={[es.btn, { backgroundColor: colors.primary }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const es = StyleSheet.create({
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  row: { flexDirection: "row", gap: 10, marginTop: 20 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
});

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

  if (!isAuthenticated) {
    return (
      <View style={[s.guestContainer, { backgroundColor: "#B50000" }]}>
        <SafeAreaView style={s.guestSafe} edges={["top"]}>
          <View style={s.guestContent}>
            <Text style={s.guestTitle}>Root ProjX</Text>
            <Text style={s.guestSubtitle}>
              Sign in to follow organisations, track donations, and more.
            </Text>
            <Pressable
              style={s.guestPrimaryBtn}
              onPress={() => router.push("/(auth)/login")}
            >
              <Text style={s.guestPrimaryBtnText}>Sign in</Text>
            </Pressable>
            <Pressable
              style={s.guestSecondaryBtn}
              onPress={() => router.push("/(auth)/register")}
            >
              <Text style={s.guestSecondaryBtnText}>Join as supporter</Text>
            </Pressable>
          </View>
          <View style={s.guestLinks}>
            <Pressable onPress={() => router.push("/about" as never)}>
              <Text style={s.guestLink}>About Root ProjX</Text>
            </Pressable>
            <Text style={s.guestLinkSep}>·</Text>
            <Pressable onPress={() => router.push("/shop" as never)}>
              <Text style={s.guestLink}>Shop</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const profile = profileQ.data ?? user;
  const follows = followsQ.data ?? [];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[s.profileHeader, { backgroundColor: colors.navBackground }]}>
          <Avatar initials={profile?.avatarInitials ?? "??"} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{profile?.name ?? "—"}</Text>
            <Text style={s.profileEmail}>{profile?.email ?? "—"}</Text>
            <View style={[s.typeBadge, { backgroundColor: "rgba(245,184,0,0.3)" }]}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#F5B800" }}>
                {profile?.accountType === "organisation" ? "Organisation" : "Supporter"}
              </Text>
            </View>
          </View>
        </View>

        <View style={[s.statsRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={s.statItem}>
            <Text style={[s.statNum, { color: colors.foreground }]}>{follows.length}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Following</Text>
          </View>
          {profile?.accountType === "supporter" && (
            <>
              <View style={[s.statDivider, { backgroundColor: colors.border }]} />
              <View style={s.statItem}>
                <Text style={[s.statNum, { color: colors.primary }]}>
                  {follows.length > 0 ? "Active" : "—"}
                </Text>
                <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Supporter</Text>
              </View>
            </>
          )}
        </View>

        {follows.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>FOLLOWING</Text>
            {follows.map((org) => (
              <Pressable
                key={org._id}
                style={[s.followRow, { borderBottomColor: colors.border }]}
                onPress={() => router.push(`/organisations/${org._id}`)}
              >
                <View style={[s.followAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                    {org.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.followName, { color: colors.foreground }]} numberOfLines={1}>{org.name}</Text>
                  <Text style={[s.followLocation, { color: colors.mutedForeground }]}>
                    {[org.city, org.country].filter(Boolean).join(", ")}
                  </Text>
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 18 }}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={[s.menuSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable style={[s.menuItem, { borderBottomColor: colors.border }]} onPress={() => setEditVisible(true)}>
            <Text style={[s.menuLabel, { color: colors.foreground }]}>Edit Profile</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 18 }}>›</Text>
          </Pressable>

          {profile?.accountType === "organisation" && (
            <Pressable style={[s.menuItem, { borderBottomColor: colors.border }]} onPress={() => router.push("/dashboard")}>
              <Text style={[s.menuLabel, { color: colors.foreground }]}>Organisation Dashboard</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 18 }}>›</Text>
            </Pressable>
          )}

          <Pressable style={[s.menuItem, { borderBottomColor: colors.border }]} onPress={() => router.push("/shop" as never)}>
            <Text style={[s.menuLabel, { color: colors.foreground }]}>Shop</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 18 }}>›</Text>
          </Pressable>

          <Pressable style={[s.menuItem, { borderBottomColor: colors.border }]} onPress={() => router.push("/about" as never)}>
            <Text style={[s.menuLabel, { color: colors.foreground }]}>About Root ProjX</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 18 }}>›</Text>
          </Pressable>

          <Pressable style={[s.menuItem, { borderBottomWidth: 0 }]} onPress={handleLogout}>
            <Text style={[s.menuLabel, { color: colors.destructive }]}>Sign out</Text>
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

const s = StyleSheet.create({
  safe: { flex: 1 },
  guestContainer: { flex: 1 },
  guestSafe: { flex: 1, justifyContent: "space-between", alignItems: "center", paddingHorizontal: 32 },
  guestContent: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, width: "100%" },
  guestTitle: { fontFamily: "DancingScript_700Bold", fontSize: 42, color: "#FFFFFF" },
  guestSubtitle: { fontSize: 15, color: "rgba(255,255,255,0.8)", textAlign: "center", lineHeight: 22 },
  guestPrimaryBtn: {
    backgroundColor: "#F5B800", borderRadius: 10, paddingVertical: 15,
    width: "100%", alignItems: "center",
  },
  guestPrimaryBtnText: { color: "#1A1A1A", fontWeight: "800", fontSize: 16 },
  guestSecondaryBtn: {
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 10,
    paddingVertical: 14, width: "100%", alignItems: "center",
  },
  guestSecondaryBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
  guestLinks: { flexDirection: "row", gap: 12, paddingBottom: 24, alignItems: "center" },
  guestLink: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  guestLinkSep: { color: "rgba(255,255,255,0.4)", fontSize: 16 },
  profileHeader: {
    flexDirection: "row", alignItems: "center", gap: 16,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20,
  },
  profileName: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  profileEmail: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  typeBadge: { alignSelf: "flex-start", marginTop: 6, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  statsRow: { flexDirection: "row", padding: 16, borderBottomWidth: 1 },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: { width: 1 },
  section: { marginTop: 16, marginHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  followRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, borderBottomWidth: 1,
  },
  followAvatar: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
  },
  followName: { fontSize: 14, fontWeight: "600" },
  followLocation: { fontSize: 12, marginTop: 1 },
  menuSection: {
    margin: 16, borderRadius: 12, borderWidth: 1, overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1,
  },
  menuLabel: { fontSize: 15 },
});
