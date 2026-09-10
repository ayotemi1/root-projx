import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { FeedUpdate } from "@/lib/api";

/** Detect video by file extension embedded in the Firebase Storage URL. */
function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return [".mp4", ".mov", ".webm", ".avi", ".m4v", ".ogv"].some((ext) =>
    lower.includes(ext),
  );
}

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  milestone: {
    label: "Milestone",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  campaign: {
    label: "Campaign",
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  update: {
    label: "Update",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function UpdateCard({ item }: { item: FeedUpdate }) {
  const [, navigate] = useLocation();
  const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.update!;
  const mediaUrls = item.mediaUrls ?? [];

  // First photo to use as full-width hero; fall back to legacy imageUrl
  const heroPhoto = mediaUrls.find((u) => !isVideoUrl(u)) ?? item.imageUrl ?? null;
  // First video (shown as hero block when there's no photo at all)
  const firstVideo = mediaUrls.find((u) => isVideoUrl(u)) ?? null;
  const showVideoHero = !heroPhoto && !!firstVideo;
  // Extra thumbnails: every media item that isn't the hero photo/video shown above
  const extraMedia = mediaUrls.filter((u) => u !== heroPhoto && !(showVideoHero && u === firstVideo));
  const hasMedia = mediaUrls.length > 0;

  function handleCardClick() {
    navigate(`/organisations/${item.orgId}`);
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === "Enter" && handleCardClick()}
      className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer hover:border-primary/30"
    >
      {/* Hero: first photo, full width */}
      {heroPhoto && (
        <div className="w-full h-48 overflow-hidden bg-secondary">
          <img
            src={heroPhoto}
            alt="update media"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Hero: video-only post — show a prominent play block */}
      {showVideoHero && (
        <a
          href={firstVideo!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-3 w-full h-40 bg-secondary border-b border-border text-foreground/70 hover:text-foreground transition-colors"
        >
          <Video className="w-8 h-8 text-muted-foreground" />
          <span className="text-sm font-semibold">Watch video</span>
        </a>
      )}

      <div className="p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="font-bold text-primary text-sm truncate max-w-xs">
            {item.orgName}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${config.className}`}>
              {config.label}
            </span>
            <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
          </div>
        </div>
        <h3 className="font-bold text-foreground text-base leading-snug mb-2">
          {item.title}
        </h3>
        <p className="text-foreground/70 text-sm leading-relaxed line-clamp-3">
          {item.content}
        </p>

        {/* Extra media thumbnails */}
        {extraMedia.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {extraMedia.map((url, i) =>
              isVideoUrl(url) ? (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-14 h-14 bg-secondary rounded-lg flex items-center justify-center border border-border flex-shrink-0"
                >
                  <Video className="w-5 h-5 text-muted-foreground" />
                </a>
              ) : (
                <img
                  key={i}
                  src={url}
                  alt="media"
                  className="w-14 h-14 object-cover rounded-lg border border-border flex-shrink-0"
                />
              ),
            )}
          </div>
        )}

        <div className="mt-3 text-sm text-muted-foreground">
          ♥ {item.likes ?? 0}
          {hasMedia && <span className="ml-3">📷 {mediaUrls.length}</span>}
        </div>
      </div>
    </div>
  );
}

function UpdateSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-20" /></div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export default function FeedPage() {
  const { isAuthenticated, token } = useAuth();
  const [mode, setMode] = useState<"public" | "mine">("public");

  const publicQ = useQuery({
    queryKey: ["feed", "public"],
    queryFn: api.getPublicFeed,
    enabled: mode === "public",
  });

  const mineQ = useQuery({
    queryKey: ["feed", "mine"],
    queryFn: () => api.getMyFeed(token!),
    enabled: mode === "mine" && isAuthenticated,
  });

  const active = mode === "mine" && isAuthenticated ? mineQ : publicQ;
  const { data: updates = [], isLoading, isError, refetch } = active;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-foreground">Impact Feed</h1>
        <p className="text-muted-foreground mt-1">
          Live updates from grassroots organisations.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 p-1 bg-secondary rounded-lg w-fit mb-6">
        {(["public", "mine"] as const).map((m) => {
          const disabled = m === "mine" && !isAuthenticated;
          return (
            <button
              key={m}
              disabled={disabled}
              onClick={() => !disabled && setMode(m)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : disabled
                  ? "text-muted-foreground/50 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "public" ? "All Updates" : "For You"}
            </button>
          );
        })}
      </div>

      {mode === "mine" && !isAuthenticated ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">Sign in to see your personalised feed.</p>
          <Link href="/login">
            <Button>Sign in</Button>
          </Link>
        </div>
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-destructive mb-4">Could not load updates.</p>
          <Button onClick={() => refetch()} variant="outline">Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <UpdateSkeleton key={i} />)}
        </div>
      ) : updates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {mode === "mine"
            ? "Follow organisations to see their updates here."
            : "No updates yet."}
        </div>
      ) : (
        <div className="space-y-4">
          {updates.map((u) => <UpdateCard key={u._id} item={u} />)}
        </div>
      )}
    </div>
  );
}
