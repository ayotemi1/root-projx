import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as api from "@/lib/api";
import type { Resource } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const CATEGORIES = [
  "All Categories",
  "Education",
  "Employment",
  "Family Support",
  "Financial Aid",
  "Food",
  "Health",
  "Housing",
  "Immigration",
  "Legal",
  "Mental Health",
  "Youth",
];

const COUNTRIES = [
  "All Countries",
  "Antigua & Barbuda",
  "Barbados",
  "Belize",
  "Canada",
  "Grenada",
  "Guyana",
  "Jamaica",
  "Saint Lucia",
  "Trinidad & Tobago",
  "United Kingdom",
  "United States",
];

function Dropdown({
  value,
  options,
  onChange,
  colors,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        style={[s.dropBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={() => setOpen(true)}
      >
        <Text style={[s.dropBtnText, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>▼</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade">
        <Pressable style={s.modalOverlay} onPress={() => setOpen(false)}>
          <View style={[s.modalSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <ScrollView>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[s.modalItem, { borderBottomColor: colors.border }]}
                  onPress={() => { onChange(opt); setOpen(false); }}
                >
                  <Text style={[s.modalItemText, { color: colors.foreground }, value === opt && { color: colors.primary, fontWeight: "700" }]}>
                    {opt}
                  </Text>
                  {value === opt && <Text style={{ color: colors.primary }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function ResourceCard({ item }: { item: Resource }) {
  const colors = useColors();
  const { contact } = item;

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardTags}>
        <View style={[s.categoryPill, { backgroundColor: colors.goldDim }]}>
          <Text style={[s.categoryPillText, { color: colors.primary }]}>{item.category.toUpperCase()}</Text>
        </View>
        <View style={[s.countryPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[s.countryPillText, { color: colors.mutedForeground }]}>{item.country}</Text>
        </View>
      </View>

      <Text style={[s.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
      <Text style={[s.cardDesc, { color: colors.foreground }]}>{item.description}</Text>

      {contact && (
        <View style={s.contactRow}>
          {contact.phone && (
            <Pressable
              style={[s.contactBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => Linking.openURL(`tel:${contact.phone}`)}
            >
              <Text style={[s.contactBtnText, { color: colors.primary }]}>📞 Call</Text>
            </Pressable>
          )}
          {contact.email && (
            <Pressable
              style={[s.contactBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => Linking.openURL(`mailto:${contact.email}`)}
            >
              <Text style={[s.contactBtnText, { color: colors.primary }]}>✉ Email</Text>
            </Pressable>
          )}
          {contact.website && (
            <Pressable
              style={[s.contactBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => Linking.openURL(contact.website!)}
            >
              <Text style={[s.contactBtnText, { color: colors.primary }]}>🌐 Website</Text>
            </Pressable>
          )}
        </View>
      )}

      {item.tags && item.tags.length > 0 && (
        <View style={s.tagsRow}>
          {item.tags.map((t) => (
            <View key={t} style={[s.tag, { backgroundColor: colors.secondary }]}>
              <Text style={[s.tagText, { color: colors.mutedForeground }]}>{t}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function HelpScreen() {
  const colors = useColors();
  const [category, setCategory] = useState("All Categories");
  const [country, setCountry] = useState("All Countries");

  const { data: resources = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["resources", category, country],
    queryFn: () =>
      api.getResources({
        category: category !== "All Categories" ? category : undefined,
        country: country !== "All Countries" ? country : undefined,
      }),
  });

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={[]}>
      <View style={[s.filtersRow, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Dropdown value={category} options={CATEGORIES} onChange={setCategory} colors={colors} />
        </View>
        <View style={{ flex: 1 }}>
          <Dropdown value={country} options={COUNTRIES} onChange={setCountry} colors={colors} />
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
      ) : isError ? (
        <View style={s.center}>
          <Text style={{ color: colors.destructive, marginBottom: 12 }}>Could not load resources.</Text>
          <Pressable style={[s.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
          </Pressable>
        </View>
      ) : resources.length === 0 ? (
        <View style={s.center}>
          <Text style={{ color: colors.mutedForeground, textAlign: "center", fontSize: 15 }}>
            No resources found for this filter.
          </Text>
        </View>
      ) : (
        <FlatList
          data={resources}
          keyExtractor={(r) => r._id}
          renderItem={({ item }) => <ResourceCard item={item} />}
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
  filtersRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  dropBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  dropBtnText: { fontSize: 12, fontWeight: "600", flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalSheet: {
    width: "100%",
    maxHeight: 400,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalItemText: { fontSize: 15 },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: "rgba(0,0,0,0.06)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTags: { flexDirection: "row", gap: 6, marginBottom: 10 },
  categoryPill: { borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  categoryPillText: { fontSize: 10, fontWeight: "800" },
  countryPill: { borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  countryPillText: { fontSize: 10, fontWeight: "600" },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  cardDesc: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  contactBtn: { borderRadius: 7, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  contactBtnText: { fontSize: 13, fontWeight: "600" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  retryBtn: { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
});
