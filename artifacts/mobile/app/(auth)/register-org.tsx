import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";

const CATEGORIES = [
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

function PickerModal({
  visible,
  options,
  onSelect,
  onClose,
}: {
  visible: boolean;
  options: string[];
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <ScrollView>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={s.modalItem}
                onPress={() => { onSelect(opt); onClose(); }}
              >
                <Text style={s.modalItemText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function RegisterOrgScreen() {
  const { register } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);

  const [orgName, setOrgName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [mission, setMission] = useState("");
  const [regNumber, setRegNumber] = useState("");

  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function goNext() {
    if (!orgName.trim()) { setError("Organisation name is required."); return; }
    if (!category) { setError("Please select a category."); return; }
    if (!description.trim()) { setError("A short description is required."); return; }
    if (!country) { setError("Please select a country of operation."); return; }
    setError("");
    setStep(2);
  }

  async function handleSubmit() {
    if (!contactName.trim()) { setError("Your name is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    setError("");
    try {
      const token = await register({
        name: contactName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        accountType: "organisation",
        orgName: orgName.trim(),
        country,
        registrationNumber: regNumber.trim() || undefined,
      });
      await api.createOrgProfile(token, {
        name: orgName.trim(),
        country,
        category,
        description: description.trim(),
        city: city.trim() || undefined,
        mission: mission.trim() || undefined,
      });
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#7A0000" />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.header}>
              <Image
                source={require("../../assets/images/logo.png")}
                style={s.logo}
                resizeMode="contain"
              />
              <Text style={s.headerTitle}>Register your organisation</Text>
              <Text style={s.headerSub}>Join Root ProjX and connect with diaspora supporters</Text>
            </View>

            <View style={s.card}>
              <View style={s.stepRow}>
                <View style={[s.stepDot, step >= 1 && s.stepDotActive]} />
                <View style={[s.stepLine, step >= 2 && s.stepLineActive]} />
                <View style={[s.stepDot, step >= 2 && s.stepDotActive]} />
              </View>
              <Text style={s.stepLabel}>
                {step === 1 ? "Step 1 of 2 — Organisation details" : "Step 2 of 2 — Your account"}
              </Text>

              {!!error && (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}

              {step === 1 ? (
                <>
                  <Text style={s.label}>Organisation name *</Text>
                  <TextInput
                    style={s.input}
                    value={orgName}
                    onChangeText={setOrgName}
                    autoCapitalize="words"
                    placeholder="e.g. Kingston Youth Arts Collective"
                    placeholderTextColor="#888888"
                  />

                  <Text style={s.label}>Category *</Text>
                  <Pressable
                    style={s.selectBtn}
                    onPress={() => setCategoryOpen(true)}
                  >
                    <Text style={[s.selectBtnText, !category && { color: "#888888" }]}>
                      {category || "Select a category"}
                    </Text>
                    <Text style={s.chevron}>›</Text>
                  </Pressable>

                  <Text style={s.label}>Short description *</Text>
                  <TextInput
                    style={[s.input, s.textarea]}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                    placeholder="What does your organisation do? (2–3 sentences)"
                    placeholderTextColor="#888888"
                    textAlignVertical="top"
                  />

                  <Text style={s.label}>Country of operation *</Text>
                  <Pressable
                    style={s.selectBtn}
                    onPress={() => setCountryOpen(true)}
                  >
                    <Text style={[s.selectBtnText, !country && { color: "#888888" }]}>
                      {country || "Select a country"}
                    </Text>
                    <Text style={s.chevron}>›</Text>
                  </Pressable>

                  <Text style={s.label}>City / town (optional)</Text>
                  <TextInput
                    style={s.input}
                    value={city}
                    onChangeText={setCity}
                    placeholder="e.g. Kingston, London"
                    placeholderTextColor="#888888"
                  />

                  <Text style={s.label}>Mission statement (optional)</Text>
                  <TextInput
                    style={[s.input, s.textarea]}
                    value={mission}
                    onChangeText={setMission}
                    multiline
                    numberOfLines={2}
                    placeholder="Your vision in one or two sentences"
                    placeholderTextColor="#888888"
                    textAlignVertical="top"
                  />

                  <Text style={s.label}>Registration / charity number (optional)</Text>
                  <TextInput
                    style={s.input}
                    value={regNumber}
                    onChangeText={setRegNumber}
                    placeholder="e.g. 1234567 or CH-1234"
                    placeholderTextColor="#888888"
                  />

                  <Pressable
                    style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                    onPress={goNext}
                  >
                    <Text style={s.btnText}>Next — Account details</Text>
                  </Pressable>

                  <Pressable onPress={() => router.back()}>
                    <Text style={s.backLink}>← Back</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={s.label}>Your name (contact person) *</Text>
                  <TextInput
                    style={s.input}
                    value={contactName}
                    onChangeText={setContactName}
                    autoCapitalize="words"
                    placeholder="Your full name"
                    placeholderTextColor="#888888"
                  />

                  <Text style={s.label}>Email *</Text>
                  <TextInput
                    style={s.input}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    placeholder="you@yourorg.com"
                    placeholderTextColor="#888888"
                  />

                  <Text style={s.label}>Phone (optional)</Text>
                  <TextInput
                    style={s.input}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="+44 7700 000000"
                    placeholderTextColor="#888888"
                  />

                  <Text style={s.label}>Password *</Text>
                  <TextInput
                    style={s.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="Min. 6 characters"
                    placeholderTextColor="#888888"
                    onSubmitEditing={handleSubmit}
                  />

                  <Text style={s.legalNote}>
                    By registering, your organisation will be reviewed by the Root ProjX team before appearing publicly on the platform.
                  </Text>

                  <Pressable
                    style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#1A1A1A" />
                    ) : (
                      <Text style={s.btnText}>Submit application</Text>
                    )}
                  </Pressable>

                  <Pressable onPress={() => { setError(""); setStep(1); }}>
                    <Text style={s.backLink}>← Back to org details</Text>
                  </Pressable>
                </>
              )}

              <Pressable onPress={() => router.push("/(auth)/login")}>
                <Text style={s.signInLink}>
                  Already registered? <Text style={s.signInAccent}>Sign in</Text>
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <PickerModal
        visible={categoryOpen}
        options={CATEGORIES}
        onSelect={setCategory}
        onClose={() => setCategoryOpen(false)}
      />
      <PickerModal
        visible={countryOpen}
        options={COUNTRIES}
        onSelect={setCountry}
        onClose={() => setCountryOpen(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#7A0000" },
  scroll: { flexGrow: 1 },
  header: {
    backgroundColor: "#7A0000",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  logo: { width: 80, height: 80, marginBottom: 12 },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", textAlign: "center" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, textAlign: "center", marginTop: 6 },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E0D8CC",
  },
  stepDotActive: { backgroundColor: "#B50000" },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E0D8CC",
    marginHorizontal: 4,
  },
  stepLineActive: { backgroundColor: "#B50000" },
  stepLabel: { fontSize: 12, color: "#888888", marginBottom: 20, fontWeight: "600" },
  errorBox: { backgroundColor: "#FDECEA", borderRadius: 8, padding: 12, marginBottom: 14 },
  errorText: { color: "#B50000", fontSize: 14 },
  label: { fontSize: 13, fontWeight: "600", color: "#1A1A1A", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#E0D8CC",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: "#1A1A1A",
    backgroundColor: "#FFFFFF",
  },
  textarea: { minHeight: 80, paddingTop: 12 },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E0D8CC",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#FFFFFF",
  },
  selectBtnText: { fontSize: 15, color: "#1A1A1A", flex: 1 },
  chevron: { fontSize: 20, color: "#888888", fontWeight: "300" },
  btn: {
    backgroundColor: "#F5B800",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  btnText: { color: "#1A1A1A", fontWeight: "800", fontSize: 16 },
  backLink: { textAlign: "center", marginTop: 16, color: "#888888", fontSize: 14 },
  legalNote: {
    fontSize: 12,
    color: "#888888",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
  signInLink: { textAlign: "center", marginTop: 20, color: "#888888", fontSize: 14 },
  signInAccent: { color: "#B50000", fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    maxHeight: "70%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E0D8CC",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  modalItem: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2EDE4",
  },
  modalItemText: { fontSize: 15, color: "#1A1A1A" },
});
