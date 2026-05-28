import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
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

export default function CompleteOrgProfileScreen() {
  const { user, token, refreshUser } = useAuth();
  const router = useRouter();

  const [orgName, setOrgName] = useState(user?.orgName ?? "");
  const [country, setCountry] = useState(user?.country ?? "");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [mission, setMission] = useState("");

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!orgName.trim()) { setError("Organisation name is required."); return; }
    if (!country) { setError("Please select a country of operation."); return; }
    if (!category) { setError("Please select a category."); return; }
    if (!description.trim()) { setError("A short description is required."); return; }

    setLoading(true);
    setError("");
    try {
      await api.createOrgProfile(token!, {
        name: orgName.trim(),
        country,
        category,
        description: description.trim(),
        city: city.trim() || undefined,
        mission: mission.trim() || undefined,
      });
      await refreshUser();
      router.replace("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#B50000" />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.header}>
              <Text style={s.headerTitle}>Complete your profile</Text>
              <Text style={s.headerSub}>
                Your account was created but your organisation profile is missing. Fill in the
                details below to finish setting up.
              </Text>
            </View>

            <View style={s.card}>
              {!!error && <Text style={s.error}>{error}</Text>}

              <Text style={s.label}>Organisation name *</Text>
              <TextInput
                style={s.input}
                value={orgName}
                onChangeText={setOrgName}
                placeholder="e.g. The Hub"
                placeholderTextColor="#aaa"
                autoCapitalize="words"
              />

              <Text style={s.label}>Country of operation *</Text>
              <Pressable style={s.picker} onPress={() => setCountryOpen(true)}>
                <Text style={[s.pickerText, !country && s.placeholder]}>
                  {country || "Select country…"}
                </Text>
                <Text style={s.pickerChevron}>›</Text>
              </Pressable>

              <Text style={s.label}>Category *</Text>
              <Pressable style={s.picker} onPress={() => setCategoryOpen(true)}>
                <Text style={[s.pickerText, !category && s.placeholder]}>
                  {category || "Select category…"}
                </Text>
                <Text style={s.pickerChevron}>›</Text>
              </Pressable>

              <Text style={s.label}>Short description *</Text>
              <TextInput
                style={[s.input, s.textarea]}
                value={description}
                onChangeText={setDescription}
                placeholder="What does your organisation do?"
                placeholderTextColor="#aaa"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={s.label}>City / Town</Text>
              <TextInput
                style={s.input}
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Kingston"
                placeholderTextColor="#aaa"
              />

              <Text style={s.label}>Mission statement</Text>
              <TextInput
                style={[s.input, s.textarea]}
                value={mission}
                onChangeText={setMission}
                placeholder="Our mission is…"
                placeholderTextColor="#aaa"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Pressable
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={s.btnText}>{loading ? "Saving…" : "Save Profile"}</Text>
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
  root: { flex: 1, backgroundColor: "#B50000" },
  scroll: { paddingBottom: 40 },
  header: { padding: 24, paddingBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 8 },
  headerSub: { fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 20 },
  card: {
    backgroundColor: "#fff", borderRadius: 16, margin: 16,
    padding: 20, gap: 0,
  },
  error: {
    backgroundColor: "#FDECEA", color: "#B50000",
    borderRadius: 8, padding: 12, fontSize: 13,
    marginBottom: 12,
  },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#E0D8CC", borderRadius: 10,
    padding: 12, fontSize: 14, color: "#111",
  },
  textarea: { height: 90, textAlignVertical: "top" },
  picker: {
    borderWidth: 1, borderColor: "#E0D8CC", borderRadius: 10,
    padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  pickerText: { fontSize: 14, color: "#111" },
  placeholder: { color: "#aaa" },
  pickerChevron: { fontSize: 18, color: "#888" },
  btn: {
    backgroundColor: "#B50000", borderRadius: 10,
    paddingVertical: 15, alignItems: "center", marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 16, maxHeight: "70%",
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: "#ddd",
    borderRadius: 2, alignSelf: "center", marginBottom: 12,
  },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  modalItemText: { fontSize: 15, color: "#111" },
});
