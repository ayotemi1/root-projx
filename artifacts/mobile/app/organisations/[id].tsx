import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { FeedUpdate, Review } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  milestone: { bg: "#E8F4E8", text: "#2E7D32" },
  campaign:  { bg: "#FFF8E1", text: "#F57F17" },
  update:    { bg: "#E3F2FD", text: "#1565C0" },
};

function UpdateRow({ item }: { item: FeedUpdate }) {
  const colors = useColors();
  const badge = TYPE_BADGE[item.type] ?? TYPE_BADGE.update!;
  return (
    <View style={{
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 20,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <View style={{ backgroundColor: badge.bg, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: badge.text }}>{item.type.toUpperCase()}</Text>
        </View>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{timeAgo(item.createdAt)}</Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>{item.title}</Text>
      <Text style={{ fontSize: 13, color: colors.foreground, marginTop: 4, lineHeight: 18 }} numberOfLines={3}>
        {item.content}
      </Text>
    </View>
  );
}

function ReviewRow({ item }: { item: Review }) {
  const colors = useColors();
  const stars = "★".repeat(item.rating) + "☆".repeat(5 - item.rating);
  return (
    <View style={{
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 20,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{item.authorName}</Text>
        <Text style={{ fontSize: 14, color: "#F5B800" }}>{stars}</Text>
      </View>
      <Text style={{ fontSize: 13, color: colors.foreground, marginTop: 6, lineHeight: 18 }}>{item.content}</Text>
      <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 4 }}>{timeAgo(item.createdAt)}</Text>
    </View>
  );
}

export default function OrgProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated, token } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"updates" | "reviews">("updates");
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

  const followMut = useMutation({
    mutationFn: () =>
      followed ? api.unfollowOrg(id!, token!) : api.followOrg(id!, token!),
    onSuccess: () => {
      setIsFollowing(!followed);
      queryClient.invalidateQueries({ queryKey: ["follows", "my"] });
      queryClient.invalidateQueries({ queryKey: ["org", id] });
    },
  });

  const org = orgQ.data;
  const s = styles(colors);

  if (orgQ.isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!org) {
    return (
      <View style={s.center}>
        <Text style={{ color: colors.mutedForeground }}>Organisation not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroContent}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>
                {org.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.orgName}>{org.name}</Text>
              <Text style={s.orgLocation}>
                {[org.city, org.country].filter(Boolean).join(", ")}
              </Text>
              <View style={s.categoryBadge}>
                <Text style={s.categoryText}>{org.category}</Text>
              </View>
            </View>
            {org.verified && (
              <View style={s.verifiedBadge}>
                <Text style={s.verifiedText}>✓ Verified</Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statNum}>{org.followerCount ?? 0}</Text>
              <Text style={s.statLbl}>Followers</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={s.statNum}>£{(org.totalRaised ?? 0).toLocaleString()}</Text>
              <Text style={s.statLbl}>Raised</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={s.statNum}>{org.impactScore ?? 0}</Text>
              <Text style={s.statLbl}>Impact Score</Text>
            </View>
          </View>

          {/* CTA buttons */}
          <View style={s.ctaRow}>
            {isAuthenticated && (
              <Pressable
                style={[s.followBtn, followed && s.followingBtn]}
                onPress={() => followMut.mutate()}
                disabled={followMut.isPending}
              >
                {followMut.isPending ? (
                  <ActivityIndicator
                    color={followed ? colors.primary : colors.primaryForeground}
                    size="small"
                  />
                ) : (
                  <Text style={[s.followBtnText, followed && s.followingBtnText]}>
                    {followed ? "Following" : "Follow"}
                  </Text>
                )}
              </Pressable>
            )}
            <Pressable
              style={s.donateBtn}
              onPress={() => router.push(`/donate/${id}`)}
            >
              <Text style={s.donateBtnText}>Donate</Text>
            </Pressable>
          </View>
        </View>

        {/* Description */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>About</Text>
          <Text style={s.body}>{org.description}</Text>
          {org.mission && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 14 }]}>Mission</Text>
              <Text style={s.body}>{org.mission}</Text>
            </>
          )}
        </View>

        {/* Tab selector */}
        <View style={s.tabRow}>
          {(["updates", "reviews"] as const).map((t) => (
            <Pressable
              key={t}
              style={[s.tabBtn, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === "updates" ? "Updates" : "Reviews"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        {tab === "updates" ? (
          updatesQ.isLoading ? (
            <ActivityIndicator style={{ margin: 20 }} color={colors.primary} />
          ) : (updatesQ.data ?? []).length === 0 ? (
            <Text style={s.emptyTab}>No updates yet.</Text>
          ) : (
            (updatesQ.data ?? []).map((u) => <UpdateRow key={u._id} item={u} />)
          )
        ) : (
          reviewsQ.isLoading ? (
            <ActivityIndicator style={{ margin: 20 }} color={colors.primary} />
          ) : (reviewsQ.data ?? []).length === 0 ? (
            <Text style={s.emptyTab}>No reviews yet.</Text>
          ) : (
            (reviewsQ.data ?? []).map((r) => <ReviewRow key={r._id} item={r} />)
          )
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    hero: {
      backgroundColor: c.navBackground,
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    heroContent: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
    avatarCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 22, fontWeight: "800", color: c.accentForeground },
    orgName: { fontSize: 18, fontWeight: "800", color: c.navForeground, flex: 1 },
    orgLocation: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 3 },
    categoryBadge: {
      alignSelf: "flex-start",
      marginTop: 6,
      backgroundColor: "rgba(245,184,0,0.3)",
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    categoryText: { fontSize: 11, fontWeight: "700", color: c.accent },
    verifiedBadge: {
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignSelf: "flex-start",
    },
    verifiedText: { fontSize: 11, fontWeight: "700", color: c.accent },
    statsRow: {
      flexDirection: "row",
      marginTop: 20,
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRadius: c.radius,
      padding: 12,
    },
    stat: { flex: 1, alignItems: "center" },
    statNum: { fontSize: 18, fontWeight: "800", color: c.navForeground },
    statLbl: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },
    statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)" },
    ctaRow: { flexDirection: "row", gap: 10, marginTop: 16 },
    followBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: c.radius,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: c.navForeground,
    },
    followingBtn: { backgroundColor: c.navForeground },
    followBtnText: { color: c.navForeground, fontWeight: "700", fontSize: 14 },
    followingBtnText: { color: c.navBackground },
    donateBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: c.radius,
      alignItems: "center",
      backgroundColor: c.accent,
    },
    donateBtnText: { color: c.accentForeground, fontWeight: "800", fontSize: 14 },
    section: { paddingHorizontal: 20, paddingVertical: 16 },
    sectionTitle: { fontSize: 13, fontWeight: "700", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 8 },
    body: { fontSize: 14, color: c.foreground, lineHeight: 21 },
    tabRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.background,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 14,
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: { borderBottomColor: c.primary },
    tabText: { fontSize: 14, fontWeight: "600", color: c.mutedForeground },
    tabTextActive: { color: c.primary },
    emptyTab: { color: c.mutedForeground, textAlign: "center", padding: 24 },
  });
