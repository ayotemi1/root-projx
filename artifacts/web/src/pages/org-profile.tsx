import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, ArrowLeft, Heart, HeartOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { FeedUpdate, Review } from "@/lib/api";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  milestone: { label: "Milestone", className: "bg-green-50 text-green-700 border-green-200" },
  campaign:  { label: "Campaign",  className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  update:    { label: "Update",    className: "bg-blue-50 text-blue-700 border-blue-200" },
};

function UpdateRow({ item }: { item: FeedUpdate }) {
  const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.update!;
  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${config.className}`}>
          {config.label}
        </span>
        <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
      </div>
      <h4 className="font-bold text-foreground text-sm mb-1">{item.title}</h4>
      <p className="text-foreground/70 text-sm leading-relaxed line-clamp-3">{item.content}</p>
    </div>
  );
}

function ReviewRow({ item }: { item: Review }) {
  const stars = Array.from({ length: 5 }).map((_, i) => (
    <span key={i} className={i < item.rating ? "text-accent" : "text-muted-foreground/30"}>★</span>
  ));
  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-bold text-sm text-foreground">{item.authorName}</span>
        <div className="flex">{stars}</div>
      </div>
      <p className="text-foreground/70 text-sm leading-relaxed">{item.content}</p>
      <p className="text-xs text-muted-foreground mt-1.5">{timeAgo(item.createdAt)}</p>
    </div>
  );
}

export default function OrgProfilePage() {
  const [, params] = useRoute("/organisations/:id");
  const id = params?.id ?? "";
  const { isAuthenticated, token } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"updates" | "reviews">("updates");
  const [localFollow, setLocalFollow] = useState<boolean | null>(null);

  const orgQ = useQuery({
    queryKey: ["org", id],
    queryFn: () => api.getOrganisation(id, token),
    enabled: !!id,
  });

  const updatesQ = useQuery({
    queryKey: ["org-feed", id],
    queryFn: () => api.getOrgFeed(id),
    enabled: !!id,
  });

  const reviewsQ = useQuery({
    queryKey: ["org-reviews", id],
    queryFn: () => api.getOrgReviews(id),
    enabled: !!id,
  });

  const followsQ = useQuery({
    queryKey: ["follows", "my"],
    queryFn: () => api.getMyFollows(token!),
    enabled: isAuthenticated,
  });

  const followed =
    localFollow !== null
      ? localFollow
      : (followsQ.data ?? []).some((o) => o._id === id);

  const followMut = useMutation({
    mutationFn: () =>
      followed ? api.unfollowOrg(id, token!) : api.followOrg(id, token!),
    onSuccess: () => {
      setLocalFollow(!followed);
      queryClient.invalidateQueries({ queryKey: ["follows", "my"] });
      queryClient.invalidateQueries({ queryKey: ["org", id] });
    },
  });

  const org = orgQ.data;

  if (orgQ.isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        Organisation not found.
      </div>
    );
  }

  const initials = org.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Back */}
      <Link href="/">
        <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Discover
        </button>
      </Link>

      {/* Hero */}
      <div className="bg-nav rounded-2xl p-8 text-white mb-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-2xl font-extrabold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-extrabold text-white leading-tight">{org.name}</h1>
              {org.verified && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-accent border border-accent/30 px-2 py-0.5 rounded-full bg-accent/10">
                  <CheckCircle className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            <p className="text-white/70 text-sm mt-1">
              {[org.city, org.country].filter(Boolean).join(", ")}
            </p>
            <Badge
              variant="secondary"
              className="mt-2 bg-accent/20 text-accent border-accent/30 text-xs font-bold"
            >
              {org.category}
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 bg-white/10 rounded-xl p-4">
          {[
            { label: "Followers", value: org.followerCount ?? 0 },
            { label: "Raised", value: `£${(org.totalRaised ?? 0).toLocaleString()}` },
            { label: "Impact Score", value: org.impactScore ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-xl font-extrabold text-white">{value}</div>
              <div className="text-xs text-white/60 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex gap-3 mt-5">
          {isAuthenticated && (
            <Button
              variant="outline"
              size="sm"
              className={`border-white/40 font-semibold ${
                followed
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-transparent text-white hover:bg-white/10"
              }`}
              onClick={() => followMut.mutate()}
              disabled={followMut.isPending}
            >
              {followMut.isPending ? (
                <span>…</span>
              ) : followed ? (
                <><HeartOff className="w-4 h-4 mr-1.5" /> Following</>
              ) : (
                <><Heart className="w-4 h-4 mr-1.5" /> Follow</>
              )}
            </Button>
          )}
          <Link href={`/donate/${id}`}>
            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold"
            >
              Donate
            </Button>
          </Link>
        </div>
      </div>

      {/* About */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          About
        </h2>
        <p className="text-foreground text-sm leading-relaxed">{org.description}</p>
        {org.mission && (
          <>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 mt-5">
              Mission
            </h2>
            <p className="text-foreground text-sm leading-relaxed">{org.mission}</p>
          </>
        )}
      </div>

      {/* Updates / Reviews tabs */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex border-b border-border">
          {(["updates", "reviews"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                tab === t
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "updates" ? "Updates" : "Reviews"}
            </button>
          ))}
        </div>

        <div className="px-6">
          {tab === "updates" ? (
            updatesQ.isLoading ? (
              <div className="py-8 space-y-4">
                <Skeleton className="h-16" /><Skeleton className="h-16" />
              </div>
            ) : (updatesQ.data ?? []).length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No updates yet.</p>
            ) : (
              (updatesQ.data ?? []).map((u) => <UpdateRow key={u._id} item={u} />)
            )
          ) : (
            reviewsQ.isLoading ? (
              <div className="py-8 space-y-4">
                <Skeleton className="h-16" /><Skeleton className="h-16" />
              </div>
            ) : (reviewsQ.data ?? []).length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No reviews yet.</p>
            ) : (
              (reviewsQ.data ?? []).map((r) => <ReviewRow key={r._id} item={r} />)
            )
          )}
        </div>
      </div>
    </div>
  );
}
