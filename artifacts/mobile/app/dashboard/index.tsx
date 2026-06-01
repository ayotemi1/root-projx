import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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
} from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { FeedUpdate, OrgAnalytics, OrgNotification } from "@/lib/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7)  return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
  return `${Math.floor(d / 30)} months ago`;
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000)      return `£${(n / 1000).toFixed(1)}K`;
  return `£${n.toLocaleString()}`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

const SPARK_DATA: Record<string, number[]> = {
  views:      [20, 35, 28, 45, 40, 55, 48, 70, 65, 82],
  engagement: [15, 22, 30, 25, 38, 42, 36, 50, 58, 68],
  donations:  [10, 18, 15, 28, 22, 35, 42, 38, 55, 62],
};

function Sparkline({ dataKey }: { dataKey: string }) {
  const raw = SPARK_DATA[dataKey] ?? SPARK_DATA.views;
  const W = 90, H = 36;
  const min = Math.min(...raw), max = Math.max(...raw);
  const scaleY = (v: number) => H - ((v - min) / (max - min || 1)) * (H - 6) - 2;
  const pts = raw.map((v, i) => `${(i / (raw.length - 1)) * W},${scaleY(v)}`).join(" ");
  return (
    <Svg width={W} height={H}>
      <Polyline
        points={pts}
        fill="none"
        stroke="#2E7D32"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  value: string;
  label: string;
}) {
  return (
    <View style={st.card}>
      <Feather name={icon} size={20} color="#B50000" style={st.icon} />
      <Text style={st.value}>{value}</Text>
      <Text style={st.label}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: { flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 4 },
  icon: { marginBottom: 6 },
  value: { fontSize: 20, fontWeight: "800", color: "#1A1A1A" },
  label: { fontSize: 11, color: "#888", marginTop: 2, textAlign: "center" },
});

// ── Analytics card ────────────────────────────────────────────────────────────

function AnalyticsCard({
  label,
  value,
  trend,
  dataKey,
}: {
  label: string;
  value: string;
  trend: number;
  dataKey: string;
}) {
  return (
    <View style={ac.card}>
      <Text style={ac.label}>{label}</Text>
      <View style={ac.row}>
        <Text style={ac.value}>{value}</Text>
        <Text style={ac.trend}>+{trend}%</Text>
      </View>
      <Sparkline dataKey={dataKey} />
    </View>
  );
}

const ac = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F2EDE4",
  },
  label: { fontSize: 11, color: "#888", marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 6 },
  value: { fontSize: 17, fontWeight: "800", color: "#1A1A1A" },
  trend: { fontSize: 11, fontWeight: "700", color: "#2E7D32" },
});

// ── Notification helpers ──────────────────────────────────────────────────────

const NOTIF_ICON: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  follower:  "user-plus",
  donation:  "heart",
  volunteer: "users",
};
const NOTIF_COLOR: Record<string, string> = {
  follower:  "#F5B800",
  donation:  "#B50000",
  volunteer: "#1565C0",
};

const PH_NOTIFS: OrgNotification[] = [
  { _id: "n1", type: "follower",  message: "Sarah M. started following your organisation.", read: false, createdAt: new Date(Date.now() - 36e5).toISOString() },
  { _id: "n2", type: "donation",  message: "A £50 donation was received from James T.",     read: false, createdAt: new Date(Date.now() - 72e5).toISOString() },
  { _id: "n3", type: "volunteer", message: "New volunteer application for Graphic Designer.", read: true,  createdAt: new Date(Date.now() - 864e5).toISOString() },
];

function NotifRow({ item }: { item: OrgNotification }) {
  const type  = item.type in NOTIF_ICON ? item.type : "follower";
  const color = NOTIF_COLOR[type] ?? "#888";
  const icon  = NOTIF_ICON[type] ?? "bell";
  return (
    <View style={[nr.row, !item.read && nr.unread]}>
      <View style={[nr.dot, { backgroundColor: color + "20" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <View style={nr.body}>
        <Text style={nr.msg}>{item.message}</Text>
        <Text style={nr.time}>{timeAgo(item.createdAt)}</Text>
      </View>
      {!item.read && <View style={nr.unreadDot} />}
    </View>
  );
}

const nr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12, backgroundColor: "#fff" },
  unread: { backgroundColor: "#FFF9F9" },
  dot: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  body: { flex: 1 },
  msg: { fontSize: 13, color: "#1A1A1A", lineHeight: 18 },
  time: { fontSize: 11, color: "#888", marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#B50000", flexShrink: 0 },
});

// ── Notifications panel ───────────────────────────────────────────────────────

function NotificationsPanel({
  visible,
  notifs,
  onClose,
  onMarkRead,
}: {
  visible: boolean;
  notifs: OrgNotification[];
  onClose: () => void;
  onMarkRead: () => void;
}) {
  const insets = useSafeAreaInsets();
  const items  = notifs.length ? notifs : PH_NOTIFS;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={np.backdrop} />
      </TouchableWithoutFeedback>
      <View style={[np.panel, { paddingTop: insets.top + 8 }]}>
        <View style={np.header}>
          <Text style={np.title}>Notifications</Text>
          <View style={np.headerRight}>
            <TouchableOpacity onPress={onMarkRead}>
              <Text style={np.markRead}>Mark all as read</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={{ marginLeft: 12 }}>
              <Feather name="x" size={20} color="#888" />
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          data={items}
          keyExtractor={(it) => it._id}
          renderItem={({ item }) => <NotifRow item={item} />}
          ItemSeparatorComponent={() => <View style={np.sep} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={np.empty}>
              <Feather name="bell" size={32} color="#ddd" />
              <Text style={np.emptyText}>No notifications yet</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const np = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.4)" },
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F9F6F0",
    maxHeight: "70%",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: "#E0D8CC",
  },
  headerRight: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 17, fontWeight: "700", color: "#1A1A1A" },
  markRead: { fontSize: 13, color: "#B50000", fontWeight: "600" },
  sep: { height: 1, backgroundColor: "#F2EDE4", marginLeft: 64 },
  empty: { alignItems: "center", paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 14, color: "#888" },
});

// ── Create Update modal ───────────────────────────────────────────────────────

const UPDATE_TYPES = ["update", "milestone", "campaign"];

interface PickedMedia {
  uri: string;
  name: string;
  mimeType: string;
  isVideo: boolean;
}

function CreateUpdateModal({
  visible,
  orgId,
  token,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  orgId: string;
  token: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title,    setTitle]    = useState("");
  const [content,  setContent]  = useState("");
  const [type,     setType]     = useState("update");
  const [media,    setMedia]    = useState<PickedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err,      setErr]      = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      let mediaUrls: string[] = [];
      if (media.length > 0) {
        setUploading(true);
        mediaUrls = await api.uploadMedia(media, token!);
        setUploading(false);
      }
      await api.postUpdate({ title, content, type, mediaUrls }, token!);
    },
    onSuccess: () => {
      setTitle(""); setContent(""); setMedia([]); setErr(""); onSuccess(); onClose();
    },
    onError: () => setErr("Failed to post. Please try again."),
  });

  async function pickMedia() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!res.canceled) {
      setMedia(res.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `file-${Date.now()}`,
        mimeType: a.mimeType ?? "image/jpeg",
        isVideo: a.type === "video",
      })));
    }
  }

  function handleClose() {
    setTitle(""); setContent(""); setMedia([]); setErr(""); onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={cm.kvWrapper}>
        <View style={cm.sheet}>
          <View style={cm.handle} />
          <View style={cm.header}>
            <Text style={cm.title}>Create Update</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12}><Feather name="x" size={20} color="#888" /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={cm.typeRow}>
              {UPDATE_TYPES.map((t) => (
                <Pressable key={t} style={[cm.typeChip, type === t && cm.typeChipActive]} onPress={() => setType(t)}>
                  <Text style={[cm.typeChipText, type === t && cm.typeChipTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={cm.inputTitle}
              placeholder="Headline..."
              placeholderTextColor="#aaa"
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={cm.inputBody}
              placeholder="Tell your community what's happening..."
              placeholderTextColor="#aaa"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Pressable style={cm.mediaBtn} onPress={pickMedia}>
              <Feather name="image" size={16} color="#888" />
              <Text style={cm.mediaBtnText}>
                {media.length ? `${media.length} file(s) selected` : "Add photo / video"}
              </Text>
            </Pressable>
            {!!err && <Text style={cm.errText}>{err}</Text>}
            <Pressable
              style={[cm.submitBtn, (!title.trim() || !content.trim() || mut.isPending) && cm.submitBtnOff]}
              onPress={() => mut.mutate()}
              disabled={!title.trim() || !content.trim() || mut.isPending}
            >
              {mut.isPending || uploading
                ? <ActivityIndicator color="#fff" />
                : <Text style={cm.submitBtnText}>Post Update</Text>
              }
            </Pressable>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const cm = StyleSheet.create({
  kvWrapper: { position: "absolute", bottom: 0, left: 0, right: 0 },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: "90%",
  },
  handle: { width: 40, height: 4, backgroundColor: "#E0D8CC", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 18, fontWeight: "700", color: "#1A1A1A" },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: "#E0D8CC" },
  typeChipActive: { backgroundColor: "#B50000", borderColor: "#B50000" },
  typeChipText: { fontSize: 12, color: "#888", fontWeight: "600", textTransform: "capitalize" },
  typeChipTextActive: { color: "#fff" },
  inputTitle: { borderWidth: 1.5, borderColor: "#E0D8CC", borderRadius: 10, padding: 12, fontSize: 15, fontWeight: "600", color: "#1A1A1A", marginBottom: 10 },
  inputBody: { borderWidth: 1.5, borderColor: "#E0D8CC", borderRadius: 10, padding: 12, fontSize: 14, color: "#1A1A1A", minHeight: 100, marginBottom: 12 },
  mediaBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderWidth: 1.5, borderColor: "#E0D8CC", borderRadius: 10, marginBottom: 14 },
  mediaBtnText: { fontSize: 14, color: "#888" },
  submitBtn: { backgroundColor: "#B50000", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitBtnOff: { opacity: 0.5 },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  errText: { fontSize: 13, color: "#B50000", textAlign: "center", marginBottom: 10 },
});

// ── Update row ────────────────────────────────────────────────────────────────

function UpdateRow({ item }: { item: FeedUpdate }) {
  return (
    <View style={ur.row}>
      {item.mediaUrls?.[0] ? (
        <Image source={{ uri: item.mediaUrls[0] }} style={ur.thumb} resizeMode="cover" />
      ) : (
        <View style={[ur.thumb, ur.thumbFallback]}>
          <Feather name="image" size={16} color="#ccc" />
        </View>
      )}
      <View style={ur.body}>
        <Text style={ur.title} numberOfLines={1}>{item.title}</Text>
        <Text style={ur.time}>{timeAgo(item.createdAt)}</Text>
      </View>
      <View style={ur.badgePublished}>
        <Text style={ur.badgeTextPublished}>Published</Text>
      </View>
    </View>
  );
}

const ur = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: 8 },
  thumbFallback: { backgroundColor: "#F2EDE4", alignItems: "center", justifyContent: "center" },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: "700", color: "#1A1A1A", marginBottom: 3 },
  time: { fontSize: 12, color: "#888" },
  badgePublished: { backgroundColor: "#E8F5E9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTextPublished: { fontSize: 11, fontWeight: "700", color: "#2E7D32" },
});

// ── Main screen ────────────────────────────────────────────────────────────────

export default function OrgDashboard() {
  const router = useRouter();
  const { user, token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [showNotifs, setShowNotifs] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  if (!isAuthenticated || user?.accountType !== "organisation") {
    router.replace("/(tabs)/account");
    return null;
  }

  const orgId = user.id;

  const orgQ = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId, token),
    enabled: !!orgId,
  });

  const updatesQ = useQuery({
    queryKey: ["org-feed", orgId],
    queryFn: () => api.getOrgFeed(orgId),
    enabled: !!orgId,
  });

  const analyticsQ = useQuery({
    queryKey: ["org-analytics", orgId],
    queryFn: () => api.getOrgAnalytics(orgId, token!),
    enabled: !!orgId && !!token,
  });

  const notifsQ = useQuery({
    queryKey: ["org-notifs", orgId],
    queryFn: () => api.getOrgNotifications(orgId, token!),
    enabled: !!orgId && !!token,
  });

  const markReadMut = useMutation({
    mutationFn: () => api.markNotificationsRead(orgId, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-notifs", orgId] }),
  });

  const org   = orgQ.data;
  const updates = (updatesQ.data ?? []).slice(0, 5);
  const analytics: OrgAnalytics = analyticsQ.data ?? {
    profileViews: 1245, profileViewsTrend: 18,
    engagement: 532,    engagementTrend: 24,
    donations: 3210,    donationsTrend: 18,
  };
  const notifs      = notifsQ.data ?? [];
  const unreadCount = notifs.filter((n) => !n.read).length || PH_NOTIFS.filter((n) => !n.read).length;
  const orgName     = org?.name ?? user?.orgName ?? "Your Organisation";

  const ACTIONS = [
    { label: "Create Update",     icon: "edit-2"   as const, color: "#B50000", onPress: () => setShowCreate(true) },
    { label: "Add Campaign",      icon: "volume-2" as const, color: "#F5B800", onPress: () => router.push(`/campaigns/${orgId}`) },
    { label: "Manage Volunteers", icon: "users"    as const, color: "#B50000", onPress: () => router.push(`/volunteer/${orgId}`) },
    { label: "Manage Projects",   icon: "folder"   as const, color: "#F5B800", onPress: () => router.push(`/campaigns/${orgId}`) },
  ];

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.headerBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Image source={require("@/assets/images/logo.png")} style={s.headerLogo} resizeMode="contain" />
        <TouchableOpacity onPress={() => setShowNotifs(true)} hitSlop={12} style={s.headerBtn}>
          <Feather name="bell" size={22} color="#fff" />
          {unreadCount > 0 && (
            <View style={s.notifBadge}>
              <Text style={s.notifBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Identity row ── */}
        <View style={s.identityRow}>
          <View style={s.avatar}>
            {org?.logo ? (
              <Image source={{ uri: org.logo }} style={s.avatarImg} />
            ) : (
              <Text style={s.avatarText}>{initials(orgName)}</Text>
            )}
          </View>
          <View style={s.identityMid}>
            <Text style={s.welcomeSmall}>Welcome back,</Text>
            <Text style={s.orgNameText} numberOfLines={1}>{orgName}</Text>
          </View>
          <Pressable style={s.profilePill} onPress={() => router.push(`/organisations/${orgId}`)}>
            <Text style={s.profilePillText}>View Public Profile</Text>
          </Pressable>
        </View>

        {/* ── Stats row ── */}
        <View style={s.statsCard}>
          <StatCard icon="grid"      value={String(org?.projectsCount  ?? org?.impactScore ?? 0)} label="Projects"   />
          <View style={s.statDivider} />
          <StatCard icon="users"     value={String(org?.volunteersCount ?? 0)}                    label="Volunteers" />
          <View style={s.statDivider} />
          <StatCard icon="user-plus" value={String(org?.followerCount   ?? 0)}                    label="Followers"  />
          <View style={s.statDivider} />
          <StatCard icon="layers"    value={fmtMoney(org?.totalRaised   ?? 0)}                    label="Raised"     />
        </View>

        {/* ── Create & Manage ── */}
        <View style={s.section}>
          <Text style={s.sectionHeading}>Create &amp; Manage</Text>
          <View style={s.actionCard}>
            {ACTIONS.map((btn, i) => (
              <Pressable
                key={btn.label}
                style={[s.actionRow, i < ACTIONS.length - 1 && s.actionRowBorder]}
                onPress={btn.onPress}
                android_ripple={{ color: "rgba(0,0,0,0.05)" }}
              >
                <View style={[s.actionIcon, { backgroundColor: btn.color + "18" }]}>
                  <Feather name={btn.icon} size={20} color={btn.color} />
                </View>
                <Text style={s.actionLabel}>{btn.label}</Text>
                <Feather name="chevron-right" size={16} color="#ccc" />
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Analytics Overview ── */}
        <View style={s.section}>
          <View style={s.sectionRowHead}>
            <Text style={s.sectionHeading}>Analytics Overview</Text>
            <TouchableOpacity><Text style={s.sectionLink}>View full analytics</Text></TouchableOpacity>
          </View>
          <View style={s.analyticsRow}>
            <AnalyticsCard label="Profile Views" value={analytics.profileViews.toLocaleString()} trend={analytics.profileViewsTrend} dataKey="views" />
            <AnalyticsCard label="Engagement"    value={analytics.engagement.toLocaleString()}    trend={analytics.engagementTrend}    dataKey="engagement" />
            <AnalyticsCard label="Donations"     value={`£${analytics.donations.toLocaleString()}`} trend={analytics.donationsTrend}  dataKey="donations" />
          </View>
        </View>

        {/* ── Recent Updates ── */}
        <View style={s.section}>
          <View style={s.sectionRowHead}>
            <Text style={s.sectionHeading}>Recent Updates</Text>
            <TouchableOpacity onPress={() => router.push(`/updates/${orgId}`)}>
              <Text style={s.sectionLink}>View all</Text>
            </TouchableOpacity>
          </View>
          <View style={s.updatesCard}>
            {updatesQ.isLoading ? (
              <ActivityIndicator style={{ padding: 20 }} color="#B50000" />
            ) : updates.length === 0 ? (
              <View style={s.emptyBox}>
                <Feather name="file-text" size={28} color="#ddd" />
                <Text style={s.emptyText}>No updates yet. Tap Create Update to get started.</Text>
              </View>
            ) : (
              updates.map((item, i) => (
                <React.Fragment key={item._id}>
                  <UpdateRow item={item} />
                  {i < updates.length - 1 && <View style={s.updatesDivider} />}
                </React.Fragment>
              ))
            )}
          </View>
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>

      {/* ── Modals ── */}
      <NotificationsPanel
        visible={showNotifs}
        notifs={notifs}
        onClose={() => setShowNotifs(false)}
        onMarkRead={() => markReadMut.mutate()}
      />
      <CreateUpdateModal
        visible={showCreate}
        orgId={orgId}
        token={token}
        onClose={() => setShowCreate(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["org-feed", orgId] })}
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
  notifBadge: {
    position: "absolute",
    top: 4,
    right: 2,
    backgroundColor: "#F5B800",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: { fontSize: 9, fontWeight: "800", color: "#1A1A1A" },

  scroll: { flex: 1 },

  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: "#F2EDE4",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#B50000",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { fontSize: 17, fontWeight: "800", color: "#fff" },
  identityMid: { flex: 1 },
  welcomeSmall: { fontSize: 12, color: "#888", marginBottom: 1 },
  orgNameText: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  profilePill: {
    backgroundColor: "#F5B800",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexShrink: 0,
  },
  profilePillText: { fontSize: 12, fontWeight: "700", color: "#1A1A1A" },

  statsCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statDivider: { width: 1, backgroundColor: "#F2EDE4", marginVertical: 12 },

  section: { marginHorizontal: 16, marginTop: 20 },
  sectionHeading: { fontSize: 17, fontWeight: "800", color: "#1A1A1A", marginBottom: 12 },
  sectionRowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionLink: { fontSize: 13, fontWeight: "700", color: "#B50000" },

  actionCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  actionRowBorder: { borderBottomWidth: 1, borderColor: "#F2EDE4" },
  actionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: "700", color: "#1A1A1A" },

  analyticsRow: { flexDirection: "row", gap: 8 },

  updatesCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  updatesDivider: { height: 1, backgroundColor: "#F2EDE4", marginLeft: 76 },
  emptyBox: { alignItems: "center", padding: 28, gap: 8 },
  emptyText: { fontSize: 13, color: "#888", textAlign: "center" },
});
