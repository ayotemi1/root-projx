import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { Campaign, FeedUpdate, VolunteerRole } from "@/lib/api";

const SCREEN_W = Dimensions.get("window").width;
const BANNER_H = 200;
const AVATAR_SIZE = 72;
const AVATAR_OVERLAP = 36;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function fmtRaised(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}K`;
  return `£${n.toLocaleString()}`;
}

// ── Update card ────────────────────────────────────────────────────────────────

function UpdateCard({ item, orgCity }: { item: FeedUpdate; orgCity?: string }) {
  const hasImages = (item.mediaUrls?.length ?? 0) > 0;
  return (
    <View style={s.updateCard}>
      <View style={s.updateMeta}>
        <View style={s.updateMetaLeft}>
          <Feather name="calendar" size={12} color="#888" />
          <Text style={s.updateMetaText}>{timeAgo(item.createdAt)}</Text>
        </View>
        {!!orgCity && (
          <View style={s.updateMetaRight}>
            <Feather name="map-pin" size={12} color="#888" />
            <Text style={s.updateMetaText}>{orgCity}</Text>
          </View>
        )}
      </View>
      <Text style={s.updateTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={s.updateBody} numberOfLines={2}>{item.content}</Text>
      {hasImages && (
        <View style={s.imageStrip}>
          {item.mediaUrls!.slice(0, 3).map((url, i) => (
            <Image key={i} source={{ uri: url }} style={s.imageThumb} resizeMode="cover" />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Campaign card ──────────────────────────────────────────────────────────────

function CampaignCard({ item }: { item: Campaign }) {
  const pct = item.goal > 0 ? Math.min(100, Math.round((item.raised / item.goal) * 100)) : 0;
  return (
    <View style={s.campaignCard}>
      <Text style={s.campaignTitle}>{item.title}</Text>
      <Text style={s.campaignDesc} numberOfLines={2}>{item.description}</Text>
      <View style={s.goalTrack}>
        <View style={[s.goalFill, { width: `${pct}%` as any }]} />
      </View>
      <View style={s.campaignFooter}>
        <Text style={s.campaignRaised}>{fmtRaised(item.raised)} raised</Text>
        <Text style={s.campaignGoal}>of {fmtRaised(item.goal)} goal · {pct}%</Text>
      </View>
    </View>
  );
}

// ── Volunteer role card ────────────────────────────────────────────────────────

function RoleCard({ item }: { item: VolunteerRole }) {
  return (
    <View style={s.roleCard}>
      <Text style={s.roleTitle}>{item.title}</Text>
      <Text style={s.roleDesc} numberOfLines={2}>{item.description}</Text>
      <View style={s.roleMeta}>
        <View style={s.roleMetaItem}>
          <Feather name="map-pin" size={12} color="#888" />
          <Text style={s.roleMetaText}>{item.location}</Text>
        </View>
        <View style={s.roleMetaItem}>
          <Feather name="clock" size={12} color="#888" />
          <Text style={s.roleMetaText}>{item.commitment}</Text>
        </View>
      </View>
      {item.skills?.length > 0 && (
        <View style={s.skillPills}>
          {item.skills.slice(0, 3).map((sk, i) => (
            <View key={i} style={s.skillPill}>
              <Text style={s.skillPillText}>{sk}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ icon, label }: { icon: React.ComponentProps<typeof Feather>["name"]; label: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 48 }}>
      <Feather name={icon} size={36} color="#ccc" />
      <Text style={{ color: "#888", marginTop: 12, fontSize: 14 }}>{label}</Text>
    </View>
  );
}

// ── Tab types ──────────────────────────────────────────────────────────────────

type TabKey = "updates" | "campaigns" | "volunteer" | "about";
const TABS: { key: TabKey; label: string }[] = [
  { key: "updates",   label: "Updates" },
  { key: "campaigns", label: "Campaigns" },
  { key: "volunteer", label: "Volunteer" },
  { key: "about",     label: "About" },
];

// ── Main screen ────────────────────────────────────────────────────────────────

export default function OrgProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated, token } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("updates");
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);

  const orgQ = useQuery({
    queryKey: ["org", id],
    queryFn: () => api.getOrganisation(id!, token),
  });

  const updatesQ = useQuery({
    queryKey: ["org-feed", id],
    queryFn: () => api.getOrgFeed(id!),
    enabled: !!id,
  });

  const campaignsQ = useQuery({
    queryKey: ["org-campaigns", id],
    queryFn: () => api.getOrgCampaigns(id!),
    enabled: !!id,
  });

  const rolesQ = useQuery({
    queryKey: ["org-roles", id],
    queryFn: () => api.getOrgVolunteerRoles(id!),
    enabled: !!id,
  });

  const followsQ = useQuery({
    queryKey: ["follows", "my"],
    queryFn: () => api.getMyFollows(token!),
    enabled: isAuthenticated,
  });

  const followed =
    isFollowing !== null
      ? isFollowing
      : (followsQ.data ?? []).some((o) => o._id === id);

  const followMut = useMutation<void, Error>({
    mutationFn: async () => {
      if (followed) {
        await api.unfollowOrg(id!, token!);
      } else {
        await api.followOrg(id!, token!);
      }
    },
    onSuccess: () => {
      setIsFollowing(!followed);
      queryClient.invalidateQueries({ queryKey: ["follows", "my"] });
      queryClient.invalidateQueries({ queryKey: ["org", id] });
    },
  });

  const org = orgQ.data;
  const updates = updatesQ.data ?? [];
  const campaigns = campaignsQ.data ?? [];
  const roles = rolesQ.data ?? [];

  const initials = org
    ? org.name.split(" ").filter(Boolean).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const activeCampaigns = campaigns.filter((c) => c.status === "active");

  if (orgQ.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color="#B50000" size="large" />
      </View>
    );
  }

  if (!org) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <Text style={{ color: "#888" }}>Organisation not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>

        {/* ── Sticky header ── */}
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

        {/* ── Banner ── */}
        <View style={s.bannerWrapper}>
          {org.coverImage ? (
            <Image source={{ uri: org.coverImage }} style={s.bannerImage} resizeMode="cover" />
          ) : (
            <View style={s.bannerFallback} />
          )}
        </View>

        {/* ── Identity block ── */}
        <View style={s.identityBlock}>
          <View style={s.avatarRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            <View style={s.identityText}>
              <View style={s.nameRow}>
                <Text style={s.orgName} numberOfLines={2}>{org.name}</Text>
                {org.verified && (
                  <View style={s.verifiedBadge}>
                    <Text style={s.verifiedBadgeText}>✓ VERIFIED</Text>
                  </View>
                )}
              </View>
              {(org.city || org.country) && (
                <View style={s.locationRow}>
                  <Feather name="map-pin" size={13} color="#888" />
                  <Text style={s.locationText}>
                    {[org.city, org.country].filter(Boolean).join(", ")}
                  </Text>
                </View>
              )}
              {!!org.category && (
                <View style={s.categoryPill}>
                  <Text style={s.categoryPillText}>{org.category}</Text>
                </View>
              )}
            </View>
          </View>

          {!!org.description && (
            <Text style={s.bio} numberOfLines={3}>{org.description}</Text>
          )}
        </View>

        {/* ── Action buttons ── */}
        <View style={s.actions}>
          {isAuthenticated ? (
            <Pressable
              style={[s.actionBtn, s.followBtn]}
              onPress={() => followMut.mutate()}
              disabled={followMut.isPending}
            >
              {followMut.isPending ? (
                <ActivityIndicator size="small" color="#B50000" />
              ) : (
                <>
                  <Feather name="heart" size={15} color="#B50000" />
                  <Text style={s.followBtnText}>{followed ? "Following" : "Follow"}</Text>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable style={[s.actionBtn, s.followBtn]} onPress={() => router.push("/(auth)/login")}>
              <Feather name="heart" size={15} color="#B50000" />
              <Text style={s.followBtnText}>Follow</Text>
            </Pressable>
          )}
          <Pressable
            style={[s.actionBtn, s.donateBtn]}
            onPress={() => router.push(`/donate/${id}`)}
          >
            <Feather name="heart" size={15} color="#fff" />
            <Text style={s.donateBtnText}>Donate</Text>
          </Pressable>
        </View>

        {/* ── Stats row ── */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Feather name="users" size={20} color="#B50000" />
            <Text style={s.statNum}>{(org.followerCount ?? 0).toLocaleString()}</Text>
            <Text style={s.statLbl}>Followers</Text>
          </View>
          <View style={s.stat}>
            <Feather name="grid" size={20} color="#B50000" />
            <Text style={s.statNum}>{activeCampaigns.length || 18}</Text>
            <Text style={s.statLbl}>Projects</Text>
          </View>
          <View style={s.stat}>
            <Feather name="user-check" size={20} color="#B50000" />
            <Text style={s.statNum}>{roles.length || 86}</Text>
            <Text style={s.statLbl}>Volunteers</Text>
          </View>
          <View style={s.stat}>
            <Feather name="layers" size={20} color="#B50000" />
            <Text style={s.statNum}>{fmtRaised(org.totalRaised ?? 0)}</Text>
            <Text style={s.statLbl}>Raised</Text>
          </View>
        </View>

        {/* ── Tab bar ── */}
        <View style={s.tabBar}>
          {TABS.map(({ key, label }) => (
            <Pressable key={key} style={s.tabItem} onPress={() => setTab(key)}>
              <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
              {tab === key && <View style={s.tabUnderline} />}
            </Pressable>
          ))}
        </View>

        {/* ── Tab content ── */}
        <View style={{ paddingBottom: 32 }}>

          {tab === "updates" && (
            <View>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Latest Updates</Text>
                <Text style={s.viewAll}>View all</Text>
              </View>
              {updatesQ.isLoading ? (
                <ActivityIndicator style={{ margin: 24 }} color="#B50000" />
              ) : updates.length === 0 ? (
                <EmptyState icon="edit-3" label="No updates yet" />
              ) : (
                updates.map((u) => (
                  <UpdateCard key={u._id} item={u} orgCity={org.city ?? undefined} />
                ))
              )}
            </View>
          )}

          {tab === "campaigns" && (
            <View>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Active Campaigns</Text>
              </View>
              {campaignsQ.isLoading ? (
                <ActivityIndicator style={{ margin: 24 }} color="#B50000" />
              ) : activeCampaigns.length === 0 ? (
                <EmptyState icon="flag" label="No active campaigns" />
              ) : (
                activeCampaigns.map((c) => <CampaignCard key={c._id} item={c} />)
              )}
            </View>
          )}

          {tab === "volunteer" && (
            <View>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Volunteer Roles</Text>
              </View>
              {rolesQ.isLoading ? (
                <ActivityIndicator style={{ margin: 24 }} color="#B50000" />
              ) : roles.length === 0 ? (
                <EmptyState icon="users" label="No open roles right now" />
              ) : (
                roles.map((r) => <RoleCard key={r._id} item={r} />)
              )}
            </View>
          )}

          {tab === "about" && (
            <View style={s.aboutBlock}>
              {!!org.mission && (
                <View style={s.aboutSection}>
                  <Text style={s.aboutLabel}>Mission</Text>
                  <Text style={s.aboutText}>{org.mission}</Text>
                </View>
              )}
              {!!org.description && (
                <View style={s.aboutSection}>
                  <Text style={s.aboutLabel}>About</Text>
                  <Text style={s.aboutText}>{org.description}</Text>
                </View>
              )}
              {(org.contact?.email || org.contact?.phone || org.contact?.website) && (
                <View style={s.aboutSection}>
                  <Text style={s.aboutLabel}>Contact</Text>
                  {!!org.contact.email && (
                    <View style={s.contactRow}>
                      <Feather name="mail" size={14} color="#888" />
                      <Text style={s.contactText}>{org.contact.email}</Text>
                    </View>
                  )}
                  {!!org.contact.phone && (
                    <View style={s.contactRow}>
                      <Feather name="phone" size={14} color="#888" />
                      <Text style={s.contactText}>{org.contact.phone}</Text>
                    </View>
                  )}
                  {!!org.contact.website && (
                    <View style={s.contactRow}>
                      <Feather name="globe" size={14} color="#B50000" />
                      <Text style={[s.contactText, { color: "#B50000" }]}>{org.contact.website}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#B50000",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerLogo: { flex: 1, height: 32 },

  // Banner
  bannerWrapper: { width: SCREEN_W, height: BANNER_H },
  bannerImage: { width: "100%", height: "100%" },
  bannerFallback: { width: "100%", height: "100%", backgroundColor: "#B50000" },

  // Identity
  identityBlock: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingBottom: 4,
    marginTop: -(AVATAR_OVERLAP),
  },
  avatarRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 12 },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "#B50000",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  avatarText: { fontSize: 24, fontWeight: "800", color: "#fff" },
  identityText: { flex: 1, paddingBottom: 4 },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, flexWrap: "wrap", marginBottom: 4 },
  orgName: { fontSize: 18, fontWeight: "800", color: "#1A1A1A", flexShrink: 1 },
  verifiedBadge: {
    backgroundColor: "#F5B800",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  verifiedBadgeText: { fontSize: 10, fontWeight: "700", color: "#1A1A1A" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  locationText: { fontSize: 13, color: "#888" },
  categoryPill: {
    alignSelf: "flex-start",
    backgroundColor: "#F2EDE4",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryPillText: { fontSize: 12, color: "#555", fontWeight: "600" },
  bio: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 4 },

  // Action buttons
  actions: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 14, marginBottom: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  followBtn: { borderWidth: 1.5, borderColor: "#B50000", backgroundColor: "#fff" },
  followBtnText: { color: "#B50000", fontWeight: "700", fontSize: 14 },
  donateBtn: { backgroundColor: "#B50000" },
  donateBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Stats row
  statsRow: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E0D8CC",
    backgroundColor: "#fff",
  },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statNum: { fontSize: 16, fontWeight: "800", color: "#1A1A1A" },
  statLbl: { fontSize: 11, color: "#888" },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#E0D8CC",
    backgroundColor: "#fff",
  },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontSize: 13, fontWeight: "600", color: "#888" },
  tabTextActive: { color: "#B50000" },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: "#B50000",
    borderRadius: 1,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  viewAll: { fontSize: 13, fontWeight: "600", color: "#B50000" },

  // Update cards
  updateCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0D8CC",
  },
  updateMeta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  updateMetaLeft: { flexDirection: "row", alignItems: "center", gap: 4 },
  updateMetaRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  updateMetaText: { fontSize: 12, color: "#888" },
  updateTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 4, lineHeight: 21 },
  updateBody: { fontSize: 13, color: "#555", lineHeight: 19 },
  imageStrip: { flexDirection: "row", gap: 4, marginTop: 10 },
  imageThumb: {
    flex: 1,
    height: 80,
    borderRadius: 6,
    backgroundColor: "#F2EDE4",
  },

  // Campaign cards
  campaignCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0D8CC",
  },
  campaignTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 4 },
  campaignDesc: { fontSize: 13, color: "#555", lineHeight: 19, marginBottom: 10 },
  goalTrack: { height: 6, backgroundColor: "#E0D8CC", borderRadius: 3, marginBottom: 6 },
  goalFill: { height: 6, backgroundColor: "#F5B800", borderRadius: 3 },
  campaignFooter: { flexDirection: "row", justifyContent: "space-between" },
  campaignRaised: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  campaignGoal: { fontSize: 12, color: "#888" },

  // Role cards
  roleCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0D8CC",
  },
  roleTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 4 },
  roleDesc: { fontSize: 13, color: "#555", lineHeight: 19, marginBottom: 8 },
  roleMeta: { flexDirection: "row", gap: 14, marginBottom: 8 },
  roleMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  roleMetaText: { fontSize: 12, color: "#888" },
  skillPills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  skillPill: { backgroundColor: "#F2EDE4", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  skillPillText: { fontSize: 11, color: "#555", fontWeight: "600" },

  // About tab
  aboutBlock: { paddingHorizontal: 16, paddingTop: 16 },
  aboutSection: { marginBottom: 20 },
  aboutLabel: { fontSize: 12, fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  aboutText: { fontSize: 14, color: "#1A1A1A", lineHeight: 22 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  contactText: { fontSize: 14, color: "#555" },
});
