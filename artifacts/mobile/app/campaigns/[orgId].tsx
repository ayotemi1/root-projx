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
import type { Campaign } from "@/lib/api";

const SCREEN_W = Dimensions.get("window").width;
const CARD_IMG_W = Math.round(SCREEN_W * 0.36);
const CARD_IMG_H = 110;

// ── Placeholder data shown when Firestore has no campaigns yet ────────────────

const PLACEHOLDERS: Campaign[] = [
  {
    _id: "ph_1",
    title: "School Supplies Drive",
    description:
      "Help us provide school supplies to 200 underserved children in Kingston.",
    goal: 10000,
    raised: 6500,
    status: "active",
    type: "fundraising",
    createdAt: new Date(Date.now() - 5 * 864e5).toISOString(),
  },
  {
    _id: "ph_2",
    title: "Youth Mentorship Programme",
    description:
      "We need mentors to support youth in their personal and professional growth.",
    goal: 0,
    raised: 0,
    status: "active",
    type: "volunteer",
    volunteersNeeded: 42,
    createdAt: new Date(Date.now() - 10 * 864e5).toISOString(),
  },
  {
    _id: "ph_3",
    title: "Tools for Training",
    description:
      "Help us purchase modern tools and equipment for our carpentry students.",
    goal: 6000,
    raised: 2100,
    status: "active",
    type: "fundraising",
    createdAt: new Date(Date.now() - 15 * 864e5).toISOString(),
  },
];

function fmtGbp(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `£${n.toLocaleString()}`;
}

// ── Campaign card ──────────────────────────────────────────────────────────────

function CampaignCard({
  item,
  completed,
  onDonate,
}: {
  item: Campaign;
  completed: boolean;
  onDonate?: () => void;
}) {
  const isVolunteer = item.type === "volunteer";
  const pct =
    !isVolunteer && item.goal > 0
      ? Math.min(100, Math.round((item.raised / item.goal) * 100))
      : 0;

  return (
    <View style={[s.card, completed && s.cardCompleted]}>
      {/* Top row: image + title/desc */}
      <View style={s.cardTop}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={s.cardImg}
            resizeMode="cover"
          />
        ) : (
          <View style={[s.cardImg, s.cardImgFallback]}>
            <Feather name="image" size={28} color="#ccc" />
          </View>
        )}
        <View style={s.cardContent}>
          <Text style={s.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={s.cardDesc} numberOfLines={3}>
            {item.description}
          </Text>
        </View>
      </View>

      {/* Progress / status */}
      {completed ? (
        <View style={s.completedRow}>
          <View style={s.completedBadge}>
            <Text style={s.completedBadgeText}>✓ Completed</Text>
          </View>
          {!isVolunteer && item.raised > 0 && (
            <Text style={s.cardRaised}>{fmtGbp(item.raised)} raised</Text>
          )}
        </View>
      ) : isVolunteer ? (
        <View style={s.volunteerRow}>
          <Text style={s.volunteerCount}>
            <Text style={s.volunteerNum}>{item.volunteersNeeded ?? 0}</Text>
            {" volunteers needed"}
          </Text>
          <View style={s.ongoingBadge}>
            <Text style={s.ongoingText}>Ongoing</Text>
          </View>
        </View>
      ) : (
        <>
          <View style={s.progressRow}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${pct}%` as any }]} />
            </View>
            <Text style={s.progressPct}>{pct}%</Text>
          </View>
          <View style={s.raisedRow}>
            <Text style={s.cardRaised}>{fmtGbp(item.raised)} raised</Text>
            <Text style={s.cardGoal}>{fmtGbp(item.goal)} goal</Text>
          </View>
        </>
      )}

      {/* Action button */}
      {!completed && (
        <Pressable
          style={s.cardBtn}
          onPress={onDonate}
          android_ripple={{ color: "rgba(0,0,0,0.08)" }}
        >
          <Text style={s.cardBtnText}>
            {isVolunteer ? "Get Involved" : "Donate"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function CampaignsScreen() {
  const router = useRouter();
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");

  const campaignsQ = useQuery({
    queryKey: ["org-campaigns", orgId],
    queryFn: () => api.getOrgCampaigns(orgId!),
    enabled: !!orgId,
  });

  const allCampaigns =
    campaignsQ.data && campaignsQ.data.length > 0
      ? campaignsQ.data
      : PLACEHOLDERS;

  const shown = allCampaigns.filter((c) =>
    activeTab === "active" ? c.status === "active" : c.status === "completed"
  );

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={s.headerBtn}
        >
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

      {/* ── Toggle tabs ── */}
      <View style={s.toggleContainer}>
        <View style={s.togglePill}>
          <Pressable
            style={[s.toggleBtn, activeTab === "active" && s.toggleBtnActive]}
            onPress={() => setActiveTab("active")}
          >
            <Text
              style={[
                s.toggleText,
                activeTab === "active" && s.toggleTextActive,
              ]}
            >
              Active
            </Text>
          </Pressable>
          <Pressable
            style={[
              s.toggleBtn,
              activeTab === "completed" && s.toggleBtnActive,
            ]}
            onPress={() => setActiveTab("completed")}
          >
            <Text
              style={[
                s.toggleText,
                activeTab === "completed" && s.toggleTextActive,
              ]}
            >
              Completed
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── List ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.sectionHeading}>
          {activeTab === "active" ? "Active Campaigns" : "Completed Campaigns"}
        </Text>

        {campaignsQ.isLoading ? (
          <ActivityIndicator
            style={{ marginVertical: 48 }}
            color="#B50000"
            size="large"
          />
        ) : shown.length === 0 ? (
          <View style={s.empty}>
            <Feather name="flag" size={36} color="#ccc" />
            <Text style={s.emptyText}>
              {activeTab === "active"
                ? "No active campaigns"
                : "No completed campaigns yet"}
            </Text>
          </View>
        ) : (
          shown.map((item) => (
            <CampaignCard
              key={item._id}
              item={item}
              completed={activeTab === "completed"}
              onDonate={
                item.type !== "volunteer"
                  ? () => router.push(`/donate/${orgId}`)
                  : undefined
              }
            />
          ))
        )}

        {/* See All Campaigns CTA */}
        {shown.length > 0 && (
          <Pressable style={s.seeAllBtn}>
            <Text style={s.seeAllText}>See All Campaigns</Text>
          </Pressable>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F9F6F0" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#B50000",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogo: { flex: 1, height: 32 },

  // Toggle
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

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 14,
  },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  cardCompleted: { opacity: 0.82 },
  cardTop: {
    flexDirection: "row",
    padding: 12,
    gap: 12,
  },
  cardImg: {
    width: CARD_IMG_W,
    height: CARD_IMG_H,
    borderRadius: 8,
    backgroundColor: "#F2EDE4",
  },
  cardImgFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: { flex: 1, justifyContent: "flex-start" },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 6,
    lineHeight: 21,
  },
  cardDesc: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },

  // Progress
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 7,
    backgroundColor: "#E0D8CC",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 7,
    backgroundColor: "#B50000",
    borderRadius: 4,
  },
  progressPct: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
    minWidth: 36,
    textAlign: "right",
  },
  raisedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
  },
  cardRaised: { fontSize: 13, fontWeight: "700", color: "#B50000" },
  cardGoal: { fontSize: 13, color: "#888" },

  // Volunteer row
  volunteerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  volunteerCount: { fontSize: 13, color: "#1A1A1A" },
  volunteerNum: { fontSize: 15, fontWeight: "800", color: "#B50000" },
  ongoingBadge: {
    backgroundColor: "#F2EDE4",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ongoingText: { fontSize: 12, fontWeight: "600", color: "#555" },

  // Completed badge
  completedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  completedBadge: {
    backgroundColor: "#E8F4E8",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  completedBadgeText: { fontSize: 12, fontWeight: "700", color: "#2E7D32" },

  // Card action button
  cardBtn: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#B50000",
    alignItems: "center",
  },
  cardBtnText: { fontSize: 14, fontWeight: "700", color: "#B50000" },

  // See all button
  seeAllBtn: {
    backgroundColor: "#B50000",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  seeAllText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // Empty state
  empty: {
    alignItems: "center",
    paddingVertical: 56,
    gap: 12,
  },
  emptyText: { fontSize: 14, color: "#888" },
});
