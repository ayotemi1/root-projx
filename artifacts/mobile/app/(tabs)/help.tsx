import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as api from "@/lib/api";
import type { Resource } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const CATEGORIES = ["All", "Housing", "Legal", "Mental Health", "Health"];
const COUNTRIES = ["All", "Jamaica", "United Kingdom"];

function ResourceCard({ item }: { item: Resource }) {
  const colors = useColors();
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
    topRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    categoryBadge: {
      backgroundColor: colors.goldDim,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    categoryText: { fontSize: 10, fontWeight: "700", color: colors.accentForeground },
    countryBadge: {
      backgroundColor: colors.secondary,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    countryText: { fontSize: 10, fontWeight: "600", color: colors.mutedForeground },
    title: { fontSize: 15, fontWeight: "700", color: colors.foreground, marginTop: 10 },
    desc: { fontSize: 13, color: colors.foreground, marginTop: 6, lineHeight: 19 },
    contactSection: { marginTop: 12, gap: 6 },
    contactLabel: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground },
    contactRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    contactBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.secondary,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    contactBtnText: { fontSize: 12, color: colors.primary, fontWeight: "600" },
    tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
    tag: {
      backgroundColor: colors.secondary,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    tagText: { fontSize: 11, color: colors.mutedForeground },
  });

  const { contact } = item;

  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <View style={s.categoryBadge}>
          <Text style={s.categoryText}>{item.category.toUpperCase()}</Text>
        </View>
        <View style={s.countryBadge}>
          <Text style={s.countryText}>{item.country}</Text>
        </View>
      </View>
      <Text style={s.title}>{item.title}</Text>
      <Text style={s.desc}>{item.description}</Text>

      {contact && (
        <View style={s.contactSection}>
          <Text style={s.contactLabel}>GET IN TOUCH</Text>
          <View style={s.contactRow}>
            {contact.phone && (
              <Pressable
                style={s.contactBtn}
                onPress={() => Linking.openURL(`tel:${contact.phone}`)}
              >
                <Text style={s.contactBtnText}>📞 {contact.phone}</Text>
              </Pressable>
            )}
            {contact.email && (
              <Pressable
                style={s.contactBtn}
                onPress={() => Linking.openURL(`mailto:${contact.email}`)}
              >
                <Text style={s.contactBtnText}>✉ {contact.email}</Text>
              </Pressable>
            )}
            {contact.website && (
              <Pressable
                style={s.contactBtn}
                onPress={() => Linking.openURL(contact.website!)}
              >
                <Text style={s.contactBtnText}>🌐 Website</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {item.tags && item.tags.length > 0 && (
        <View style={s.tagsRow}>
          {item.tags.map((t) => (
            <View key={t} style={s.tag}>
              <Text style={s.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function HelpScreen() {
  const colors = useColors();
  const [category, setCategory] = useState("All");
  const [country, setCountry] = useState("All");

  const { data: resources = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["resources", category, country],
    queryFn: () =>
      api.getResources({
        category: category !== "All" ? category : undefined,
        country: country !== "All" ? country : undefined,
      }),
  });

  const s = styles(colors);
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Category filter */}
      <View>
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

        {/* Country filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
        >
          {COUNTRIES.map((c) => (
            <Pressable
              key={c}
              style={[s.chip, country === c && s.chipCountryActive]}
              onPress={() => setCountry(c)}
            >
              <Text style={[s.chipText, country === c && s.chipTextActive]}>
                {c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
      ) : isError ? (
        <View style={s.center}>
          <Text style={s.errorText}>Could not load resources.</Text>
          <Pressable style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : resources.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No resources found for this filter.</Text>
        </View>
      ) : (
        <FlatList
          data={resources}
          keyExtractor={(r) => r._id}
          renderItem={({ item }) => <ResourceCard item={item} />}
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
    chips: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: c.secondary,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipCountryActive: { backgroundColor: c.navBackground, borderColor: c.navBackground },
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
