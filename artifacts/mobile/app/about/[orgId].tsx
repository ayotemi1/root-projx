import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as api from "@/lib/api";

const SCREEN_W = Dimensions.get("window").width;
const HERO_H = 220;

// ── Placeholder fallbacks ──────────────────────────────────────────────────────

const PH = {
  about:   "Cornerstone Youth Foundation was established in 2016 to address youth unemployment and lack of opportunity in Kingston's inner-city communities.",
  mission: "Empowering young people through skills, mentorship, and community.",
  vision:  "A future where every young person has the tools to build a better life.",
  values:  ["Empowerment", "Integrity", "Inclusion", "Growth"],
  website: "www.cornerstoneyouth.org",
  email:   "info@cornerstoneyouth.org",
  phone:   "(876) 555-0198",
  address: "123 Eastwood Park Road, Kingston, Jamaica",
};

// ── Info row (Mission / Vision / Values) ──────────────────────────────────────

function InfoRow({
  icon,
  label,
  text,
  chips,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  text?: string | null;
  chips?: string[] | null;
}) {
  return (
    <View style={ir.row}>
      <View style={ir.iconCircle}>
        <Feather name={icon} size={18} color="#fff" />
      </View>
      <View style={ir.body}>
        <Text style={ir.label}>{label}</Text>
        {!!text && <Text style={ir.text}>{text}</Text>}
        {chips && chips.length > 0 && (
          <View style={ir.chips}>
            {chips.map((v, i) => (
              <View key={i} style={ir.chip}>
                <Text style={ir.chipText}>{v}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const ir = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderColor: "#F2EDE4",
    backgroundColor: "#fff",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#B50000",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  body: { flex: 1 },
  label: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 4 },
  text: { fontSize: 14, color: "#666", lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: {
    borderWidth: 1.5,
    borderColor: "#B50000",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: "#B50000" },
});

// ── Contact row ────────────────────────────────────────────────────────────────

function ContactRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={cr.row}
      onPress={onPress}
      disabled={!onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
    >
      <View style={cr.iconCircle}>
        <Feather name={icon} size={18} color="#fff" />
      </View>
      <View style={cr.body}>
        <Text style={cr.label}>{label}</Text>
        <Text style={[cr.value, !!onPress && cr.valueLink]}>{value}</Text>
      </View>
      {!!onPress && <Feather name="chevron-right" size={16} color="#ccc" />}
    </Pressable>
  );
}

const cr = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#F2EDE4",
    backgroundColor: "#fff",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#B50000",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  body: { flex: 1 },
  label: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 2 },
  value: { fontSize: 14, color: "#666" },
  valueLink: { color: "#B50000" },
});

// ── Main screen ────────────────────────────────────────────────────────────────

export default function AboutScreen() {
  const router = useRouter();
  const { orgId } = useLocalSearchParams<{ orgId: string }>();

  const orgQ = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId!, null),
    enabled: !!orgId,
  });

  const org = orgQ.data;

  const heroImg   = org?.featuredImageUrl ?? org?.coverImage ?? null;
  const aboutText = org?.description      ?? PH.about;
  const mission   = org?.mission          ?? PH.mission;
  const vision    = org?.vision           ?? PH.vision;
  const values    = org?.values?.length   ? org.values : PH.values;
  const website   = org?.contact?.website ?? PH.website;
  const email     = org?.contact?.email   ?? PH.email;
  const phone     = org?.contact?.phone   ?? PH.phone;
  const address   = org?.address          ?? PH.address;
  const orgName   = org?.name             ?? "the Organisation";

  if (orgQ.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color="#B50000" size="large" />
      </View>
    );
  }

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

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero image ── */}
        {heroImg ? (
          <Image source={{ uri: heroImg }} style={s.heroImg} resizeMode="cover" />
        ) : (
          <View style={[s.heroImg, s.heroFallback]}>
            <Feather name="image" size={40} color="rgba(255,255,255,0.4)" />
          </View>
        )}

        {/* ── About section ── */}
        <View style={s.aboutBlock}>
          <Text style={s.aboutHeading}>About {orgName}</Text>
          <Text style={s.aboutText}>{aboutText}</Text>
        </View>

        {/* ── Mission / Vision / Values ── */}
        <View style={s.section}>
          <InfoRow icon="target" label="Our Mission" text={mission} />
          <InfoRow icon="eye"    label="Our Vision"  text={vision} />
          <InfoRow icon="heart"  label="Our Values"  chips={values} />
        </View>

        {/* ── Contact ── */}
        <View style={s.contactSection}>
          <Text style={s.contactHeading}>Contact</Text>
          <View style={s.section}>
            {!!website && (
              <ContactRow
                icon="globe"
                label="Website"
                value={website}
                onPress={() => Linking.openURL(website.startsWith("http") ? website : `https://${website}`)}
              />
            )}
            {!!email && (
              <ContactRow
                icon="mail"
                label="Email"
                value={email}
                onPress={() => Linking.openURL(`mailto:${email}`)}
              />
            )}
            {!!phone && (
              <ContactRow
                icon="phone"
                label="Phone"
                value={phone}
                onPress={() => Linking.openURL(`tel:${phone.replace(/\D/g, "")}`)}
              />
            )}
            {!!address && (
              <ContactRow
                icon="map-pin"
                label="Address"
                value={address}
                onPress={() =>
                  Linking.openURL(
                    `https://maps.google.com/?q=${encodeURIComponent(address)}`
                  )
                }
              />
            )}
          </View>
        </View>

        <View style={{ height: 32 }} />
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

  heroImg: {
    width: SCREEN_W,
    height: HERO_H,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  heroFallback: {
    backgroundColor: "#B50000",
    alignItems: "center",
    justifyContent: "center",
  },

  aboutBlock: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    marginTop: 16,
  },
  aboutHeading: { fontSize: 20, fontWeight: "800", color: "#1A1A1A", marginBottom: 8, lineHeight: 26 },
  aboutText: { fontSize: 14, color: "#666", lineHeight: 22 },

  section: {
    backgroundColor: "#fff",
    marginTop: 16,
    borderTopWidth: 1,
    borderColor: "#F2EDE4",
    overflow: "hidden",
  },

  contactSection: { marginTop: 8 },
  contactHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
});
