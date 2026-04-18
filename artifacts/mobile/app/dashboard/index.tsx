import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { FeedUpdate } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

const UPDATE_TYPES = ["update", "milestone", "campaign"];

interface PickedMedia {
  uri: string;
  name: string;
  mimeType: string;
  isVideo: boolean;
}

export default function DashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postType, setPostType] = useState("update");
  const [selectedMedia, setSelectedMedia] = useState<PickedMedia[]>([]);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done">("idle");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isAuthenticated || user?.accountType !== "organisation") {
      router.replace("/(tabs)/account");
    }
  }, [isAuthenticated, user]);

  const orgId = user?.id ?? "";

  const orgQ = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId, token),
    enabled: !!orgId && isAuthenticated,
  });

  const updatesQ = useQuery({
    queryKey: ["org-feed", orgId],
    queryFn: () => api.getOrgFeed(orgId),
    enabled: !!orgId,
  });

  const postMut = useMutation({
    mutationFn: async () => {
      let mediaUrls: string[] = [];
      if (selectedMedia.length > 0) {
        setUploadStatus("uploading");
        mediaUrls = await api.uploadMedia(selectedMedia, token!);
        setUploadStatus("done");
      }
      return api.postUpdate(
        {
          title: postTitle.trim(),
          content: postContent.trim(),
          type: postType,
          mediaUrls,
        },
        token!,
      );
    },
    onSuccess: () => {
      setPostTitle("");
      setPostContent("");
      setPostType("update");
      setSelectedMedia([]);
      setUploadStatus("idle");
      setShowForm(false);
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["org-feed", orgId] });
      queryClient.invalidateQueries({ queryKey: ["feed", "public"] });
    },
    onError: (e: Error) => {
      setUploadStatus("idle");
      setFormError(e.message);
    },
  });

  async function pickMedia() {
    if (selectedMedia.length >= 5) {
      Alert.alert("Limit reached", "You can attach up to 5 files per update.");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Please allow access to your photos to attach media.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.85,
      videoMaxDuration: 60,
      selectionLimit: 5 - selectedMedia.length,
    });

    if (result.canceled) return;

    const picked: PickedMedia[] = result.assets.map((asset) => {
      const isVideo = asset.type === "video";
      const ext = isVideo ? "mp4" : "jpg";
      const filename = asset.fileName ?? `media_${Date.now()}.${ext}`;
      const mimeType = isVideo ? "video/mp4" : (asset.mimeType ?? "image/jpeg");
      return { uri: asset.uri, name: filename, mimeType, isVideo };
    });

    setSelectedMedia((prev) => [...prev, ...picked].slice(0, 5));
  }

  function removeMedia(index: number) {
    setSelectedMedia((prev) => prev.filter((_, i) => i !== index));
  }

  function handlePost() {
    if (!postTitle.trim()) { setFormError("Title is required."); return; }
    if (!postContent.trim()) { setFormError("Content is required."); return; }
    setFormError("");
    postMut.mutate();
  }

  function resetForm() {
    setPostTitle("");
    setPostContent("");
    setPostType("update");
    setSelectedMedia([]);
    setUploadStatus("idle");
    setShowForm(false);
    setFormError("");
  }

  const org = orgQ.data;
  const updates = updatesQ.data ?? [];
  const s = styles(colors);
  const isSubmitting = postMut.isPending;
  const submitLabel =
    uploadStatus === "uploading"
      ? "Uploading media…"
      : uploadStatus === "done"
        ? "Publishing…"
        : "Publish Update";

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerAvatar}>
            <Text style={s.headerAvatarText}>
              {(org?.name ?? user?.name ?? "")
                .split(" ")
                .map((w: string) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() || "??"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{org?.name ?? user?.name ?? "Your Organisation"}</Text>
            {org && (
              <Text style={s.headerSub}>
                {[org.city, org.country].filter(Boolean).join(", ")}
              </Text>
            )}
          </View>
          {org?.verified && (
            <View style={s.verifiedBadge}>
              <Text style={s.verifiedText}>✓ Verified</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statNum}>{org?.followerCount ?? 0}</Text>
            <Text style={s.statLbl}>Followers</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statNum}>{updates.length}</Text>
            <Text style={s.statLbl}>Updates</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statNum}>£{(org?.totalRaised ?? 0).toLocaleString()}</Text>
            <Text style={s.statLbl}>Raised</Text>
          </View>
        </View>

        {/* Post update form toggle */}
        <View style={s.section}>
          <Pressable
            style={s.postToggle}
            onPress={() => (showForm ? resetForm() : setShowForm(true))}
          >
            <Text style={s.postToggleText}>
              {showForm ? "✕  Cancel" : "＋  Post an Update"}
            </Text>
          </Pressable>

          {showForm && (
            <View style={s.form}>
              {!!formError && <Text style={s.formError}>{formError}</Text>}

              {/* Type picker */}
              <Text style={s.label}>Type</Text>
              <View style={s.typeRow}>
                {UPDATE_TYPES.map((t) => (
                  <Pressable
                    key={t}
                    style={[s.typeBtn, postType === t && s.typeBtnActive]}
                    onPress={() => setPostType(t)}
                  >
                    <Text style={[s.typeBtnText, postType === t && s.typeBtnTextActive]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.label}>Title</Text>
              <TextInput
                style={s.input}
                value={postTitle}
                onChangeText={setPostTitle}
                placeholder="Update title..."
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={s.label}>Content</Text>
              <TextInput
                style={[s.input, s.textarea]}
                value={postContent}
                onChangeText={setPostContent}
                placeholder="Tell your supporters what's happening..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              {/* Media picker */}
              <Text style={s.label}>
                Photos &amp; Videos{" "}
                <Text style={{ color: colors.mutedForeground, fontWeight: "400" }}>
                  (optional, up to 5)
                </Text>
              </Text>

              {selectedMedia.length > 0 && (
                <View style={s.mediaRow}>
                  {selectedMedia.map((m, i) => (
                    <View key={i} style={s.mediaThumbWrap}>
                      {m.isVideo ? (
                        <View style={[s.mediaThumb, s.videoThumb]}>
                          <Text style={{ fontSize: 28 }}>🎬</Text>
                        </View>
                      ) : (
                        <Image source={{ uri: m.uri }} style={s.mediaThumb} />
                      )}
                      <Pressable
                        style={s.mediaRemove}
                        onPress={() => removeMedia(i)}
                      >
                        <Text style={s.mediaRemoveText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {selectedMedia.length < 5 && (
                <Pressable style={s.addMediaBtn} onPress={pickMedia}>
                  <Text style={s.addMediaText}>
                    📷 {selectedMedia.length === 0
                      ? "Add photos or videos"
                      : `Add more (${selectedMedia.length}/5)`}
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={[s.submitBtn, isSubmitting && s.submitBtnDisabled]}
                onPress={handlePost}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color={colors.primaryForeground} size="small" />
                    <Text style={s.submitBtnText}>{submitLabel}</Text>
                  </View>
                ) : (
                  <Text style={s.submitBtnText}>Publish Update</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* My updates */}
        <View style={s.updatesSection}>
          <Text style={s.updatesTitle}>Recent Updates ({updates.length})</Text>
          {updatesQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ margin: 20 }} />
          ) : updates.length === 0 ? (
            <Text style={s.empty}>No updates yet. Post your first update above.</Text>
          ) : (
            updates.map((u: FeedUpdate) => (
              <View key={u._id} style={s.updateCard}>
                <View style={s.updateHeader}>
                  <View style={s.typePill}>
                    <Text style={s.typePillText}>{u.type.toUpperCase()}</Text>
                  </View>
                  <Text style={s.updateDate}>{timeAgo(u.createdAt)}</Text>
                </View>
                <Text style={s.updateTitle}>{u.title}</Text>
                <Text style={s.updateContent} numberOfLines={2}>{u.content}</Text>
                {u.mediaUrls && u.mediaUrls.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {u.mediaUrls.map((url, i) => (
                        url.includes("video") ? (
                          <View key={i} style={s.mediaPillVideo}>
                            <Text style={{ fontSize: 20 }}>🎬</Text>
                          </View>
                        ) : (
                          <Image
                            key={i}
                            source={{ uri: url }}
                            style={s.mediaPillImage}
                          />
                        )
                      ))}
                    </View>
                  </ScrollView>
                )}
                <Text style={s.updateLikes}>♥ {u.likes ?? 0} likes</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: 60 },
    header: {
      flexDirection: "row", alignItems: "center", gap: 14,
      backgroundColor: c.navBackground, paddingHorizontal: 20,
      paddingTop: 20, paddingBottom: 20,
    },
    headerAvatar: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent,
      alignItems: "center", justifyContent: "center",
    },
    headerAvatarText: { fontSize: 22, fontWeight: "800", color: c.accentForeground },
    headerTitle: { fontSize: 17, fontWeight: "800", color: c.navForeground },
    headerSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
    verifiedBadge: {
      backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 4,
      paddingHorizontal: 8, paddingVertical: 4,
    },
    verifiedText: { fontSize: 11, fontWeight: "700", color: c.accent },
    statsRow: {
      flexDirection: "row", backgroundColor: c.card,
      paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    stat: { flex: 1, alignItems: "center" },
    statNum: { fontSize: 20, fontWeight: "800", color: c.foreground },
    statLbl: { fontSize: 11, color: c.mutedForeground, marginTop: 2 },
    statDivider: { width: 1, backgroundColor: c.border },
    section: {
      margin: 16, backgroundColor: c.card, borderRadius: c.radius,
      borderWidth: 1, borderColor: c.border, overflow: "hidden",
    },
    postToggle: {
      padding: 16, alignItems: "center", backgroundColor: c.primary,
    },
    postToggleText: { color: c.primaryForeground, fontWeight: "700", fontSize: 15 },
    form: { padding: 16 },
    formError: {
      backgroundColor: "#FDECEA", color: c.destructive,
      borderRadius: 6, padding: 10, fontSize: 13, marginBottom: 8,
    },
    label: { fontSize: 13, fontWeight: "600", color: c.foreground, marginTop: 12, marginBottom: 6 },
    typeRow: { flexDirection: "row", gap: 8 },
    typeBtn: {
      flex: 1, paddingVertical: 8, borderRadius: c.radius, alignItems: "center",
      backgroundColor: c.secondary, borderWidth: 1, borderColor: c.border,
    },
    typeBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    typeBtnText: { fontSize: 12, color: c.mutedForeground, fontWeight: "600" },
    typeBtnTextActive: { color: c.primaryForeground },
    input: {
      borderWidth: 1, borderColor: c.border, borderRadius: c.radius,
      padding: 12, fontSize: 14, color: c.foreground,
    },
    textarea: { height: 100, textAlignVertical: "top" },
    mediaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    mediaThumbWrap: { position: "relative" },
    mediaThumb: {
      width: 72, height: 72, borderRadius: 8, borderWidth: 1, borderColor: c.border,
    },
    videoThumb: {
      backgroundColor: c.secondary, alignItems: "center", justifyContent: "center",
    },
    mediaRemove: {
      position: "absolute", top: -6, right: -6,
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: c.destructive, alignItems: "center", justifyContent: "center",
    },
    mediaRemoveText: { color: "#fff", fontSize: 10, fontWeight: "900" },
    addMediaBtn: {
      borderWidth: 1.5, borderStyle: "dashed", borderColor: c.border,
      borderRadius: c.radius, paddingVertical: 12, alignItems: "center",
      marginBottom: 4,
    },
    addMediaText: { fontSize: 14, color: c.mutedForeground },
    submitBtn: {
      backgroundColor: c.accent, borderRadius: c.radius,
      paddingVertical: 13, alignItems: "center", marginTop: 16,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: c.accentForeground, fontWeight: "800", fontSize: 15 },
    updatesSection: { paddingHorizontal: 16 },
    updatesTitle: { fontSize: 16, fontWeight: "700", color: c.foreground, marginBottom: 12 },
    updateCard: {
      backgroundColor: c.card, borderRadius: c.radius, padding: 14,
      marginBottom: 10, borderWidth: 1, borderColor: c.border,
    },
    updateHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    typePill: {
      backgroundColor: c.goldDim, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2,
    },
    typePillText: { fontSize: 10, fontWeight: "700", color: c.accentForeground },
    updateDate: { fontSize: 12, color: c.mutedForeground },
    updateTitle: { fontSize: 14, fontWeight: "700", color: c.foreground },
    updateContent: { fontSize: 13, color: c.mutedForeground, marginTop: 4, lineHeight: 18 },
    updateLikes: { fontSize: 12, color: c.mutedForeground, marginTop: 6 },
    mediaPillImage: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    mediaPillVideo: {
      width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: c.border,
      backgroundColor: c.secondary, alignItems: "center", justifyContent: "center",
    },
    empty: { color: c.mutedForeground, fontSize: 14, textAlign: "center", padding: 20 },
  });
