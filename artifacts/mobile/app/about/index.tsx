import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { Heading } from "@/components/Typography";

const PILLARS = [
  {
    icon: "🔍",
    title: "Discover & Follow",
    desc: "Browse verified grassroots organisations in Jamaica, the UK, and beyond. Follow the ones doing work that matters to you and get updates straight to your feed.",
  },
  {
    icon: "💸",
    title: "Give Directly",
    desc: "Send money straight to the organisations on the ground. No middlemen, no bureaucracy. 95% of every donation reaches the cause — we charge just 5% to keep the lights on.",
  },
  {
    icon: "🤝",
    title: "Offer Your Skills",
    desc: "Money isn't everything. Diaspora professionals can offer skills — legal, medical, digital, financial — to organisations who need them most.",
  },
  {
    icon: "📈",
    title: "Build Capacity",
    desc: "Long-term change needs strong organisations. We help community groups become more effective, accountable, and connected.",
  },
];

export default function AboutScreen() {
  const colors = useColors();

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={[s.hero, { backgroundColor: colors.navBackground }]}>
          <Heading size={36} color="#FFFFFF" style={{ textAlign: "center" }}>
            Root ProjX
          </Heading>
          <Text style={s.heroTagline}>RESTORATION. CULTURE. ACCESS.</Text>
          <View style={s.heroDivider} />
          <Text style={s.heroCaption}>Support straight to the source.</Text>
        </View>

        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>OUR STORY</Text>
          <Text style={[s.body, { color: colors.foreground }]}>
            Root ProjX was born in the aftermath of Hurricane Melissa, when diaspora communities
            around the world wanted to help Jamaica — but couldn't find a reliable way to get
            support directly to the people on the ground.
          </Text>
          <Text style={[s.body, { color: colors.foreground }]}>
            Founded by Visaka and Ayotemi, Root ProjX bridges the gap between diaspora generosity
            and grassroots impact. We verify organisations, facilitate direct giving, and create a
            living record of community-driven change.
          </Text>
        </View>

        <View style={[s.foundersCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>FOUNDERS</Text>
          <View style={s.foundersRow}>
            <View style={s.founderItem}>
              <View style={[s.founderAvatar, { backgroundColor: colors.primary }]}>
                <Text style={s.founderInitial}>V</Text>
              </View>
              <Text style={[s.founderName, { color: colors.foreground }]}>Visaka</Text>
              <Text style={[s.founderRole, { color: colors.mutedForeground }]}>Co-founder</Text>
            </View>
            <View style={s.founderItem}>
              <View style={[s.founderAvatar, { backgroundColor: colors.accent }]}>
                <Text style={[s.founderInitial, { color: "#1A1A1A" }]}>A</Text>
              </View>
              <Text style={[s.founderName, { color: colors.foreground }]}>Ayotemi</Text>
              <Text style={[s.founderRole, { color: colors.mutedForeground }]}>Co-founder</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>FOUR PILLARS</Text>
          {PILLARS.map((p) => (
            <View key={p.title} style={[s.pillarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.pillarTop}>
                <Text style={s.pillarIcon}>{p.icon}</Text>
                <Text style={[s.pillarTitle, { color: colors.foreground }]}>{p.title}</Text>
              </View>
              <Text style={[s.pillarDesc, { color: colors.foreground }]}>{p.desc}</Text>
            </View>
          ))}
        </View>

        <View style={[s.missionBanner, { backgroundColor: colors.primary }]}>
          <Text style={s.missionText}>
            Every donation, every follow, every skill shared — it all adds up to something bigger.
          </Text>
          <Text style={s.missionSub}>Root ProjX — where diaspora meets grassroots.</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 20 },
  hero: {
    paddingTop: 48,
    paddingBottom: 36,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  heroTagline: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 2,
    marginTop: 12,
    textAlign: "center",
  },
  heroDivider: {
    width: 40,
    height: 2,
    backgroundColor: "#F5B800",
    marginVertical: 14,
  },
  heroCaption: {
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
  section: { padding: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
  },
  foundersCard: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    marginBottom: 8,
  },
  foundersRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 4,
  },
  founderItem: { alignItems: "center", flex: 1 },
  founderAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  founderInitial: { fontSize: 24, fontWeight: "800", color: "#FFFFFF" },
  founderName: { fontSize: 15, fontWeight: "700" },
  founderRole: { fontSize: 12, marginTop: 2 },
  pillarCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  pillarTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  pillarIcon: { fontSize: 24 },
  pillarTitle: { fontSize: 16, fontWeight: "700", flex: 1 },
  pillarDesc: { fontSize: 14, lineHeight: 21 },
  missionBanner: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
  },
  missionText: {
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "600",
  },
  missionSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 10,
    textAlign: "center",
  },
});
