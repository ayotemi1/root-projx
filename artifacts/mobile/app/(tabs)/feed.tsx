import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { FeedUpdate } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
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

function UpdateCard({ item }: { item: FeedUpdate }) {
  const colors = useColors();
  const router = useRouter();
  const typeStyle = TYPE_COLORS[item.type] ?? TYPE_COLORS.update!;
  const s = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius + 2,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 3,
      elevation: 2,
    },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    orgName: { fontSize: 13, fontWeight: "700", color: colors.primary, flex: 1 },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: typeStyle.bg,
    },
    badgeText: { fontSize: 10, fontWeight: "700", color: typeStyle.text },
    title: { fontSize: 15, fontWeight: "700", color: colors.foreground, marginTop: 8 },
    content: { fontSize: 13, color: colors.foreground, marginTop: 6, lineHeight: 19 },
    footer: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
    likes: { color: colors.mutedForeground, fontSize: 12 },
    date: { color: colors.mutedForeground, fontSize: 12 },
  });

  return (
    <Pressable
      style={s.card}
      onPress={() => router.push(`/organisations/${item.orgId}`)}
    >
      <View style={s.header}>
        <Text style={s.orgName} numberOfLines={1}>{item.orgName}</Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>{typeStyle.label.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={s.title}>{item.title}</Text>
      <Text style={s.content} numberOfLines={3}>{item.content}</Text>
      <View style={s.footer}>
        <Text style={s.likes}>♥ {item.likes ?? 0}</Text>
        <Text style={s.date}>{timeAgo(item.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

export default function FeedScreen() {
  const colors = useColors();
  const { isAuthenticated, token } = useAuth();
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

  const s = styles(colors);
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Toggle */}
      <View style={s.toggleBar}>
        {(["public", "mine"] as const).map((m) => {
          const disabled = m === "mine" && !isAuthenticated;
          return (
            <Pressable
              key={m}
              style={[s.toggleBtn, mode === m && s.toggleActive, disabled && s.disabled]}
              onPress={() => !disabled && setMode(m)}
            >
              <Text style={[s.toggleText, mode === m && s.toggleTextActive]}>
                {m === "public" ? "All Updates" : "For You"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === "mine" && !isAuthenticated ? (
        <View style={s.center}>
          <Text style={s.emptyText}>Sign in to see your personalised feed.</Text>
        </View>
      ) : isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
      ) : isError ? (
        <View style={s.center}>
          <Text style={s.errorText}>Could not load updates.</Text>
          <Pressable style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : updates.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>
            {mode === "mine"
              ? "Follow organisations to see their updates here."
              : "No updates yet."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={updates}
          keyExtractor={(u) => u._id}
          renderItem={({ item }) => <UpdateCard item={item} />}
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}
    </SafeAreaView>
  );
}

const styles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    toggleBar: {
      flexDirection: "row",
      margin: 16,
      backgroundColor: c.secondary,
      borderRadius: c.radius,
      padding: 3,
    },
    toggleBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: c.radius - 2,
      alignItems: "center",
    },
    toggleActive: { backgroundColor: c.primary },
    disabled: { opacity: 0.45 },
    toggleText: { fontWeight: "600", color: c.mutedForeground, fontSize: 13 },
    toggleTextActive: { color: c.primaryForeground },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    errorText: { color: c.destructive, fontSize: 15, textAlign: "center", marginBottom: 12 },
    emptyText: { color: c.mutedForeground, fontSize: 15, textAlign: "center" },
    retryBtn: {
      backgroundColor: c.primary,
      borderRadius: c.radius,
      paddingHorizontal: 24,
      paddingVertical: 10,
    },
    retryText: { color: c.primaryForeground, fontWeight: "600" },
  });
