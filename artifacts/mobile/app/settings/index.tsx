import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const APP_VERSION = "1.0.0";

function SectionHeader({ label }: { label: string }) {
  return (
    <Text style={s.sectionHeader}>{label.toUpperCase()}</Text>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
  destructive = false,
  detail,
  showChevron = true,
  borderBottom = true,
  colors,
}: {
  icon?: string;
  label: string;
  onPress?: () => void;
  destructive?: boolean;
  detail?: string;
  showChevron?: boolean;
  borderBottom?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        s.row,
        { borderBottomColor: colors.border, borderBottomWidth: borderBottom ? 1 : 0 },
        pressed && onPress ? { backgroundColor: colors.secondary } : {},
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={s.rowLeft}>
        {icon ? (
          <Feather
            name={icon as "settings"}
            size={18}
            color={destructive ? "#B50000" : colors.mutedForeground}
            style={s.rowIcon}
          />
        ) : null}
        <Text
          style={[
            s.rowLabel,
            { color: destructive ? "#B50000" : colors.foreground },
          ]}
        >
          {label}
        </Text>
      </View>
      <View style={s.rowRight}>
        {detail ? (
          <Text style={[s.rowDetail, { color: colors.mutedForeground }]}>{detail}</Text>
        ) : null}
        {showChevron && onPress ? (
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        ) : null}
      </View>
    </Pressable>
  );
}

function SettingsCard({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        s.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {children}
    </View>
  );
}

function DeleteModal({
  visible,
  onCancel,
  onConfirm,
  colors,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.modalOverlay}>
        <View style={[s.modalBox, { backgroundColor: colors.card }]}>
          <Text style={[s.modalTitle, { color: colors.foreground }]}>Delete Account</Text>
          <Text style={[s.modalBody, { color: colors.mutedForeground }]}>
            This will permanently delete your account, donation history, and all associated
            data. This action cannot be undone.
          </Text>
          <Text style={[s.modalBody, { color: colors.mutedForeground, marginTop: 8 }]}>
            To proceed, please email{" "}
            <Text style={{ color: "#B50000" }}>info@rootprojx.com</Text>{" "}
            from your registered address with the subject "Delete my account".
          </Text>
          <View style={s.modalBtns}>
            <Pressable
              style={[s.modalBtn, { backgroundColor: colors.secondary }]}
              onPress={onCancel}
            >
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.modalBtn, { backgroundColor: "#B50000" }]}
              onPress={onConfirm}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>I understand</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { logout } = useAuth();
  const [deleteVisible, setDeleteVisible] = useState(false);

  async function openInApp(url: string) {
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: "#B50000",
      controlsColor: "#F5B800",
    });
  }

  function handleLogout() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => { logout(); router.replace("/(tabs)"); } },
    ]);
  }

  function handleDeleteConfirm() {
    setDeleteVisible(false);
    Linking.openURL("mailto:info@rootprojx.com?subject=Delete%20my%20account");
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ACCOUNT */}
        <SectionHeader label="Account" />
        <SettingsCard colors={colors}>
          <SettingsRow
            icon="edit-2"
            label="Edit Profile"
            onPress={() => router.push("/(tabs)/account")}
            colors={colors}
          />
          <SettingsRow
            icon="lock"
            label="Change Password"
            onPress={() => Alert.alert("Coming soon", "Password management will be available in a future update.")}
            colors={colors}
          />
          <SettingsRow
            icon="bell"
            label="Notification Preferences"
            onPress={() => Alert.alert("Coming soon", "Notification settings will be available in a future update.")}
            borderBottom={false}
            colors={colors}
          />
        </SettingsCard>

        {/* LEGAL */}
        <SectionHeader label="Legal" />
        <SettingsCard colors={colors}>
          <SettingsRow
            icon="shield"
            label="Privacy Policy"
            onPress={() => openInApp("https://www.rootprojx.com/privacy")}
            colors={colors}
          />
          <SettingsRow
            icon="file-text"
            label="Fundraising Terms"
            onPress={() => openInApp("https://www.rootprojx.com/terms")}
            colors={colors}
          />
          <SettingsRow
            icon="check-circle"
            label="ICO Registration: ZC152619"
            showChevron={false}
            borderBottom={false}
            colors={colors}
          />
        </SettingsCard>

        {/* SUPPORT */}
        <SectionHeader label="Support" />
        <SettingsCard colors={colors}>
          <SettingsRow
            icon="mail"
            label="Contact Us"
            onPress={() => Linking.openURL("mailto:info@rootprojx.com")}
            colors={colors}
          />
          <SettingsRow
            icon="life-buoy"
            label="Get Help"
            onPress={() => router.push("/(tabs)/help")}
            borderBottom={false}
            colors={colors}
          />
        </SettingsCard>

        {/* ABOUT */}
        <SectionHeader label="About" />
        <SettingsCard colors={colors}>
          <SettingsRow
            icon="info"
            label="About Root ProjX"
            onPress={() => openInApp("https://www.rootprojx.com/about")}
            colors={colors}
          />
          <SettingsRow
            icon="smartphone"
            label="App Version"
            detail={APP_VERSION}
            showChevron={false}
            borderBottom={false}
            colors={colors}
          />
        </SettingsCard>

        {/* DANGER ZONE */}
        <SectionHeader label="Account" />
        <SettingsCard colors={colors}>
          <SettingsRow
            icon="log-out"
            label="Sign Out"
            onPress={handleLogout}
            destructive
            colors={colors}
          />
          <SettingsRow
            icon="trash-2"
            label="Delete Account"
            onPress={() => setDeleteVisible(true)}
            destructive
            borderBottom={false}
            colors={colors}
          />
        </SettingsCard>

      </ScrollView>

      <DeleteModal
        visible={deleteVisible}
        onCancel={() => setDeleteVisible(false)}
        onConfirm={handleDeleteConfirm}
        colors={colors}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#888888",
    marginTop: 24,
    marginBottom: 6,
    marginHorizontal: 20,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  rowIcon: { marginRight: 12 },
  rowLabel: { fontSize: 15 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowDetail: { fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 360,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  modalBody: { fontSize: 14, lineHeight: 21 },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
});
