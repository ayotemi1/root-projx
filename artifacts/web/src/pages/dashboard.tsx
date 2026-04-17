import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const [showForm, setShowForm] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postType, setPostType] = useState<typeof UPDATE_TYPES[number]>("update");
  const [formError, setFormError] = useState("");

  const orgId = user?.id ?? "";

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

  const postMut = useMutation({
    mutationFn: () =>
      api.postUpdate(
        { title: postTitle.trim(), content: postContent.trim(), type: postType },
        token!,
      ),
    onSuccess: () => {
      setPostTitle("");
      setPostContent("");
      setPostType("update");
      setShowForm(false);
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["org-feed", orgId] });
      queryClient.invalidateQueries({ queryKey: ["feed", "public"] });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!postTitle.trim()) { setFormError("Title is required."); return; }
    if (!postContent.trim()) { setFormError("Content is required."); return; }
    setFormError("");
    postMut.mutate();
  }

  const org = orgQ.data;
  const updates = updatesQ.data ?? [];

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

      {/* Post update */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Post an Update</CardTitle>
            <Button
              variant={showForm ? "outline" : "default"}
              size="sm"
              onClick={() => setShowForm(!showForm)}
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

              <Button
                type="submit"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold"
                disabled={postMut.isPending}
              >
                {postMut.isPending ? "Publishing…" : "Publish Update"}
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
                <div
                  key={u._id}
                  className="border border-border rounded-xl p-4 space-y-2"
                >
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
