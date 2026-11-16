import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import {
  CheckCircle, Image as ImageIcon, X, AlertCircle, Video, Compass, Circle,
} from "lucide-react";
import { DashboardOverview } from "@/components/dashboard/overview";
import { useWalkthrough } from "@/components/tour/use-walkthrough";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ProfileEditor, ProfilePreviewButton } from "@/components/profile-editor/profile-editor";
import type { FeedUpdate } from "@/lib/api";
import { externalLinkError, EXTERNAL_LINK_HELP, mediaKind } from "@/lib/content-media";
import { loadPendingPost, savePendingPost, clearPendingPost, type PendingPost } from "@/lib/pending-post";
import { userErrorMessage } from "@/lib/error-feedback";
import { videoFileProblem, uploadFeedback } from "@/lib/upload-feedback";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

// ── Main dashboard page ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, token } = useAuth();
  const adminAccess = token?.startsWith("org-admin.") ?? false;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const search = useSearch();

  // Update form state
  const [showForm, setShowForm] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const postType = "update" as const; // Legacy storage value; posts need no category.
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done">("idle");
  const [formError, setFormError] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  /** URLs already uploaded for this draft. Never re-uploaded on retry. */
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [recoverable, setRecoverable] = useState<PendingPost | null>(null);
  const [postFilter, setPostFilter] = useState<"published" | "archived">("published");
  const [postAction, setPostAction] = useState<{ post: FeedUpdate; status: "archived" | "deleted" } | null>(null);

  // Campaign form state


  const orgId = user?.id ?? "";
  const [, setLocation] = useLocation();
  const urlTab = new URLSearchParams(search).get("tab") ?? "";
  const explicitTab = ["overview", "build", "campaigns", "profile", "posts"].includes(urlTab);
  const connectComplete = new URLSearchParams(search).get("connect") === "complete";

  const orgQ = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId, token),
    enabled: !!orgId,
  });


  const updatesQ = useQuery({
    queryKey: ["managed-posts", orgId, token],
    queryFn: () => api.getManagedPosts(token!),
    enabled: !!orgId && !!token,
    staleTime: 30_000,
    refetchOnMount: "always",
  });
  const postStatusMut = useMutation({
    mutationFn: ({ postId, status }: { postId: string; status: "published" | "archived" | "deleted" }) =>
      api.setPostStatus(postId, status, token!),
    onSuccess: (post) => {
      setPostAction(null);
      queryClient.setQueryData<FeedUpdate[]>(["managed-posts", orgId, token], (posts) =>
        posts?.flatMap((item) => item._id === post._id ? post.status === "deleted" ? [] : [post] : [item]));
      for (const key of ["managed-posts", "org-feed", "feed", "dashboard-summary"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  const campaignsQ = useQuery({
    queryKey: ["campaigns", orgId],
    queryFn: () => api.getManagedCampaigns(orgId, token!),
    enabled: !!orgId && !!token,
  });

  // Offer recovery of attachments uploaded but never published.
  useEffect(() => {
    if (!orgId) return;
    setRecoverable(loadPendingPost(orgId));
  }, [orgId]);

  useEffect(() => {
    if (!orgId || uploadedUrls.length === 0) return;
    savePendingPost(orgId, { urls: uploadedUrls, title: postTitle, content: postContent,
      type: postType, externalUrl, savedAt: new Date().toISOString() });
  }, [orgId, uploadedUrls, postTitle, postContent, postType, externalUrl]);

  const postMut = useMutation({
    mutationFn: async () => {
      let mediaUrls = uploadedUrls;
      if (selectedFiles.length > 0) {
        setUploadProgress("uploading");
        // Persist each successful attachment before starting the next. A later
        // upload failure must not lose or re-upload the earlier files on retry.
        for (const file of selectedFiles) {
          let fresh: string[];
          try { fresh = await api.uploadMedia([file], token!); }
          catch (error) { throw new Error(uploadFeedback(error, file.type.startsWith("video/") ? "video" : "image", file.size).message); }
          mediaUrls = [...mediaUrls, ...fresh];
          setUploadedUrls(mediaUrls);
          setSelectedFiles(previous => previous.filter(candidate => candidate !== file));
          setPreviewUrls(previous => previous.slice(1));
          savePendingPost(orgId, { urls: mediaUrls, title: postTitle, content: postContent, type: postType, externalUrl, savedAt: new Date().toISOString() });
        }
      }
      setUploadProgress("done");
      const link = externalUrl.trim();
      return api.postUpdate(
        { title: postTitle.trim(), content: postContent.trim(), type: postType, mediaUrls, ...(link ? { externalUrl: link } : {}) },
        token!,
      );
    },
    onSuccess: () => {
      clearPendingPost(orgId); setRecoverable(null);
      setPostTitle(""); setPostContent(""); setExternalUrl(""); setUploadedUrls([]);
      setSelectedFiles([]); setPreviewUrls([]); setUploadProgress("idle");
      setShowForm(false); setFormError("");
      setPostFilter("published");
      queryClient.invalidateQueries({ queryKey: ["managed-posts", orgId] });
      queryClient.invalidateQueries({ queryKey: ["org-feed", orgId] });
      queryClient.invalidateQueries({ queryKey: ["feed", "public"] });
      queryClient.invalidateQueries({ queryKey: ["feed", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["org", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", orgId] });
    },
    onError: (e: Error) => {
      setUploadProgress("idle");
      setFormError(uploadedUrls.length > 0 || loadPendingPost(orgId)
        ? `${userErrorMessage(e, "publish this post")} Already uploaded attachments are saved; remaining files still need to upload. Press Publish post to retry.`
        : userErrorMessage(e, "publish this post"));
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length + selectedFiles.length + uploadedUrls.length > 5) { setFormError("You can attach up to 5 files per post."); return; }
    for (const file of files) {
      const problem = file.type.startsWith("video/") ? videoFileProblem(file)?.message
        : !file.size ? "This image file is empty. Choose another file."
        : !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
          ? "This image format isn’t supported. Choose JPEG, PNG, WebP or GIF. Convert HEIC photos to JPEG first."
        : file.size > 20 * 1024 * 1024 ? "This image is too large. Choose an image of 20 MB or smaller." : null;
      if (problem) { setFormError(problem); return; }
    }
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
    if (!postTitle.trim() && !postContent.trim() && !selectedFiles.length && !uploadedUrls.length && !externalUrl.trim()) {
      setFormError("Add a photo, video, link or caption to your post."); return;
    }
    const linkErr = externalLinkError(externalUrl);
    if (linkErr) { setFormError(linkErr); return; }
    setFormError("");
    postMut.mutate();
  }

  function resetForm() {
    setRecoverable(loadPendingPost(orgId));
    setUploadedUrls([]);
    setShowForm(false); setPostTitle(""); setPostContent("");
    setSelectedFiles([]); setPreviewUrls([]); setUploadProgress("idle"); setFormError("");
    setExternalUrl("");
  }

  function resumePending() {
    if (!recoverable) return;
    setUploadedUrls(recoverable.urls);
    setPostTitle(recoverable.title); setPostContent(recoverable.content);
    setExternalUrl(recoverable.externalUrl ?? "");
    setRecoverable(null);
  }

  function discardPending() {
    // Only forgets the local draft; uploaded files are not deleted.
    clearPendingPost(orgId); setRecoverable(null);
  }

  function detachUploaded(url: string) {
    const next = uploadedUrls.filter((u) => u !== url);
    setUploadedUrls(next);
    if (next.length === 0) clearPendingPost(orgId);
    else savePendingPost(orgId, { urls: next, title: postTitle, content: postContent, type: postType, externalUrl, savedAt: new Date().toISOString() });
  }

  const org = orgQ.data;
  const tour = useWalkthrough({ orgId, token, org: orgQ.data, campaigns: campaignsQ.data, explicitTab });
  // No flash: without an explicit ?tab, wait for walkthrough state, then Build for brand-new orgs.
  const deciding = !explicitTab && (tour.wtQ.isLoading || orgQ.isLoading || campaignsQ.isLoading);
  const tab = explicitTab ? urlTab : (tour.active ? "build" : "overview");
  const setTab = (v: string) => setLocation(`${adminAccess ? `/admin/organisations/${orgId}/manage` : "/dashboard"}?tab=${v}`);
  const doneCount = tour.items.filter((i) => i.done).length;
  const updates = (updatesQ.data ?? []).filter((post) => postFilter === "archived"
    ? post.status === "archived" : post.status !== "archived");
  const campaigns = (campaignsQ.data ?? []).filter((c) => c.status !== "deleted");

  const isSubmitting = postMut.isPending;
  const uploadLabel =
    uploadProgress === "uploading" ? "Uploading media…" :
    uploadProgress === "done" ? "Publishing…" : "Publish post";

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
            {orgId && (
              <div className="mt-1.5 [&_[role=alert]]:text-white [&_[role=alert]]:font-semibold">
                <ProfilePreviewButton orgId={orgId} tourId="dashboard-profile-preview" testId="link-dashboard-profile-preview"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline underline-offset-2 disabled:opacity-60" />
              </div>
            )}
          </div>
        </div>

      </div>

      {tour.syncError && (
        <p role="alert" className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2" data-testid="text-tour-sync-error">{tour.syncError}</p>
      )}

      <div className="flex flex-wrap justify-end gap-2 pb-2">
        {tour.allDone && !tour.active && tour.unfinished && (
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={tour.resume} data-testid="button-resume-walkthrough-compact">
            <Compass className="w-3.5 h-3.5 mr-1" /> Resume walkthrough
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-muted-foreground" data-testid="button-replay-menu">
              <Compass className="w-3.5 h-3.5 mr-1" /> Show me around
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => tour.replay("profile")} data-testid="menu-replay-profile">Profile walkthrough</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => tour.replay("campaign")} data-testid="menu-replay-campaign">Campaign walkthrough</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {deciding ? (
        <div className="space-y-4"><Skeleton className="h-11 rounded-lg" /><Skeleton className="h-64 rounded-2xl" /></div>
      ) : (
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-11 p-1 bg-secondary rounded-lg">
          <TabsTrigger value="overview" className="rounded-md font-bold text-xs sm:text-sm" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="posts" className="rounded-md font-bold text-xs sm:text-sm" data-testid="tab-posts">Posts</TabsTrigger>
          <TabsTrigger value="profile" className="rounded-md font-bold text-xs sm:text-sm">Payouts</TabsTrigger>
          <TabsTrigger value="build" className="rounded-md font-bold text-xs sm:text-sm" data-testid="tab-build-profile" data-tour-id="dashboard-tab-build-profile"><span className="sm:hidden">Profile</span><span className="hidden sm:inline">Build profile</span></TabsTrigger>
          <TabsTrigger value="campaigns" className="rounded-md font-bold text-xs sm:text-sm">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {orgId && token ? <DashboardOverview orgId={orgId} token={token} org={org} campaigns={campaigns} /> : null}
        </TabsContent>

        <TabsContent value="profile" className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-2">

          <PendingPayout key={`pending-${orgId}`} orgId={orgId} token={token!} />

          <div data-tour-id="payout-setup">
          {adminAccess ? <p className="text-sm text-muted-foreground">Manage payout approvals and settlement from Admin → Organisations and Payouts.</p> :
            <PayoutSetup key={orgId} orgId={orgId} token={token!} totalRaised={org?.totalRaised ?? 0} connectComplete={connectComplete} />}
          </div>

        </TabsContent>
        <TabsContent value="posts" className="space-y-6 mt-6">
          {/* General organisation posts, not restricted to progress updates. */}
          <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start pt-6">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base">Create a post</CardTitle>
                <p className="text-sm text-muted-foreground">Share your work, everyday moments, photos or videos. Posts appear on your profile and in the live feed.</p>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handlePost} className="space-y-5">
                  {recoverable && (
                    <div role="status" className="text-sm bg-accent/15 border border-accent/40 px-3 py-2.5 rounded-md space-y-2" data-testid="banner-pending-media">
                      <p className="font-medium">You have {recoverable.urls.length} uploaded {recoverable.urls.length === 1 ? "file" : "files"} from a post that wasn't published.</p>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" className="font-bold" onClick={resumePending} data-testid="button-resume-pending-media">Resume draft</Button>
                        <Button type="button" size="sm" variant="outline" onClick={discardPending} data-testid="button-discard-pending-media">Discard</Button>
                      </div>
                    </div>
                  )}
                  {formError && (
                    <div role="alert" className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md font-medium" data-testid="text-update-form-error">{formError}</div>
                  )}
                  <div>
                    <Label htmlFor="title" className="font-semibold">Title <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Input id="title" placeholder="Give your post a title…" maxLength={200} value={postTitle} onChange={(e) => setPostTitle(e.target.value)} className="mt-1.5 bg-secondary/30" />
                  </div>
                  <div>
                    <Label htmlFor="content" className="font-semibold">Caption <span className="font-normal text-muted-foreground">(optional with media)</span></Label>
                    <Textarea id="content" placeholder="Share a moment, a story, or anything from your organisation…" maxLength={5000} value={postContent} onChange={(e) => setPostContent(e.target.value)} rows={4} className="mt-1.5 bg-secondary/30" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Photos &amp; Videos <span className="text-muted-foreground font-normal ml-1">(up to 5)</span></Label>
                    <p className="text-xs text-muted-foreground mb-2">Add photos or videos from your work so donors can watch them right here.</p>
                    {uploadedUrls.length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-3" data-testid="list-uploaded-media">
                        {uploadedUrls.map((url) => (
                          <div key={url} className="relative group">
                            {mediaKind(url) === "video" ? (
                              <div className="w-16 h-16 bg-secondary rounded-lg flex items-center justify-center border border-primary/40"><Video className="w-6 h-6 text-muted-foreground" /></div>
                            ) : (
                              <img src={url} alt="Uploaded attachment" className="w-16 h-16 object-cover rounded-lg border border-primary/40" />
                            )}
                            <span className="absolute bottom-0 inset-x-0 text-[9px] font-bold text-center bg-primary text-white rounded-b-lg">Uploaded</span>
                            <button type="button" aria-label="Remove from this update" onClick={() => detachUploaded(url)} disabled={isSubmitting} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center shadow-sm"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
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
                    {selectedFiles.length + uploadedUrls.length < 5 && (
                      <>
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm" multiple className="hidden" onChange={handleFileChange} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 h-16 w-full border-2 border-dashed border-border rounded-lg text-sm font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors hover:bg-primary/5"><ImageIcon className="w-4 h-4" /> {selectedFiles.length + uploadedUrls.length === 0 ? "Upload photos or videos" : `Add more (${selectedFiles.length + uploadedUrls.length}/5)`}</button>
                        <p className="text-xs text-muted-foreground mt-2">Up to 5 files. Images: up to 20 MB each. Videos: MP4, MOV or WebM, up to 500 MB each. Keep this page open until uploading finishes.</p>
                      </>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="external-url" className="font-semibold">Video or post link <span className="text-muted-foreground font-normal ml-1">(optional)</span></Label>
                    <Input id="external-url" type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} aria-invalid={!!externalLinkError(externalUrl)} className="mt-1.5 bg-secondary/30" data-testid="input-external-url" />
                    <p className={`text-xs mt-1.5 ${externalLinkError(externalUrl) ? "text-destructive" : "text-muted-foreground"}`}>
                      {externalLinkError(externalUrl) ?? `${EXTERNAL_LINK_HELP} YouTube and Vimeo play on your profile; Instagram opens on Instagram, so upload the photo or video too if you want donors to see it here.`}
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button type="submit" className="w-full bg-primary text-white hover:bg-primary/90 font-bold h-11 text-base shadow-sm" disabled={isSubmitting || !!recoverable}>{isSubmitting ? uploadLabel : "Publish post"}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center justify-between">
                  Your posts <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{updates.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex gap-2 mb-4" aria-label="Post status">
                  <Button variant={postFilter === "published" ? "default" : "outline"} onClick={() => setPostFilter("published")}>Published</Button>
                  <Button variant={postFilter === "archived" ? "default" : "outline"} onClick={() => setPostFilter("archived")}>Archived</Button>
                </div>
                {postStatusMut.isError && <p role="alert" className="text-sm text-destructive mb-3">{userErrorMessage(postStatusMut.error, "change this post")}</p>}
                {updatesQ.isLoading ? (
                  <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
                ) : updatesQ.isError ? (
                  <div role="alert" className="text-sm"><p>{userErrorMessage(updatesQ.error, "load your posts")}</p><Button variant="outline" onClick={() => updatesQ.refetch()}>Try again</Button></div>
                ) : updates.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-10 px-4">{postFilter === "archived" ? "No archived posts. Archived posts are hidden from your public profile and the Live Feed. You can restore them here." : "No published posts yet."}</p>
                ) : (
                  <div className="space-y-4">
                    {updates.map((u: FeedUpdate) => (
                      <div key={u._id} className="border border-border rounded-xl p-4 bg-card/50 shadow-sm relative overflow-hidden group">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors"></div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-muted-foreground">POST</span>
                          <span className="text-xs text-muted-foreground font-medium">{timeAgo(u.createdAt)}</span>
                        </div>
                        <h4 className="font-bold text-foreground text-sm leading-tight mb-1">{u.title || (u.mediaUrls?.length ? "Photo / video post" : "Post")}</h4>
                        <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">{u.content}</p>
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {postFilter === "archived" ? (
                            <Button size="sm" variant="outline" disabled={postStatusMut.isPending} onClick={() => { postStatusMut.reset(); postStatusMut.mutate({ postId: u._id, status: "published" }); }}>Restore post</Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled={postStatusMut.isPending} onClick={() => { postStatusMut.reset(); setPostAction({ post: u, status: "archived" }); }}>Archive</Button>
                          )}
                          <Button size="sm" variant="outline" className="text-destructive" disabled={postStatusMut.isPending} onClick={() => { postStatusMut.reset(); setPostAction({ post: u, status: "deleted" }); }}>Delete</Button>
                        </div>
                        {postAction?.post._id === u._id && (
                          <div role="group" aria-label="Confirm post action" className="mt-3 p-3 border rounded-lg space-y-3">
                            <p className="text-sm">{postAction.status === "deleted" ? "Delete this post? It will be removed from your posts, profile and Live Feed. You cannot restore it. Uploaded files are not erased from storage." : "Archive this post? It will be hidden from your profile and Live Feed. You can restore it from Archived."}</p>
                            <div className="flex gap-2 flex-wrap">
                              <Button size="sm" variant="outline" disabled={postStatusMut.isPending} onClick={() => setPostAction(null)}>Cancel</Button>
                              <Button size="sm" disabled={postStatusMut.isPending} onClick={() => postStatusMut.mutate({ postId: u._id, status: postAction.status })}>{postStatusMut.isPending ? "Saving…" : postAction.status === "deleted" ? "Delete post" : "Archive post"}</Button>
                            </div>
                          </div>
                        )}
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
      )}

      {/* Setup checklist sits below the main content so Money stays first. */}
      {!tour.allDone && org && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm" id="setup-checklist" data-testid="block-setup-checklist">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="font-extrabold text-sm"><span className="text-primary">{doneCount} of 5 done</span> · Getting donor-ready</h2>
            {!tour.active && (
              <Button size="sm" className="h-8 font-bold" onClick={tour.resume} data-testid="button-resume-walkthrough">
                <Compass className="w-3.5 h-3.5 mr-1" /> {tour.started ? "Resume walkthrough" : "Start walkthrough"}
              </Button>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-3"><div className="h-full bg-primary rounded-full" style={{ width: `${doneCount * 20}%` }} /></div>
          <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {tour.items.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => setLocation(i.href)} className={`flex items-center gap-2 text-sm text-left ${i.done ? "text-muted-foreground line-through" : "font-semibold hover:text-primary"}`} data-testid={`checklist-${i.id}`}>
                  {i.done ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                  {i.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );

}