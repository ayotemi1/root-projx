import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { CheckCircle, PlusCircle, Image as ImageIcon, X, Banknote, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { FeedUpdate } from "@/lib/api";

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

export default function DashboardPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const search = useSearch();

  const [showForm, setShowForm] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postType, setPostType] = useState<typeof UPDATE_TYPES[number]>("update");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done">("idle");
  const [formError, setFormError] = useState("");

  const orgId = user?.id ?? "";
  const connectComplete = new URLSearchParams(search).get("connect") === "complete";

  const orgQ = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId, token),
    enabled: !!orgId,
  });

  const connectQ = useQuery({
    queryKey: ["connect-status", orgId],
    queryFn: () => api.getConnectStatus(token!),
    enabled: !!token,
  });

  useEffect(() => {
    if (connectComplete) {
      connectQ.refetch();
    }
  }, [connectComplete]);

  const updatesQ = useQuery({
    queryKey: ["org-feed", orgId],
    queryFn: () => api.getOrgFeed(orgId),
    enabled: !!orgId,
  });

  const postMut = useMutation({
    mutationFn: async () => {
      // 1. Upload any selected files first
      let mediaUrls: string[] = [];
      if (selectedFiles.length > 0) {
        setUploadProgress("uploading");
        mediaUrls = await api.uploadMedia(selectedFiles, token!);
        setUploadProgress("done");
      }
      // 2. Post the update with media URLs
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
      setSelectedFiles([]);
      setPreviewUrls([]);
      setUploadProgress("idle");
      setShowForm(false);
      setFormError("");
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
    if (files.length + selectedFiles.length > 5) {
      setFormError("You can attach up to 5 files per update.");
      return;
    }
    setFormError("");
    const newFiles = [...selectedFiles, ...files].slice(0, 5);
    setSelectedFiles(newFiles);
    // Generate previews
    const urls = newFiles.map((f) =>
      f.type.startsWith("video/") ? "" : URL.createObjectURL(f),
    );
    setPreviewUrls(urls);
  }

  function removeFile(index: number) {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setPreviewUrls(newFiles.map((f) =>
      f.type.startsWith("video/") ? "" : URL.createObjectURL(f),
    ));
  }

  function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!postTitle.trim()) { setFormError("Title is required."); return; }
    if (!postContent.trim()) { setFormError("Content is required."); return; }
    setFormError("");
    postMut.mutate();
  }

  function resetForm() {
    setShowForm(false);
    setPostTitle("");
    setPostContent("");
    setPostType("update");
    setSelectedFiles([]);
    setPreviewUrls([]);
    setUploadProgress("idle");
    setFormError("");
  }

  const org = orgQ.data;
  const updates = updatesQ.data ?? [];
  const isSubmitting = postMut.isPending;
  const uploadLabel =
    uploadProgress === "uploading"
      ? "Uploading media…"
      : uploadProgress === "done"
        ? "Publishing…"
        : "Publish Update";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Hero */}
      <div className="bg-nav rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-extrabold flex-shrink-0">
            {(org?.name ?? user?.name ?? "")
              .split(" ")
              .map((w: string) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase() || "??"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white">
                {org?.name ?? user?.name ?? "Your Organisation"}
              </h1>
              {org?.verified && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-accent border border-accent/30 px-2 py-0.5 rounded-full bg-accent/10">
                  <CheckCircle className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            {org && (
              <p className="text-white/60 text-sm">
                {[org.city, org.country].filter(Boolean).join(", ")} · {org.category}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5 bg-white/10 rounded-xl p-4">
          {[
            { label: "Followers", value: org?.followerCount ?? 0 },
            { label: "Updates", value: updates.length },
            { label: "Raised", value: `£${(org?.totalRaised ?? 0).toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-xl font-extrabold text-white">{value}</div>
              <div className="text-xs text-white/60 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stripe Connect — bank / payouts panel */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="w-4 h-4" style={{ color: "#CC0000" }} />
            Payouts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connectQ.isLoading ? (
            <div className="h-8 bg-secondary rounded animate-pulse" />
          ) : connectQ.data?.payouts_enabled ? (
            <div className="space-y-4">
              {/* Status badge */}
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm font-semibold text-green-700">Payouts enabled</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary rounded-xl p-4 text-center">
                  <div className="text-xl font-extrabold text-foreground">
                    £{(org?.totalRaised ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Total donations</div>
                </div>
                <div className="bg-secondary rounded-xl p-4 text-center">
                  <div className="text-xl font-extrabold text-foreground">—</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Pending payout</div>
                </div>
              </div>

              {/* Stripe Express dashboard link */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={async () => {
                  try {
                    const { url } = await api.getConnectDashboardLink(token!);
                    window.open(url, "_blank", "noopener,noreferrer");
                  } catch {
                    alert("Could not open Stripe dashboard. Please try again.");
                  }
                }}
              >
                <ExternalLink className="w-4 h-4" />
                View payouts on Stripe
              </Button>
            </div>
          ) : connectQ.data?.stripe_account_id ? (
            /* Account created but onboarding not complete */
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                Finish setting up your Stripe account to receive donations.
              </div>
              <a href="/api/stripe/connect/onboard">
                <Button
                  className="w-full font-bold text-black"
                  style={{ backgroundColor: "#F5C000" }}
                >
                  Complete bank setup
                </Button>
              </a>
            </div>
          ) : (
            /* No Stripe account yet */
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your bank account so donors can send money directly to your organisation. Root ProjX takes a 5% platform fee automatically.
              </p>
              <a href="/api/stripe/connect/onboard">
                <Button
                  className="w-full font-bold text-black"
                  style={{ backgroundColor: "#F5C000" }}
                >
                  Connect your bank account
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post update */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Post an Update</CardTitle>
            <Button
              variant={showForm ? "outline" : "default"}
              size="sm"
              onClick={() => (showForm ? resetForm() : setShowForm(true))}
            >
              <PlusCircle className="w-4 h-4 mr-1.5" />
              {showForm ? "Cancel" : "New Update"}
            </Button>
          </div>
        </CardHeader>

        {showForm && (
          <CardContent>
            <form onSubmit={handlePost} className="space-y-4">
              {formError && (
                <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {formError}
                </div>
              )}

              {/* Type */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Type</Label>
                <div className="flex gap-2">
                  {UPDATE_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPostType(t)}
                      className={`flex-1 py-2 text-sm font-semibold rounded-lg border-2 transition-colors capitalize ${
                        postType === t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Update title…"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="Tell your supporters what's happening…"
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  rows={5}
                  className="mt-1"
                />
              </div>

              {/* Media upload */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">
                  Photos &amp; Videos
                  <span className="text-muted-foreground font-normal ml-1">(optional, up to 5)</span>
                </Label>

                {/* Previews */}
                {selectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedFiles.map((file, i) => (
                      <div key={i} className="relative group">
                        {file.type.startsWith("video/") ? (
                          <div className="w-20 h-20 bg-secondary rounded-lg flex items-center justify-center border border-border">
                            <span className="text-2xl">🎬</span>
                          </div>
                        ) : (
                          <img
                            src={previewUrls[i]}
                            alt="preview"
                            className="w-20 h-20 object-cover rounded-lg border border-border"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <p className="text-xs text-muted-foreground mt-1 w-20 truncate text-center">
                          {file.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {selectedFiles.length < 5 && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      <ImageIcon className="w-4 h-4" />
                      {selectedFiles.length === 0
                        ? "Add photos or videos"
                        : `Add more (${selectedFiles.length}/5 selected)`}
                    </button>
                  </>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold"
                disabled={isSubmitting}
              >
                {isSubmitting ? uploadLabel : "Publish Update"}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Updates list */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Updates ({updates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {updatesQ.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20" /><Skeleton className="h-20" />
            </div>
          ) : updates.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              No updates yet. Post your first update above.
            </p>
          ) : (
            <div className="space-y-4">
              {updates.map((u: FeedUpdate) => (
                <div key={u._id} className="border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        TYPE_COLORS[u.type] ?? TYPE_COLORS.update
                      }`}
                    >
                      {u.type.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(u.createdAt)}</span>
                  </div>
                  <h4 className="font-bold text-foreground text-sm">{u.title}</h4>
                  <p className="text-foreground/70 text-sm leading-relaxed line-clamp-2">
                    {u.content}
                  </p>
                  {/* Media thumbnails */}
                  {u.mediaUrls && u.mediaUrls.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {u.mediaUrls.map((url, i) => (
                        url.includes("video") ? (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-16 h-16 bg-secondary rounded-lg flex items-center justify-center text-xl border border-border"
                          >
                            🎬
                          </a>
                        ) : (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={url}
                              alt="media"
                              className="w-16 h-16 object-cover rounded-lg border border-border"
                            />
                          </a>
                        )
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">♥ {u.likes ?? 0} likes</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
