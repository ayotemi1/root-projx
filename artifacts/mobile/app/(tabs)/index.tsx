import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as api from "@/lib/api";
import type { Org } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const CATEGORIES = [
  "All",
  "Youth Empowerment",
  "Maternal Health",
  "Environment",
  "Diaspora Support",
  "Education",
  "Mental Health",
  "Arts & Culture",
];

function OrgCard({ org }: { org: Org }) {
  const colors = useColors();
  const router = useRouter();
  const s = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius + 2,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    name: { fontSize: 16, fontWeight: "700", color: colors.foreground, flex: 1 },
    badge: {
      backgroundColor: org.verified ? colors.verified : colors.muted,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: org.verified ? colors.verifiedForeground : colors.mutedForeground,
    },
    location: { color: colors.mutedForeground, fontSize: 13, marginTop: 4 },
    category: {
      alignSelf: "flex-start",
      backgroundColor: colors.goldDim,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginTop: 8,
    },
    categoryText: { fontSize: 11, fontWeight: "600", color: colors.accentForeground },
    desc: { color: colors.foreground, fontSize: 13, marginTop: 8, lineHeight: 18 },
    footer: { flexDirection: "row", marginTop: 12, gap: 16 },
    stat: { color: colors.mutedForeground, fontSize: 12 },
    statBold: { fontWeight: "600", color: colors.foreground },
  });

  return (
    <Pressable style={s.card} onPress={() => router.push(`/organisations/${org._id}`)}>
      <View style={s.row}>
        <Text style={s.name} numberOfLines={1}>{org.name}</Text>
        {org.verified && (
          <View style={s.badge}>
            <Text style={s.badgeText}>✓ VERIFIED</Text>
          </View>
        )}
      </View>
      <Text style={s.location}>{[org.city, org.country].filter(Boolean).join(", ")}</Text>
      <View style={s.category}>
        <Text style={s.categoryText}>{org.category}</Text>
      </View>
      <Text style={s.desc} numberOfLines={2}>{org.description}</Text>
      <View style={s.footer}>
        <Text style={s.stat}>
          <Text style={s.statBold}>{org.followerCount ?? 0}</Text> followers
        </Text>
        {(org.totalRaised ?? 0) > 0 && (
          <Text style={s.stat}>
            <Text style={s.statBold}>£{org.totalRaised.toLocaleString()}</Text> raised
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const colors = useColors();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const { data: orgs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["organisations", category],
    queryFn: () =>
      api.getOrganisations(category !== "All" ? { category } : undefined),
  });

  const filtered = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.city ?? "").toLowerCase().includes(search.toLowerCase()) ||
      o.country.toLowerCase().includes(search.toLowerCase()),
  );

  const s = styles(colors);
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Search bar */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search organisations..."
          placeholderTextColor={colors.mutedForeground}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[s.chip, category === cat && s.chipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[s.chipText, category === cat && s.chipTextActive]}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
      ) : isError ? (
        <View style={s.center}>
          <Text style={s.errorText}>Could not load organisations.</Text>
          <Pressable style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No organisations found.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o) => o._id}
          renderItem={({ item }) => <OrgCard org={item} />}
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
    searchWrap: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: c.background,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    search: {
      backgroundColor: c.secondary,
      borderRadius: c.radius,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: c.foreground,
    },
    chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: c.secondary,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 13, color: c.mutedForeground, fontWeight: "500" },
    chipTextActive: { color: c.primaryForeground, fontWeight: "700" },
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
