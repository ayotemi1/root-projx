import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as api from "@/lib/api";
import type { VolunteerRole } from "@/lib/api";

// ── Placeholder roles ──────────────────────────────────────────────────────────

const PLACEHOLDERS: VolunteerRole[] = [
  {
    _id: "ph_r1",
    title: "Graphic Designer",
    description: "Create visual content for campaigns and social media.",
    location: "Remote",
    commitment: "Flexible hours",
    skills: ["Design", "Illustrator", "Canva"],
    createdAt: new Date().toISOString(),
  },
  {
    _id: "ph_r2",
    title: "Mentorship Support",
    description: "Work one-on-one with young people building their futures.",
    location: "Local",
    commitment: "Weekly",
    skills: ["Communication", "Coaching"],
    createdAt: new Date().toISOString(),
  },
  {
    _id: "ph_r3",
    title: "Event Support",
    description: "Help set up and run community events and workshops.",
    location: "Local",
    commitment: "Occasional",
    skills: ["Organisation", "People skills"],
    createdAt: new Date().toISOString(),
  },
  {
    _id: "ph_r4",
    title: "Social Media Assistant",
    description: "Grow our online presence across Instagram and Twitter.",
    location: "Remote",
    commitment: "Flexible hours",
    skills: ["Social media", "Writing"],
    createdAt: new Date().toISOString(),
  },
  {
    _id: "ph_r5",
    title: "Fundraising Support",
    description: "Help plan and execute fundraising drives and campaigns.",
    location: "Remote",
    commitment: "Flexible hours",
    skills: ["Fundraising", "Communication"],
    createdAt: new Date().toISOString(),
  },
  {
    _id: "ph_r6",
    title: "Administrative Support",
    description: "Keep our operations running smoothly behind the scenes.",
    location: "Remote",
    commitment: "Flexible hours",
    skills: ["Admin", "Microsoft Office"],
    createdAt: new Date().toISOString(),
  },
];

// Icon mapping: pick a Feather icon per role title keyword
function roleIcon(title: string): React.ComponentProps<typeof Feather>["name"] {
  const t = title.toLowerCase();
  if (t.includes("design") || t.includes("graphic")) return "pen-tool";
  if (t.includes("mentor")) return "users";
  if (t.includes("event")) return "calendar";
  if (t.includes("social") || t.includes("media")) return "smartphone";
  if (t.includes("fundrais")) return "heart";
  if (t.includes("admin")) return "briefcase";
  if (t.includes("teach") || t.includes("educat")) return "book";
  if (t.includes("tech") || t.includes("develop")) return "code";
  return "user-check";
}

const FILTER_CHIPS = ["All", "Local", "Remote", "Short Term", "Long Term"] as const;
type FilterChip = typeof FILTER_CHIPS[number];

function matchesFilter(role: VolunteerRole, filter: FilterChip): boolean {
  if (filter === "All") return true;
  if (filter === "Local") return role.location?.toLowerCase() === "local";
  if (filter === "Remote") return role.location?.toLowerCase() === "remote";
  if (filter === "Short Term") {
    const c = role.commitment?.toLowerCase() ?? "";
    return c.includes("occasional") || c.includes("short") || c.includes("once");
  }
  if (filter === "Long Term") {
    const c = role.commitment?.toLowerCase() ?? "";
    return c.includes("weekly") || c.includes("long") || c.includes("ongoing");
  }
  return true;
}

// ── Role row ──────────────────────────────────────────────────────────────────

function RoleRow({ item, onPress }: { item: VolunteerRole; onPress: () => void }) {
  return (
    <Pressable style={s.roleRow} onPress={onPress} android_ripple={{ color: "rgba(0,0,0,0.05)" }}>
      <View style={s.roleIcon}>
        <Feather name={roleIcon(item.title)} size={20} color="#1A1A1A" />
      </View>
      <View style={s.roleText}>
        <Text style={s.roleTitle}>{item.title}</Text>
        <Text style={s.roleMeta}>{item.location} · {item.commitment}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#888" />
    </Pressable>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function VolunteerScreen() {
  const router = useRouter();
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const [activeFilter, setActiveFilter] = useState<FilterChip>("All");

  const rolesQ = useQuery({
    queryKey: ["org-roles", orgId],
    queryFn: () => api.getOrgVolunteerRoles(orgId!),
    enabled: !!orgId,
  });

  const allRoles =
    rolesQ.data && rolesQ.data.length > 0 ? rolesQ.data : PLACEHOLDERS;

  const shown = allRoles.filter((r) => matchesFilter(r, activeFilter));

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.headerBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Image
          source={require("@/assets/images/logo.png")}
          style={s.headerLogo}
          resizeMode="contain"
        />
        <TouchableOpacity hitSlop={12} style={s.headerBtn}>
          <Feather name="more-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Heading ── */}
        <View style={s.headingBlock}>
          <Text style={s.heading}>Ways to Volunteer</Text>
          <Text style={s.subheading}>
            Your time and skills can make a real difference in the lives of young people.
          </Text>
        </View>

        {/* ── Filter chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
          style={s.chipsScroll}
        >
          {FILTER_CHIPS.map((chip) => (
            <Pressable
              key={chip}
              style={[s.chip, activeFilter === chip && s.chipActive]}
              onPress={() => setActiveFilter(chip)}
            >
              <Text style={[s.chipText, activeFilter === chip && s.chipTextActive]}>
                {chip}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Roles list ── */}
        <View style={s.rolesList}>
          {rolesQ.isLoading ? (
            <ActivityIndicator style={{ marginVertical: 48 }} color="#B50000" size="large" />
          ) : shown.length === 0 ? (
            <View style={s.empty}>
              <Feather name="users" size={36} color="#ccc" />
              <Text style={s.emptyText}>No roles match this filter</Text>
            </View>
          ) : (
            shown.map((role, i) => (
              <React.Fragment key={role._id}>
                <RoleRow item={role} onPress={() => {}} />
                {i < shown.length - 1 && <View style={s.divider} />}
              </React.Fragment>
            ))
          )}
        </View>

        {/* ── Apply button ── */}
        <View style={s.bottomSection}>
          <Pressable style={s.applyBtn}>
            <Text style={s.applyBtnText}>Apply to Volunteer</Text>
          </Pressable>

          {/* Have a skill not listed? */}
          <Pressable style={s.skillRow}>
            <View style={s.skillRowLeft}>
              <View style={s.plusCircle}>
                <Feather name="plus" size={16} color="#B50000" />
              </View>
              <View>
                <Text style={s.skillRowTitle}>Have a skill not listed?</Text>
                <Text style={s.skillRowSub}>Tell us how you'd like to help.</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="#888" />
          </Pressable>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F9F6F0" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#B50000",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerLogo: { flex: 1, height: 32 },

  scroll: { flex: 1 },

  headingBlock: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  heading: { fontSize: 22, fontWeight: "800", color: "#1A1A1A", marginBottom: 6 },
  subheading: { fontSize: 14, color: "#666", lineHeight: 20 },

  chipsScroll: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#E0D8CC",
  },
  chipsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E0D8CC",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#B50000", borderColor: "#B50000" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#555" },
  chipTextActive: { color: "#fff" },

  rolesList: {
    backgroundColor: "#fff",
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: "#fff",
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F5B800",
    alignItems: "center",
    justifyContent: "center",
  },
  roleText: { flex: 1 },
  roleTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 3 },
  roleMeta: { fontSize: 13, color: "#888" },
  divider: {
    height: 1,
    backgroundColor: "#F2EDE4",
    marginLeft: 74,
  },

  bottomSection: { paddingHorizontal: 16, paddingTop: 20 },
  applyBtn: {
    backgroundColor: "#B50000",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  applyBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  skillRowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  plusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#B50000",
    alignItems: "center",
    justifyContent: "center",
  },
  skillRowTitle: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  skillRowSub: { fontSize: 12, color: "#888", marginTop: 2 },

  empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, color: "#888" },
});
