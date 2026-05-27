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
import type { FeedUpdate, Review } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const SCREEN_W = Dimensions.get("window").width;
const GRID_CELL = (SCREEN_W - 3) / 3; // 1px gaps

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

const TYPE_COLOUR: Record<string, { bg: string; fg: string }> = {
  milestone: { bg: "#E8F4E8", fg: "#2E7D32" },
  campaign:  { bg: "#FFF8E1", fg: "#F57F17" },
  update:    { bg: "#E3F2FD", fg: "#1565C0" },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function MediaGrid({ updates }: { updates: FeedUpdate[] }) {
  const allMedia = updates.flatMap((u) => u.mediaUrls ?? []);
  if (allMedia.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 48 }}>
        <Feather name="image" size={40} color="#ccc" />
        <Text style={{ color: "#888", marginTop: 12, fontSize: 14 }}>No photos yet</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 1.5 }}>
      {allMedia.map((url, i) => (
        <Image
          key={i}
          source={{ uri: url }}
          style={{ width: GRID_CELL, height: GRID_CELL }}
          resizeMode="cover"
        />
      ))}
    </View>
  );
}

function UpdateCard({ item }: { item: FeedUpdate }) {
  const colors = useColors();
  const badge = TYPE_COLOUR[item.type] ?? TYPE_COLOUR.update!;
  const cover = item.mediaUrls?.[0] ?? item.imageUrl;
  return (
    <View style={{
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 12,
      backgroundColor: colors.card,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    }}>
      {!!cover && (
        <Image source={{ uri: cover }} style={{ width: "100%", height: 180 }} resizeMode="cover" />
      )}
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <View style={{ backgroundColor: badge.bg, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: badge.fg }}>{item.type.toUpperCase()}</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{timeAgo(item.createdAt)}</Text>
          {item.likes > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginLeft: "auto" }}>
              <Feather name="heart" size={12} color="#B50000" />
              <Text style={{ fontSize: 12, color: "#B50000", fontWeight: "600" }}>{item.likes}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>
          {item.title}
        </Text>
        <Text style={{ fontSize: 13, color: colors.foreground, lineHeight: 19 }} numberOfLines={4}>
          {item.content}
        </Text>
        {(item.mediaUrls?.length ?? 0) > 1 && (
          <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 6 }}>
            +{item.mediaUrls!.length - 1} more photo{item.mediaUrls!.length > 2 ? "s" : ""}
          </Text>
        )}
      </View>
    </View>
  );
}

function ReviewCard({ item }: { item: Review }) {
  const colors = useColors();
  const filled = Math.round(item.rating);
  return (
    <View style={{
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: colors.card,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{item.authorName}</Text>
          {item.verified && (
            <Text style={{ fontSize: 11, color: "#2E7D32", marginTop: 1 }}>✓ Verified visitor</Text>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Feather key={n} name="star" size={13}
              color={n <= filled ? "#F5B800" : "#ddd"}
              style={{ marginLeft: 1 }}
            />
          ))}
        </View>
      </View>
      <Text style={{ fontSize: 13, color: colors.foreground, marginTop: 8, lineHeight: 19 }}>
        {item.content}
      </Text>
      <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 6 }}>{timeAgo(item.createdAt)}</Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

type TabKey = "grid" | "posts" | "reviews";

export default function OrgProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated, token } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("posts");
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

  const reviewsQ = useQuery({
    queryKey: ["org-reviews", id],
    queryFn: () => api.getOrgReviews(id!),
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
  const reviews = reviewsQ.data ?? [];
  const postCount = updates.length;

  // Initials from org name
  const initials = org
    ? org.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  if (orgQ.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!org) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <Text style={{ color: colors.mutedForeground }}>Organisation not found.</Text>
      </View>
    );
  }

  const hasWebsite = !!org.contact?.website;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>

        {/* ── Sticky top bar ── */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.topBarBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.topBarTitle} numberOfLines={1}>{org.name}</Text>
          {hasWebsite ? (
            <TouchableOpacity hitSlop={12} style={s.topBarBtn}>
              <Feather name="external-link" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={s.topBarBtn} />
          )}
        </View>

        {/* ── Banner ── */}
        <View style={s.banner} />

        {/* ── Avatar (overlaps banner) ── */}
        <View style={s.profileSection}>
          <View style={s.avatarWrapper}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            {org.verified && (
              <View style={s.verifiedDot}>
                <Feather name="check" size={11} color="#fff" />
              </View>
            )}
          </View>

          {/* Name + meta */}
          <View style={s.nameBlock}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={s.orgName}>{org.name}</Text>
              {org.verified && (
                <View style={s.verifiedPill}>
                  <Text style={s.verifiedText}>✓ Verified</Text>
                </View>
              )}
            </View>
            <Text style={s.orgSub}>
              {[org.category, org.city, org.country].filter(Boolean).join(" · ")}
            </Text>
          </View>

          {/* Bio */}
          {!!org.description && (
            <Text style={s.bio} numberOfLines={3}>{org.description}</Text>
          )}
          {!!org.mission && (
            <Text style={s.mission} numberOfLines={2}>💡 {org.mission}</Text>
          )}
          {hasWebsite && (
            <Text style={s.website}>{org.contact!.website}</Text>
          )}

          {/* ── Stats ── */}
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statNum}>{postCount}</Text>
              <Text style={s.statLbl}>Posts</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={s.statNum}>{(org.followerCount ?? 0).toLocaleString()}</Text>
              <Text style={s.statLbl}>Followers</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={s.statNum}>£{(org.totalRaised ?? 0).toLocaleString()}</Text>
              <Text style={s.statLbl}>Raised</Text>
            </View>
          </View>

          {/* ── Action buttons ── */}
          <View style={s.actions}>
            {isAuthenticated && (
              <Pressable
                style={[s.actionBtn, followed ? s.actionBtnFilled : s.actionBtnOutline]}
                onPress={() => followMut.mutate()}
                disabled={followMut.isPending}
              >
                {followMut.isPending ? (
                  <ActivityIndicator size="small" color={followed ? "#B50000" : "#fff"} />
                ) : (
                  <Text style={followed ? s.actionBtnFilledText : s.actionBtnOutlineText}>
                    {followed ? "Following" : "Follow"}
                  </Text>
                )}
              </Pressable>
            )}
            <Pressable
              style={[s.actionBtn, s.donateBtn]}
              onPress={() => router.push(`/donate/${id}`)}
            >
              <Text style={s.donateBtnText}>Donate</Text>
            </Pressable>
            {!!org.contact?.email && (
              <Pressable style={[s.actionBtn, s.contactBtn]}>
                <Feather name="mail" size={16} color="#B50000" />
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Tab bar ── */}
        <View style={s.tabBar}>
          {([
            { key: "grid",    icon: "grid" },
            { key: "posts",   icon: "list" },
            { key: "reviews", icon: "star" },
          ] as { key: TabKey; icon: React.ComponentProps<typeof Feather>["name"] }[]).map(({ key, icon }) => (
            <Pressable
              key={key}
              style={[s.tabItem, tab === key && s.tabItemActive]}
              onPress={() => setTab(key)}
            >
              <Feather
                name={icon}
                size={20}
                color={tab === key ? "#B50000" : "#888"}
              />
            </Pressable>
          ))}
        </View>

        {/* ── Tab content ── */}
        {tab === "grid" && (
          updatesQ.isLoading
            ? <ActivityIndicator style={{ margin: 24 }} color="#B50000" />
            : <MediaGrid updates={updates} />
        )}

        {tab === "posts" && (
          <View style={{ paddingTop: 16 }}>
            {updatesQ.isLoading
              ? <ActivityIndicator style={{ margin: 24 }} color="#B50000" />
              : updates.length === 0
                ? <EmptyState icon="edit-3" label="No updates yet" />
                : updates.map((u) => <UpdateCard key={u._id} item={u} />)
            }
          </View>
        )}

        {tab === "reviews" && (
          <View style={{ paddingTop: 16 }}>
            {reviewsQ.isLoading
              ? <ActivityIndicator style={{ margin: 24 }} color="#B50000" />
              : reviews.length === 0
                ? <EmptyState icon="star" label="No reviews yet" />
                : reviews.map((r) => <ReviewCard key={r._id} item={r} />)
            }
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyState({ icon, label }: { icon: React.ComponentProps<typeof Feather>["name"]; label: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 48 }}>
      <Feather name={icon} size={36} color="#ccc" />
      <Text style={{ color: "#888", marginTop: 12, fontSize: 14 }}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#B50000",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  topBarBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: "#fff", textAlign: "center" },

  // Banner
  banner: {
    height: 120,
    backgroundColor: "#B50000",
  },

  // Profile section (white card area)
  profileSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingBottom: 4,
    marginTop: -1,
  },

  // Avatar
  avatarWrapper: {
    marginTop: -44,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#B50000",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  avatarText: { fontSize: 32, fontWeight: "800", color: "#F5B800" },
  verifiedDot: {
    position: "absolute",
    bottom: 4,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  // Name block
  nameBlock: { marginBottom: 8 },
  orgName: { fontSize: 20, fontWeight: "800", color: "#1A1A1A" },
  orgSub: { fontSize: 13, color: "#888", marginTop: 3 },
  verifiedPill: {
    backgroundColor: "#E8F4E8",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifiedText: { fontSize: 11, fontWeight: "700", color: "#2E7D32" },

  // Bio
  bio: { fontSize: 14, color: "#1A1A1A", lineHeight: 20, marginBottom: 4 },
  mission: { fontSize: 13, color: "#555", lineHeight: 18, marginBottom: 6 },
  website: { fontSize: 13, color: "#B50000", fontWeight: "600", marginBottom: 8 },

  // Stats
  statsRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E0D8CC",
    borderRadius: 12,
    paddingVertical: 14,
    marginVertical: 14,
    backgroundColor: "#F9F6F0",
  },
  stat: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 18, fontWeight: "800", color: "#1A1A1A" },
  statLbl: { fontSize: 11, color: "#888", marginTop: 3 },
  statDivider: { width: 1, backgroundColor: "#E0D8CC" },

  // Action buttons
  actions: { flexDirection: "row", gap: 10, marginBottom: 20 },
  actionBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnOutline: { borderWidth: 1.5, borderColor: "#B50000" },
  actionBtnFilled: { backgroundColor: "#F9F6F0", borderWidth: 1.5, borderColor: "#B50000" },
  actionBtnOutlineText: { color: "#B50000", fontWeight: "700", fontSize: 14 },
  actionBtnFilledText: { color: "#B50000", fontWeight: "700", fontSize: 14 },
  donateBtn: { backgroundColor: "#F5B800" },
  donateBtnText: { color: "#1A1A1A", fontWeight: "800", fontSize: 14 },
  contactBtn: { flex: 0, paddingHorizontal: 14, borderWidth: 1.5, borderColor: "#E0D8CC", backgroundColor: "#F9F6F0" },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E0D8CC",
    backgroundColor: "#fff",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: { borderBottomColor: "#B50000" },
});
