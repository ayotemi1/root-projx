import { useQuery } from "@tanstack/react-query";
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

import * as api from "@/lib/api";
import type { FeedUpdate } from "@/lib/api";

const SCREEN_W = Dimensions.get("window").width;
const CARD_PAD = 14;
const IMG_FULL_H = 200;
const IMG_MULTI_H = 100;
const GRID_CELL = (SCREEN_W - 4) / 3;

// ── Placeholder data ───────────────────────────────────────────────────────────

const PLACEHOLDERS: FeedUpdate[] = [
  {
    _id: "ph_u1",
    orgId: "",
    orgName: "",
    type: "milestone",
    title: "50 young people complete our carpentry programme",
    content:
      "We are proud to announce that 50 graduates from our 12-week carpentry and joinery programme received their certificates last Friday. This milestone represents months of hard work, dedication, and community support.",
    mediaUrls: [],
    imageUrl: null,
    likes: 87,
    comments: 12,
    location: "Kingston",
    createdAt: new Date(Date.now() - 2 * 864e5).toISOString(),
  },
  {
    _id: "ph_u2",
    orgId: "",
    orgName: "",
    type: "update",
    title: "Community garden project update",
    content:
      "Our community garden in Spanish Town has produced its first full harvest of the season. Families across the neighbourhood have been collecting fresh produce every weekend.",
    mediaUrls: [],
    imageUrl: null,
    likes: 45,
    comments: 8,
    location: "Kingston",
    createdAt: new Date(Date.now() - 7 * 864e5).toISOString(),
  },
  {
    _id: "ph_u3",
    orgId: "",
    orgName: "",
    type: "update",
    title: "Guest speaker session — Dr. Patricia Brown",
    content:
      "Last Tuesday we hosted Dr. Patricia Brown, a leading education advocate, for an inspiring talk on youth empowerment and building resilience. Over 120 young people attended.",
    mediaUrls: [],
    imageUrl: null,
    likes: 60,
    comments: 5,
    location: "Kingston",
    createdAt: new Date(Date.now() - 14 * 864e5).toISOString(),
  },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} week${Math.floor(d / 7) > 1 ? "s" : ""} ago`;
  return `${Math.floor(d / 30)} month${Math.floor(d / 30) > 1 ? "s" : ""} ago`;
}

// ── Image layout ───────────────────────────────────────────────────────────────

function UpdateImages({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  if (urls.length === 1) {
    return (
      <Image
        source={{ uri: urls[0] }}
        style={s.imgFull}
        resizeMode="cover"
      />
    );
  }
  // 3-image layout: 1 large left, 2 stacked right
  const large = urls[0]!;
  const sm1 = urls[1]!;
  const sm2 = urls[2];
  const halfW = (SCREEN_W - CARD_PAD * 2 - 4) / 2;
  return (
    <View style={s.imgMultiRow}>
      <Image
        source={{ uri: large }}
        style={[s.imgMultiLarge, { width: halfW }]}
        resizeMode="cover"
      />
      <View style={[s.imgMultiStack, { width: halfW }]}>
        <Image source={{ uri: sm1 }} style={s.imgMultiSm} resizeMode="cover" />
        {sm2 ? (
          <Image source={{ uri: sm2 }} style={[s.imgMultiSm, { marginTop: 4 }]} resizeMode="cover" />
        ) : (
          <View style={[s.imgMultiSm, { marginTop: 4, backgroundColor: "#F2EDE4" }]} />
        )}
      </View>
    </View>
  );
}

// ── Update card ────────────────────────────────────────────────────────────────

function UpdateCard({ item }: { item: FeedUpdate }) {
  const images = item.mediaUrls?.length ? item.mediaUrls : (item.imageUrl ? [item.imageUrl] : []);
  return (
    <View style={s.card}>
      {/* Meta row */}
      <View style={s.metaRow}>
        <View style={s.metaLeft}>
          <Feather name="calendar" size={13} color="#888" />
          <Text style={s.metaText}>{timeAgo(item.createdAt)}</Text>
        </View>
        {!!item.location && (
          <View style={s.metaRight}>
            <Feather name="map-pin" size={13} color="#888" />
            <Text style={s.metaText}>{item.location}</Text>
          </View>
        )}
      </View>

      {/* Title + body */}
      <Text style={s.title}>{item.title}</Text>
      <Text style={s.body} numberOfLines={3}>{item.content}</Text>

      {/* Images */}
      {images.length > 0 && (
        <View style={s.imgWrapper}>
          <UpdateImages urls={images} />
        </View>
      )}

      {/* Engagement row */}
      <View style={s.engRow}>
        <View style={s.engLeft}>
          <View style={s.engItem}>
            <Feather name="heart" size={15} color="#B50000" />
            <Text style={s.engCount}>{item.likes}</Text>
          </View>
          <View style={s.engItem}>
            <Feather name="message-circle" size={15} color="#888" />
            <Text style={s.engCountGrey}>{item.comments ?? 0}</Text>
          </View>
          <Feather name="share-2" size={15} color="#888" style={{ marginLeft: 6 }} />
        </View>
        <Pressable style={s.viewBtn}>
          <Text style={s.viewBtnText}>View Details</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Media grid ─────────────────────────────────────────────────────────────────

function MediaGrid({ updates }: { updates: FeedUpdate[] }) {
  const allMedia = updates.flatMap((u) =>
    u.mediaUrls?.length ? u.mediaUrls : (u.imageUrl ? [u.imageUrl] : [])
  );
  if (allMedia.length === 0) {
    return (
      <View style={s.empty}>
        <Feather name="image" size={36} color="#ccc" />
        <Text style={s.emptyText}>No media yet</Text>
      </View>
    );
  }
  return (
    <View style={s.grid}>
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

// ── Main screen ────────────────────────────────────────────────────────────────

export default function UpdatesScreen() {
  const router = useRouter();
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const [activeTab, setActiveTab] = useState<"all" | "media">("all");

  const updatesQ = useQuery({
    queryKey: ["org-feed", orgId],
    queryFn: () => api.getOrgFeed(orgId!),
    enabled: !!orgId,
  });

  const updates =
    updatesQ.data && updatesQ.data.length > 0 ? updatesQ.data : PLACEHOLDERS;

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

      {/* ── Toggle ── */}
      <View style={s.toggleContainer}>
        <View style={s.togglePill}>
          <Pressable
            style={[s.toggleBtn, activeTab === "all" && s.toggleBtnActive]}
            onPress={() => setActiveTab("all")}
          >
            <Text style={[s.toggleText, activeTab === "all" && s.toggleTextActive]}>
              All Updates
            </Text>
          </Pressable>
          <Pressable
            style={[s.toggleBtn, activeTab === "media" && s.toggleBtnActive]}
            onPress={() => setActiveTab("media")}
          >
            <Text style={[s.toggleText, activeTab === "media" && s.toggleTextActive]}>
              Media
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {updatesQ.isLoading ? (
          <ActivityIndicator style={{ marginVertical: 48 }} color="#B50000" size="large" />
        ) : activeTab === "all" ? (
          <View style={s.list}>
            {updates.map((u) => <UpdateCard key={u._id} item={u} />)}
          </View>
        ) : (
          <MediaGrid updates={updates} />
        )}
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

  toggleContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#E0D8CC",
  },
  togglePill: {
    flexDirection: "row",
    backgroundColor: "#F2EDE4",
    borderRadius: 24,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
  },
  toggleBtnActive: { backgroundColor: "#B50000" },
  toggleText: { fontSize: 14, fontWeight: "600", color: "#888" },
  toggleTextActive: { color: "#fff" },

  scroll: { flex: 1 },
  list: { padding: 16, gap: 14 },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: CARD_PAD,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metaLeft: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, color: "#888" },

  title: { fontSize: 16, fontWeight: "700", color: "#1A1A1A", lineHeight: 22, marginBottom: 6 },
  body: { fontSize: 13, color: "#666", lineHeight: 19, marginBottom: 10 },

  // Images
  imgWrapper: { marginBottom: 10, borderRadius: 8, overflow: "hidden" },
  imgFull: { width: "100%", height: IMG_FULL_H, borderRadius: 8 },
  imgMultiRow: { flexDirection: "row", gap: 4 },
  imgMultiLarge: { height: IMG_MULTI_H * 2 + 4, borderRadius: 8 },
  imgMultiStack: { gap: 0 },
  imgMultiSm: { flex: 1, height: IMG_MULTI_H, borderRadius: 8 },

  // Engagement
  engRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  engLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  engItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  engCount: { fontSize: 13, fontWeight: "600", color: "#B50000" },
  engCountGrey: { fontSize: 13, color: "#888" },
  viewBtn: {
    backgroundColor: "#B50000",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  viewBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  // Media grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },

  // Empty
  empty: { alignItems: "center", paddingVertical: 56, gap: 12 },
  emptyText: { fontSize: 14, color: "#888" },
});
