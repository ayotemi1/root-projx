import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch, Link } from "wouter";
import {
  CheckCircle, Image as ImageIcon, X, AlertCircle, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { PayoutSetup } from "@/components/payout-setup";
import { PendingPayout } from "@/components/pending-payout";
import { CampaignsManager } from "@/components/campaign-builder/campaigns-manager";
import { ProfileEditor } from "@/components/profile-editor/profile-editor";
import type { FeedUpdate, Campaign } from "@/lib/api";

const UPDATE_TYPES = ["update", "milestone", "campaign"] as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

const TYPE_COLORS: Record<string, string> = {
  milestone: "bg-green-50 text-green-700 border-green-200",
  campaign:  "bg-yellow-50 text-yellow-700 border-yellow-200",
  update:    "bg-blue-50 text-blue-700 border-blue-200",
};

// ── Main dashboard page ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const search = useSearch();

  // Update form state
  const [showForm, setShowForm] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postType, setPostType] = useState<typeof UPDATE_TYPES[number]>("update");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done">("idle");
  const [formError, setFormError] = useState("");

  // Campaign form state


  const orgId = user?.id ?? "";
  const initialTab = ["build", "campaigns", "profile"].includes(new URLSearchParams(search).get("tab") ?? "")
    ? (new URLSearchParams(search).get("tab") as string)
    : "profile";
  const connectComplete = new URLSearchParams(search).get("connect") === "complete";

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

  const campaignsQ = useQuery({
    queryKey: ["campaigns", orgId],
    queryFn: () => api.getManagedCampaigns(orgId, token!),
    enabled: !!orgId && !!token,
  });

  const postMut = useMutation({
    mutationFn: async () => {
      let mediaUrls: string[] = [];
      if (selectedFiles.length > 0) {
        setUploadProgress("uploading");
        mediaUrls = await api.uploadMedia(selectedFiles, token!);
        setUploadProgress("done");
      }
      return api.postUpdate(
        { title: postTitle.trim(), content: postContent.trim(), type: postType, mediaUrls },
        token!,
      );
    },
    onSuccess: () => {
      setPostTitle(""); setPostContent(""); setPostType("update");
      setSelectedFiles([]); setPreviewUrls([]); setUploadProgress("idle");
      setShowForm(false); setFormError("");
      queryClient.invalidateQueries({ queryKey: ["org-feed", orgId] });
      queryClient.invalidateQueries({ queryKey: ["feed", "public"] });
    },
    onError: (e: Error) => {
      setUploadProgress("idle");
      setFormError(e.message);
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length + selectedFiles.length > 5) { setFormError("You can attach up to 5 files per update."); return; }
    setFormError("");
    const newFiles = [...selectedFiles, ...files].slice(0, 5);
    setSelectedFiles(newFiles);
    setPreviewUrls(newFiles.map((f) => f.type.startsWith("video/") ? "" : URL.createObjectURL(f)));
  }

  function removeFile(index: number) {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setPreviewUrls(newFiles.map((f) => f.type.startsWith("video/") ? "" : URL.createObjectURL(f)));
  }

  function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!postTitle.trim()) { setFormError("Title is required."); return; }
    if (!postContent.trim()) { setFormError("Content is required."); return; }
    setFormError("");
    postMut.mutate();
  }

  function resetForm() {
    setShowForm(false); setPostTitle(""); setPostContent(""); setPostType("update");
    setSelectedFiles([]); setPreviewUrls([]); setUploadProgress("idle"); setFormError("");
  }

  const org = orgQ.data;
  const updates = updatesQ.data ?? [];
  const campaigns = (campaignsQ.data ?? []).filter((c) => c.status !== "deleted");

  const isSubmitting = postMut.isPending;
  const uploadLabel =
    uploadProgress === "uploading" ? "Uploading media…" :
    uploadProgress === "done" ? "Publishing…" : "Publish Update";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Hero */}
      <div className="bg-primary rounded-2xl p-6 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-extrabold flex-shrink-0 shadow-sm border-2 border-white/20">
            {(org?.name ?? user?.name ?? "").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "??"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white">{org?.name ?? user?.name ?? "Your Organisation"}</h1>
              {org?.verified && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-accent border border-accent/30 px-2 py-0.5 rounded-full bg-accent/10 shadow-sm">
                  <CheckCircle className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            {org && (
              <p className="text-white/80 text-sm font-medium">
                {[org.city, org.country].filter(Boolean).join(", ")} &middot; {org.category}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-6 bg-white/10 rounded-xl p-4 border border-white/10 shadow-sm">
          {[
            { label: "Followers",  value: org?.followerCount ?? 0 },
            { label: "Updates",    value: updates.length },
            { label: "Campaigns",  value: campaigns.length },
            { label: "Raised",     value: `£${(org?.totalRaised ?? 0).toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-lg font-extrabold text-white">{value}</div>
              <div className="text-xs text-white/70 mt-0.5 font-medium">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-11 p-1 bg-secondary rounded-lg">
          <TabsTrigger value="profile" className="rounded-md font-bold text-xs sm:text-sm">Updates & Payouts</TabsTrigger>
          <TabsTrigger value="build" className="rounded-md font-bold text-xs sm:text-sm" data-testid="tab-build-profile" data-tour-id="dashboard-tab-build-profile">Build profile</TabsTrigger>
          <TabsTrigger value="campaigns" className="rounded-md font-bold text-sm">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-2">

          <PendingPayout key={`pending-${orgId}`} orgId={orgId} token={token!} />

          <PayoutSetup key={orgId} orgId={orgId} token={token!} totalRaised={org?.totalRaised ?? 0} connectComplete={connectComplete} />

          {/* ── Updates ────────────────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start pt-6">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base">Post an Update</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handlePost} className="space-y-5">
                  {formError && (
                    <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md font-medium">{formError}</div>
                  )}
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Type</Label>
                    <div className="flex gap-2">
                      {UPDATE_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setPostType(t)}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg border-2 transition-colors capitalize ${
                            postType === t
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="title" className="font-semibold">Title</Label>
                    <Input id="title" placeholder="Update title…" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} className="mt-1.5 bg-secondary/30" />
                  </div>
                  <div>
                    <Label htmlFor="content" className="font-semibold">Content</Label>
                    <Textarea id="content" placeholder="Tell your supporters what's happening…" value={postContent} onChange={(e) => setPostContent(e.target.value)} rows={4} className="mt-1.5 bg-secondary/30" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Photos &amp; Videos <span className="text-muted-foreground font-normal ml-1">(up to 5)</span></Label>
                    {selectedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-3">
                        {selectedFiles.map((file, i) => (
                          <div key={i} className="relative group">
                            {file.type.startsWith("video/") ? (
                              <div className="w-16 h-16 bg-secondary rounded-lg flex items-center justify-center border border-border">
                                <Video className="w-6 h-6 text-muted-foreground" />
                              </div>
                            ) : (
                              <img src={previewUrls[i]} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-border shadow-sm" />
                            )}
                            <button type="button" onClick={() => removeFile(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedFiles.length < 5 && (
                      <>
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm" multiple className="hidden" onChange={handleFileChange} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 h-16 w-full border-2 border-dashed border-border rounded-lg text-sm font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors hover:bg-primary/5"><ImageIcon className="w-4 h-4" /> {selectedFiles.length === 0 ? "Add media" : `Add more (${selectedFiles.length}/5)`}</button>
                      </>
                    )}
                  </div>
                  <div className="pt-2">
                    <Button type="submit" className="w-full bg-primary text-white hover:bg-primary/90 font-bold h-11 text-base shadow-sm" disabled={isSubmitting}>{isSubmitting ? uploadLabel : "Publish Update"}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center justify-between">
                  Recent Updates <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{updates.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {updatesQ.isLoading ? (
                  <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
                ) : updates.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-10 px-4">No updates yet. Your published updates will appear here.</p>
                ) : (
                  <div className="space-y-4">
                    {updates.map((u: FeedUpdate) => (
                      <div key={u._id} className="border border-border rounded-xl p-4 bg-card/50 shadow-sm relative overflow-hidden group">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors"></div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLORS[u.type] ?? TYPE_COLORS.update}`}>{u.type.toUpperCase()}</span>
                          <span className="text-xs text-muted-foreground font-medium">{timeAgo(u.createdAt)}</span>
                        </div>
                        <h4 className="font-bold text-foreground text-sm leading-tight mb-1">{u.title}</h4>
                        <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">{u.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        <TabsContent value="build" className="mt-6">
          {orgQ.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : org && user ? (
            <ProfileEditor key={`${user.id}:${org._id}`} org={org} userId={user.id} token={token!} />
          ) : (
            <div className="text-center py-12 px-4 border border-dashed border-border rounded-2xl">
              <AlertCircle className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="font-semibold text-foreground">We couldn't load your profile.</p>
              <Button variant="outline" className="mt-3" onClick={() => orgQ.refetch()} data-testid="button-retry-profile">Try again</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-2">
          {orgId && token && user ? (
            <CampaignsManager orgId={orgId} userId={user.id} token={token} org={orgQ.data} />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );

}