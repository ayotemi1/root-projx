import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";

type MenuItem = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  route: string;
  authRequired?: boolean;
  hideIfAuth?: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  { label: "Dashboard", icon: "bar-chart-2", route: "/dashboard", authRequired: true },
  { label: "My Donations", icon: "heart", route: "/dashboard", authRequired: true },
  { label: "Shop", icon: "shopping-bag", route: "/shop" },
  { label: "About Root ProjX", icon: "info", route: "/about" },
  { label: "Sign in", icon: "log-in", route: "/(auth)/login", hideIfAuth: true },
  { label: "Join as supporter", icon: "user-plus", route: "/(auth)/register", hideIfAuth: true },
  { label: "Join as organisation", icon: "briefcase", route: "/(auth)/register-org", hideIfAuth: true },
];

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  const visible = MENU_ITEMS.filter((item) => {
    if (item.authRequired && !isAuthenticated) return false;
    if (item.hideIfAuth && isAuthenticated) return false;
    return true;
  });

  function navigate(route: string) {
    setOpen(false);
    setTimeout(() => router.push(route as never), 150);
  }

  return (
    <>
      <Pressable
        style={s.trigger}
        onPress={() => setOpen(true)}
        hitSlop={10}
      >
        <Feather name="menu" size={22} color="#FFFFFF" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[
              s.panel,
              { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
            ]}
          >
            <View style={s.panelHeader}>
              <Text style={s.panelTitle}>Menu</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={s.divider} />

            {visible.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={s.menuItem}
                onPress={() => navigate(item.route)}
                activeOpacity={0.7}
              >
                <View style={s.menuIconWrap}>
                  <Feather name={item.icon} size={18} color="#F5B800" />
                </View>
                <Text style={s.menuLabel}>{item.label}</Text>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.35)" />
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger: {
    marginRight: 16,
    padding: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  panel: {
    width: "75%",
    height: "100%",
    backgroundColor: "#B50000",
    paddingHorizontal: 0,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  panelTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  menuIconWrap: {
    width: 32,
    alignItems: "center",
  },
  menuLabel: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
