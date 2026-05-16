import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as api from "@/lib/api";
import type { Org } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const CAUSES = [
  "All Causes",
  "Arts & Culture",
  "Child Welfare",
  "Community Development",
  "Diaspora Support",
  "Disability & Inclusion",
  "Education",
  "Environment",
  "Food Security",
  "Gender Equality",
  "Health",
  "Housing",
  "Human Rights",
  "Legal Aid",
  "LGBTQ+",
  "Maternal Health",
  "Mental Health",
  "Poverty Relief",
  "Refugees",
  "Sport",
  "Youth Empowerment",
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
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        style={[s.dropBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={() => setOpen(true)}
      >
        <Text style={[s.dropBtnText, { color: colors.foreground }]} numberOfLines={1}>
          {value}
        </Text>
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

function OrgCard({ org }: { org: Org }) {
  const colors = useColors();
  const router = useRouter();
  return (
    <Pressable
      style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/organisations/${org._id}`)}
    >
      <View style={s.cardHeader}>
        <View style={[s.orgInitials, { backgroundColor: colors.primary }]}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>
            {org.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.orgName, { color: colors.foreground }]} numberOfLines={1}>{org.name}</Text>
          <Text style={[s.orgLocation, { color: colors.mutedForeground }]}>
            {[org.city, org.country].filter(Boolean).join(", ")}
          </Text>
        </View>
        {org.verified && (
          <View style={[s.verifiedBadge, { backgroundColor: colors.success }]}>
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>✓ VERIFIED</Text>
          </View>
        )}
      </View>

      <View style={[s.causePill, { backgroundColor: colors.goldDim }]}>
        <Text style={[s.causePillText, { color: colors.primary }]}>{org.category}</Text>
      </View>

      <Text style={[s.orgDesc, { color: colors.foreground }]} numberOfLines={2}>
        {org.description}
      </Text>

      <View style={s.cardFooter}>
        <Text style={[s.stat, { color: colors.mutedForeground }]}>
          <Text style={{ fontWeight: "700", color: colors.foreground }}>{org.followerCount ?? 0}</Text> followers
        </Text>
        {(org.totalRaised ?? 0) > 0 && (
          <Text style={[s.stat, { color: colors.mutedForeground }]}>
            <Text style={{ fontWeight: "700", color: colors.primary }}>£{org.totalRaised.toLocaleString()}</Text> raised
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const colors = useColors();
  const [search, setSearch] = useState("");
  const [cause, setCause] = useState("All Causes");
  const [country, setCountry] = useState("All Countries");

  const { data: orgs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["organisations", cause, country],
    queryFn: () =>
      api.getOrganisations({
        category: cause !== "All Causes" ? cause : undefined,
        country: country !== "All Countries" ? country : undefined,
      }),
  });

  const filtered = search.trim()
    ? orgs.filter(
        (o) =>
          o.name.toLowerCase().includes(search.toLowerCase()) ||
          (o.city ?? "").toLowerCase().includes(search.toLowerCase()) ||
          o.country.toLowerCase().includes(search.toLowerCase()),
      )
    : orgs;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[s.searchRow, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TextInput
          style={[s.search, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search organisations..."
          placeholderTextColor={colors.mutedForeground}
          clearButtonMode="while-editing"
        />
      </View>

      <View style={[s.filtersRow, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Dropdown value={cause} options={CAUSES} onChange={setCause} />
        </View>
        <View style={{ flex: 1 }}>
          <Dropdown value={country} options={COUNTRIES} onChange={setCountry} />
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
      ) : isError ? (
        <View style={s.center}>
          <Text style={[s.emptyText, { color: colors.destructive }]}>Could not load organisations.</Text>
          <Pressable style={[s.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No organisations found.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o) => o._id}
          renderItem={({ item }) => <OrgCard org={item} />}
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
  searchRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  search: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
  },
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
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  orgInitials: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  orgName: { fontSize: 15, fontWeight: "700" },
  orgLocation: { fontSize: 12, marginTop: 2 },
  verifiedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  causePill: {
    alignSelf: "flex-start",
    borderRadius: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 8,
  },
  causePillText: { fontSize: 11, fontWeight: "700" },
  orgDesc: { fontSize: 13, lineHeight: 19, marginBottom: 10 },
  cardFooter: { flexDirection: "row", gap: 16 },
  stat: { fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyText: { fontSize: 15, textAlign: "center" },
  retryBtn: { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
});
