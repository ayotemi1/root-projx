import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Heart, MessageCircle, HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}


type PostData = {
  _id: string;
  orgId: string;
  orgName: string;
  title: string;
  content: string;
  likes?: number;
  createdAt: string;
};

function PostCard({ post }: { post: PostData }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes ?? 0);
  const isPlaceholder = post.orgId === "placeholder";

  function handleLike() {
    if (liked) {
      setLiked(false);
      setLikeCount((n) => Math.max(0, n - 1));
    } else {
      setLiked(true);
      setLikeCount((n) => n + 1);
    }
  }

  return (
    <article className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
          {initials(post.orgName)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{post.orgName}</p>
          <p className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</p>
        </div>
      </div>

      {/* Media placeholder */}
      <div className="w-full bg-secondary/60 aspect-video flex items-center justify-center">
        <span className="text-xs text-muted-foreground italic">Photo / video</span>
      </div>

      {/* Caption */}
      <div className="px-4 pt-3 pb-1">
        <p className="font-semibold text-sm text-foreground mb-0.5">{post.title}</p>
        <p className="text-sm text-foreground/75 leading-relaxed">{post.content}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            liked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
          }`}
        >
          <Heart className={`w-5 h-5 ${liked ? "fill-red-500" : ""}`} />
          <span>{likeCount}</span>
        </button>
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <MessageCircle className="w-5 h-5" />
          <span>Comment</span>
        </button>
        <div className="ml-auto">
          {isPlaceholder ? (
            <Link href="/discover">
              <button className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                <HandHeart className="w-4 h-4" />
                Support
              </button>
            </Link>
          ) : (
            <Link href={`/organisations/${"orgId" in post ? post.orgId : ""}`}>
              <button className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                <HandHeart className="w-4 h-4" />
                Support
              </button>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export default function HomePage() {
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
  const { data: liveUpdates = [], isLoading } = active;

  const posts = liveUpdates;

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-foreground">Home</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Updates from the grassroots.</p>
      </div>

      {/* Toggle */}
      <div className="flex gap-2 p-1 bg-secondary rounded-lg w-fit mb-5">
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
      ) : isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
              <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                <div className="w-10 h-10 rounded-full bg-secondary" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 bg-secondary rounded w-1/3" />
                  <div className="h-3 bg-secondary rounded w-1/5" />
                </div>
              </div>
              <div className="w-full aspect-video bg-secondary" />
              <div className="px-4 py-3 space-y-2">
                <div className="h-3.5 bg-secondary rounded w-2/3" />
                <div className="h-3 bg-secondary rounded w-full" />
                <div className="h-3 bg-secondary rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-3xl mb-3">🌱</p>
          <p className="font-semibold text-foreground mb-1">Nothing here yet</p>
          <p className="text-muted-foreground text-sm mb-5">
            Be the first — discover organisations and follow the ones you care about.
          </p>
          <Link href="/discover">
            <Button>Discover organisations</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((p) => (
            <PostCard key={p._id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
