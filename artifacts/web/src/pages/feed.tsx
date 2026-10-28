import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { ContentGallery } from "@/components/org-content/content-gallery";

export default function FeedPage() {
  const { isAuthenticated, token } = useAuth();
  const [mode, setMode] = useState<"public" | "mine">("public");
  const publicQ = useQuery({
    queryKey: ["feed", "public"],
    queryFn: api.getPublicFeed,
    enabled: mode === "public",
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const mineQ = useQuery({
    queryKey: ["feed", "mine", token],
    queryFn: () => api.getMyFeed(token!),
    enabled: mode === "mine" && isAuthenticated,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const active = mode === "mine" && isAuthenticated ? mineQ : publicQ;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-foreground">Live Feed</h1>
        <p className="text-muted-foreground mt-1">
          Photos, videos, stories and everyday moments from organisations.
        </p>
      </div>
      <div className="flex gap-2 p-1 bg-secondary rounded-lg w-fit mb-6">
        {(["public", "mine"] as const).map((m) => {
          const disabled = m === "mine" && !isAuthenticated;
          return (
            <button key={m} type="button" disabled={disabled}
              onClick={() => !disabled && setMode(m)} aria-pressed={mode === m}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                mode === m ? "bg-primary text-primary-foreground"
                  : disabled ? "text-muted-foreground/50 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
              }`}>
              {m === "public" ? "All posts" : "Following"}
            </button>
          );
        })}
      </div>
      <ContentGallery items={active.data ?? []} isLoading={active.isLoading}
        isError={active.isError} onRetry={() => active.refetch()} feed />
    </div>
  );
}
