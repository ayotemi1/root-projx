import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { FeedUpdate } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

/** Detect video by file extension embedded in the Firebase Storage URL. */
function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return [".mp4", ".mov", ".webm", ".avi", ".m4v", ".ogv"].some((ext) =>
    lower.includes(ext),
  );
}

const TYPE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  milestone: { bg: "#E8F4E8", text: "#2E7D32", label: "Milestone" },
  campaign:  { bg: "#FFF8E1", text: "#F57F17", label: "Campaign" },
  update:    { bg: "#E3F2FD", text: "#1565C0", label: "Update" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function PostCard({ item }: { item: FeedUpdate }) {
  const colors = useColors();
  const router = useRouter();
  const typeConfig = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.update!;
  const initials = item.orgName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const mediaUrls = item.mediaUrls ?? [];
  // First photo to use as full-width hero; fall back to legacy imageUrl
  const heroPhoto = mediaUrls.find((u) => !isVideoUrl(u)) ?? item.imageUrl ?? null;
  // First video — shown as a dedicated hero block when no photo is available
  const firstVideo = mediaUrls.find((u) => isVideoUrl(u)) ?? null;
  const showVideoHero = !heroPhoto && !!firstVideo;
  // Extra thumbnails: everything except the item already shown as hero
  const extraMedia = mediaUrls.filter(
    (u) => u !== heroPhoto && !(showVideoHero && u === firstVideo),
  );
  const hasMedia = mediaUrls.length > 0;

  return (
    <Pressable
      style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/organisations/${item.orgId}`)}
    >
      <View style={s.cardTop}>
        <View style={[s.avatar, { backgroundColor: colors.primary }]}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.orgName, { color: colors.foreground }]} numberOfLines={1}>{item.orgName}</Text>
          <Text style={[s.date, { color: colors.mutedForeground }]}>{timeAgo(item.createdAt)}</Text>
        </View>
        <View style={[s.typePill, { backgroundColor: typeConfig.bg }]}>
          <Text style={[s.typePillText, { color: typeConfig.text }]}>{typeConfig.label.toUpperCase()}</Text>
        </View>
      </View>

      {/* Hero: first photo, full width */}
      {heroPhoto ? (
        <Image source={{ uri: heroPhoto }} style={s.postImage} resizeMode="cover" />
      ) : null}

      {/* Hero: video-only post — prominent play area */}
      {showVideoHero && (
        <View style={[s.videoHero, { backgroundColor: colors.secondary }]}>
          <Text style={s.videoHeroIcon}>🎬</Text>
          <Text style={[s.videoHeroLabel, { color: colors.mutedForeground }]}>Video update</Text>
        </View>
      )}

      <View style={s.cardBody}>
        <Text style={[s.postTitle, { color: colors.foreground }]}>{item.title}</Text>
        <Text style={[s.postContent, { color: colors.foreground }]} numberOfLines={3}>
          {item.content}
        </Text>

        {/* Scrollable thumbnail strip for additional media */}
        {extraMedia.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
            contentContainerStyle={{ gap: 6 }}
          >
            {extraMedia.map((url, i) =>
              isVideoUrl(url) ? (
                <View
                  key={i}
                  style={[s.mediaThumbnail, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 22 }}>🎬</Text>
                </View>
              ) : (
                <Image
                  key={i}
                  source={{ uri: url }}
                  style={[s.mediaThumbnail, { borderColor: colors.border }]}
                  resizeMode="cover"
                />
              ),
            )}
          </ScrollView>
        )}
      </View>

      <View style={[s.cardFooter, { borderTopColor: colors.border }]}>
        <Text style={[s.likes, { color: colors.mutedForeground }]}>
          ♥ {item.likes ?? 0} likes
          {hasMedia ? `  ·  📷 ${mediaUrls.length}` : ""}
        </Text>
        <Text style={[s.readMore, { color: colors.primary }]}>View org →</Text>
      </View>
    </Pressable>
  );
}

export default function FeedScreen() {
  const colors = useColors();
  const { isAuthenticated, token } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"public" | "mine">("public");

  const publicQ = useQuery({
    queryKey: ["feed", "public"],
    queryFn: api.getPublicFeed,
    enabled: mode === "public",
  });

  const mineQ = useQuery({
    queryKey: ["feed", "mine"],
    queryFn: () => api.getMyFeed(token!),
    enabled: mode === "mine" && isAuthenticated,
  });

  const active = mode === "mine" && isAuthenticated ? mineQ : publicQ;
  const { data: updates = [], isLoading, isError, refetch } = active;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={[]}>
      <View style={[s.toggleBar, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
        {(["public", "mine"] as const).map((m) => {
          const disabled = m === "mine" && !isAuthenticated;
          return (
            <Pressable
              key={m}
              style={[
                s.toggleBtn,
                mode === m && [s.toggleActive, { backgroundColor: colors.primary }],
                disabled && { opacity: 0.4 },
              ]}
              onPress={() => {
                if (disabled) {
                  router.push("/(auth)/login");
                  return;
                }
                setMode(m);
              }}
            >
              <Text style={[
                s.toggleText,
                { color: mode === m ? "#fff" : colors.mutedForeground },
              ]}>
                {m === "public" ? "All Updates" : "For You"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
      ) : isError ? (
        <View style={s.center}>
          <Text style={{ color: colors.destructive, marginBottom: 12 }}>Could not load updates.</Text>
          <Pressable style={[s.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
          </Pressable>
        </View>
      ) : updates.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}>
            <Text style={{ fontSize: 36 }}>📣</Text>
          </View>
          <Text style={[s.emptyHeading, { color: colors.foreground }]}>Nothing here yet</Text>
          <Text style={[s.emptySubtext, { color: colors.mutedForeground }]}>
            {mode === "mine"
              ? "Follow organisations to see their updates here."
              : "No community updates yet. Check back soon."}
          </Text>
          {mode === "mine" && (
            <Pressable
              style={[s.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/")}
            >
              <Text style={s.emptyBtnText}>Discover Organisations</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={updates}
          keyExtractor={(u) => u._id}
          renderItem={({ item }) => <PostCard item={item} />}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  toggleBar: {
    flexDirection: "row",
    padding: 6,
    gap: 6,
    borderBottomWidth: 1,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
  },
  toggleActive: {},
  toggleText: { fontWeight: "700", fontSize: 13 },
  card: {
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "rgba(0,0,0,0.06)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  orgName: { fontSize: 14, fontWeight: "700" },
  date: { fontSize: 12, marginTop: 1 },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  typePillText: { fontSize: 10, fontWeight: "800" },
  postImage: {
    width: "100%",
    height: 200,
  },
  cardBody: {
    padding: 14,
    paddingTop: 10,
  },
  postTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  postContent: { fontSize: 13, lineHeight: 19 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  likes: { fontSize: 13 },
  readMore: { fontSize: 13, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(181,0,0,0.08)", alignItems: "center", justifyContent: "center" },
  emptyHeading: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptySubtext: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 11, marginTop: 4 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  retryBtn: { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  mediaThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  videoHero: {
    width: "100%",
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  videoHeroIcon: { fontSize: 40 },
  videoHeroLabel: { fontSize: 13, fontWeight: "600" },
});
