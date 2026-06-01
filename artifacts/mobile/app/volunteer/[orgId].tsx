import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { VolunteerRole } from "@/lib/api";



function roleIcon(title: string): React.ComponentProps<typeof Feather>["name"] {
  const t = title.toLowerCase();
  if (t.includes("design") || t.includes("graphic")) return "pen-tool";
  if (t.includes("mentor"))                            return "users";
  if (t.includes("event"))                             return "calendar";
  if (t.includes("social") || t.includes("media"))    return "smartphone";
  if (t.includes("fundrais"))                          return "heart";
  if (t.includes("admin"))                             return "briefcase";
  if (t.includes("tech") || t.includes("develop"))    return "code";
  if (t.includes("teach") || t.includes("educat"))    return "book";
  return "user-check";
}

const FILTER_CHIPS = ["All", "Local", "Remote", "Short Term", "Long Term"] as const;
type FilterChip = (typeof FILTER_CHIPS)[number];

function matchesFilter(role: VolunteerRole, f: FilterChip): boolean {
  if (f === "All") return true;
  if (f === "Local")  return role.location?.toLowerCase() === "local";
  if (f === "Remote") return role.location?.toLowerCase() === "remote";
  const c = role.commitment?.toLowerCase() ?? "";
  if (f === "Short Term") return c.includes("occasional") || c.includes("short") || c.includes("once");
  if (f === "Long Term")  return c.includes("weekly") || c.includes("long") || c.includes("ongoing");
  return true;
}

// ── Segmented picker ───────────────────────────────────────────────────────────

function SegmentedPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={sp.wrapper}>
      <Text style={sp.label}>{label}</Text>
      <View style={sp.row}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            style={[sp.opt, value === opt && sp.optActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[sp.optText, value === opt && sp.optTextActive]}>{opt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const sp = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", gap: 8 },
  opt: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: "#E0D8CC", alignItems: "center", backgroundColor: "#fff" },
  optActive: { backgroundColor: "#B50000", borderColor: "#B50000" },
  optText: { fontSize: 13, color: "#888", fontWeight: "600" },
  optTextActive: { color: "#fff" },
});

// ── Bottom sheet wrapper ───────────────────────────────────────────────────────

function BottomSheet({
  visible,
  onClose,
  children,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={bs.overlay} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={bs.kvWrapper}
      >
        <View style={[bs.sheet, { paddingBottom: insets.bottom + 20 }]}>
          {/* Handle */}
          <View style={bs.handle} />
          {/* Title row */}
          <View style={bs.titleRow}>
            <Text style={bs.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color="#888" />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const bs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  kvWrapper: { position: "absolute", bottom: 0, left: 0, right: 0 },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: "85%",
  },
  handle: { width: 40, height: 4, backgroundColor: "#E0D8CC", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "700", color: "#1A1A1A", flex: 1, marginRight: 12 },
});

// ── Apply modal ────────────────────────────────────────────────────────────────

function ApplyModal({
  visible,
  role,
  orgId,
  onClose,
}: {
  visible: boolean;
  role: VolunteerRole | null;
  orgId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { isAuthenticated, token } = useAuth();
  const [motivation, setMotivation] = useState("");
  const [experience, setExperience] = useState("");
  const [done, setDone] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      api.postVolunteerApplication(
        orgId,
        {
          roleId: role?._id ?? "general",
          roleTitle: role?.title ?? "General Application",
          motivation,
          experience,
        },
        token!,
      ),
    onSuccess: () => { setDone(true); setMotivation(""); setExperience(""); },
  });

  function handleSubmit() {
    if (!isAuthenticated) { onClose(); router.push("/(auth)/login"); return; }
    if (!motivation.trim()) return;
    mut.mutate();
  }

  function handleClose() {
    setDone(false); setMotivation(""); setExperience(""); onClose();
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={role?.title ?? "Volunteer Application"}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {done ? (
          <View style={am.success}>
            <Feather name="check-circle" size={48} color="#2E7D32" />
            <Text style={am.successTitle}>Application Sent!</Text>
            <Text style={am.successSub}>
              Thank you for your interest. The organisation will be in touch.
            </Text>
            <Pressable style={am.doneBtn} onPress={handleClose}>
              <Text style={am.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={am.fieldLabel}>Why do you want to volunteer for this role?</Text>
            <TextInput
              style={am.textarea}
              multiline
              numberOfLines={4}
              placeholder="Tell us about your motivation..."
              placeholderTextColor="#aaa"
              value={motivation}
              onChangeText={setMotivation}
              textAlignVertical="top"
            />
            <Text style={am.fieldLabel}>Relevant experience or skills</Text>
            <TextInput
              style={am.textarea}
              multiline
              numberOfLines={3}
              placeholder="Share any relevant background..."
              placeholderTextColor="#aaa"
              value={experience}
              onChangeText={setExperience}
              textAlignVertical="top"
            />
            {mut.isError && (
              <Text style={am.error}>Something went wrong. Please try again.</Text>
            )}
            <Pressable
              style={[am.submitBtn, (!motivation.trim() || mut.isPending) && am.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={mut.isPending}
            >
              {mut.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={am.submitBtnText}>
                    {isAuthenticated ? "Submit Application" : "Sign in to Apply"}
                  </Text>
              }
            </Pressable>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const am = StyleSheet.create({
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#555", marginBottom: 8 },
  textarea: {
    borderWidth: 1.5,
    borderColor: "#E0D8CC",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#1A1A1A",
    backgroundColor: "#FAFAF8",
    minHeight: 90,
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: "#B50000",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  error: { fontSize: 13, color: "#B50000", marginBottom: 8, textAlign: "center" },
  success: { alignItems: "center", paddingVertical: 24, gap: 12 },
  successTitle: { fontSize: 18, fontWeight: "700", color: "#1A1A1A" },
  successSub: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 20 },
  doneBtn: { backgroundColor: "#B50000", borderRadius: 12, paddingHorizontal: 32, paddingVertical: 13, marginTop: 8 },
  doneBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

// ── Suggest Skills modal ───────────────────────────────────────────────────────

function SuggestSkillModal({
  visible,
  orgId,
  onClose,
}: {
  visible: boolean;
  orgId: string;
  onClose: () => void;
}) {
  const { isAuthenticated, token } = useAuth();
  const router = useRouter();
  const [skill, setSkill] = useState("");
  const [availability, setAvailability] = useState("Flexible");
  const [locationPref, setLocationPref] = useState("Remote");
  const [done, setDone] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      api.postSkillSuggestion(
        orgId,
        { skill, availability: availability.toLowerCase(), locationPreference: locationPref.toLowerCase() },
        token!,
      ),
    onSuccess: () => { setDone(true); setSkill(""); },
  });

  function handleSubmit() {
    if (!isAuthenticated) { onClose(); router.push("/(auth)/login"); return; }
    if (!skill.trim()) return;
    mut.mutate();
  }

  function handleClose() {
    setDone(false); setSkill(""); onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose} title="Suggest a Skill">
      <ScrollView showsVerticalScrollIndicator={false}>
        {done ? (
          <View style={am.success}>
            <Feather name="check-circle" size={48} color="#2E7D32" />
            <Text style={am.successTitle}>Thank you!</Text>
            <Text style={am.successSub}>
              Your suggestion has been sent to the organisation.
            </Text>
            <Pressable style={am.doneBtn} onPress={handleClose}>
              <Text style={am.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={am.fieldLabel}>What skill can you offer?</Text>
            <TextInput
              style={[am.textarea, { minHeight: 56 }]}
              placeholder="e.g. Photography, Carpentry, Legal advice..."
              placeholderTextColor="#aaa"
              value={skill}
              onChangeText={setSkill}
            />
            <SegmentedPicker
              label="Availability"
              options={["Flexible", "Weekly", "Occasional"]}
              value={availability}
              onChange={setAvailability}
            />
            <SegmentedPicker
              label="Location Preference"
              options={["Remote", "Local", "Either"]}
              value={locationPref}
              onChange={setLocationPref}
            />
            {mut.isError && (
              <Text style={am.error}>Something went wrong. Please try again.</Text>
            )}
            <Pressable
              style={[am.submitBtn, (!skill.trim() || mut.isPending) && am.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={mut.isPending}
            >
              {mut.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={am.submitBtnText}>
                    {isAuthenticated ? "Send Suggestion" : "Sign in to Submit"}
                  </Text>
              }
            </Pressable>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

// ── Role row ──────────────────────────────────────────────────────────────────

function RoleRow({
  item,
  onPress,
}: {
  item: VolunteerRole;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={s.roleRow}
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
    >
      <View style={s.roleIcon}>
        <Feather name={roleIcon(item.title)} size={20} color="#1A1A1A" />
      </View>
      <View style={s.roleText}>
        <Text style={s.roleTitle}>{item.title}</Text>
        <Text style={s.roleMeta}>{item.location} · {item.commitment}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#888" />
    </Pressable>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function VolunteerScreen() {
  const router = useRouter();
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const [activeFilter, setActiveFilter] = useState<FilterChip>("All");
  const [applyRole, setApplyRole] = useState<VolunteerRole | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);

  const rolesQ = useQuery({
    queryKey: ["org-roles", orgId],
    queryFn: () => api.getOrgVolunteerRoles(orgId!),
    enabled: !!orgId,
  });

  const allRoles = rolesQ.data ?? [];
  const shown = allRoles.filter((r) => matchesFilter(r, activeFilter));

  function openApply(role: VolunteerRole) {
    setApplyRole(role);
    setShowApply(true);
  }

  function openApplyGeneral() {
    setApplyRole(allRoles[0] ?? null);
    setShowApply(true);
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

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Page heading ── */}
        <View style={s.headingBlock}>
          <Text style={s.heading}>Ways to Volunteer</Text>
          <Text style={s.subheading}>
            Your time and skills can make a real difference in the lives of young people.
          </Text>
        </View>

        {/* ── Filter chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
          style={s.chipsScroll}
        >
          {FILTER_CHIPS.map((chip) => (
            <Pressable
              key={chip}
              style={[s.chip, activeFilter === chip && s.chipActive]}
              onPress={() => setActiveFilter(chip)}
            >
              <Text style={[s.chipText, activeFilter === chip && s.chipTextActive]}>
                {chip}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Roles list ── */}
        <View style={s.rolesList}>
          {rolesQ.isLoading ? (
            <ActivityIndicator style={{ marginVertical: 32 }} color="#B50000" size="large" />
          ) : allRoles.length === 0 ? (
            <View style={s.emptyState}>
              <View style={s.emptyIcon}>
                <Feather name="users" size={36} color="#B50000" />
              </View>
              <Text style={s.emptyHeading}>No volunteer roles listed</Text>
              <Text style={s.emptySubtext}>This organisation hasn't listed any volunteer opportunities yet.</Text>
            </View>
          ) : shown.length === 0 ? (
            <View style={s.emptyState}>
              <Feather name="filter" size={28} color="#ccc" />
              <Text style={s.emptySubtext}>No roles match this filter. Try "All".</Text>
            </View>
          ) : (
            shown.map((role, i) => (
              <React.Fragment key={role._id}>
                <RoleRow item={role} onPress={() => openApply(role)} />
                {i < shown.length - 1 && <View style={s.divider} />}
              </React.Fragment>
            ))
          )}
        </View>

        {/* ── Apply button ── */}
        <View style={s.bottomSection}>
          <Pressable style={s.applyBtn} onPress={openApplyGeneral}>
            <Text style={s.applyBtnText}>Apply to Volunteer</Text>
          </Pressable>

          {/* Have a skill not listed? */}
          <Pressable style={s.skillRow} onPress={() => setShowSuggest(true)}>
            <View style={s.skillRowLeft}>
              <View style={s.plusCircle}>
                <Feather name="plus" size={16} color="#B50000" />
              </View>
              <View>
                <Text style={s.skillRowTitle}>Have a skill not listed?</Text>
                <Text style={s.skillRowSub}>Tell us how you'd like to help.</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="#888" />
          </Pressable>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Modals ── */}
      <ApplyModal
        visible={showApply}
        role={applyRole}
        orgId={orgId ?? ""}
        onClose={() => setShowApply(false)}
      />
      <SuggestSkillModal
        visible={showSuggest}
        orgId={orgId ?? ""}
        onClose={() => setShowSuggest(false)}
      />
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

  scroll: { flex: 1 },

  headingBlock: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  heading: { fontSize: 22, fontWeight: "800", color: "#1A1A1A", marginBottom: 6 },
  subheading: { fontSize: 14, color: "#666", lineHeight: 20 },

  chipsScroll: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#E0D8CC",
  },
  chipsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E0D8CC",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#B50000", borderColor: "#B50000" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#555" },
  chipTextActive: { color: "#fff" },

  rolesList: {
    backgroundColor: "#fff",
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: "#fff",
  },
  roleIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F5B800",
    alignItems: "center",
    justifyContent: "center",
  },
  roleText: { flex: 1 },
  roleTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 3 },
  roleMeta: { fontSize: 13, color: "#888" },
  divider: { height: 1, backgroundColor: "#F2EDE4", marginLeft: 76 },

  bottomSection: { paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  applyBtn: {
    backgroundColor: "#B50000",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  applyBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  skillRowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  plusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#B50000",
    alignItems: "center",
    justifyContent: "center",
  },
  skillRowTitle: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  skillRowSub: { fontSize: 12, color: "#888", marginTop: 2 },

  emptyState: { alignItems: "center", paddingVertical: 40, gap: 12, minHeight: 200, justifyContent: "center" },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(181,0,0,0.08)", alignItems: "center", justifyContent: "center" },
  emptyHeading: { fontSize: 18, fontWeight: "700", color: "#1A1A1A", textAlign: "center" },
  emptySubtext: { fontSize: 14, color: "#888", textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },
});
