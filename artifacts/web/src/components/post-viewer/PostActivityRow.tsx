import { useState } from "react";
import { Heart, MessageCircle, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { GuestJoinPrompt } from "@/components/guest-feed/GuestJoinPrompt";
import { POST_GENERIC_ERROR, usePostActivity, usePostActivityActions, type PostRef } from "@/lib/post-activity";
import { postPath, usePostViewer } from "./PostViewerProvider";

/** Compact like/comment counts for cards; shares the viewer's activity cache so reactions stay in sync. */
export function PostActivityRow({ postRef, label, className = "" }: { postRef: PostRef; label?: string; className?: string }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const viewer = usePostViewer();
  const activity = usePostActivity(postRef);
  const { like } = usePostActivityActions(postRef);
  const [guest, setGuest] = useState<string | null>(null);
  const a = activity.data;
  const share = async () => {
    if (!isAuthenticated) { setGuest("share posts"); return; }
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const url = `${window.location.origin}${base}${postPath(postRef)}`;
    try {
      if (navigator.share) await navigator.share({ title: label || "Root ProjX", url });
      else { await navigator.clipboard.writeText(url); toast({ title: "Link copied" }); }
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") toast({ title: POST_GENERIC_ERROR, variant: "destructive" });
    }
  };
  const n = (v: number | undefined) => activity.isLoading
    ? <span className="inline-block w-3 h-2.5 bg-[#17100F]/15 animate-pulse" aria-hidden />
    : activity.isError ? null : <span className="tabular-nums">{v}</span>;

  return (
    <span className={`inline-flex items-center ${className}`} data-testid={`row-activity-${postRef.id}`}>
      <button type="button" aria-pressed={!!a?.liked} disabled={isAuthenticated && (!a || like.isPending)}
        aria-label={a ? `${a.liked ? "Unlike" : "Like"}${a.likesHidden ? "" : ` · ${a.likes} likes`}` : "Like"}
        onClick={() => {
          if (!isAuthenticated) { setGuest("like posts"); return; }
          if (a) like.mutate(!a.liked, { onError: () => toast({ title: POST_GENERIC_ERROR, variant: "destructive" }) });
        }}
        className={`min-h-11 px-2 inline-flex items-center gap-1.5 text-[14px] font-semibold disabled:opacity-60 ${a?.liked ? "text-[#E0242F]" : "text-[#17100F]/80 hover:text-[#17100F]"}`}
        data-testid={`button-like-${postRef.id}`}>
        <Heart className={`w-[18px] h-[18px] ${a?.liked ? "fill-current" : ""}`} aria-hidden />{!a?.likesHidden && n(a?.likes)}
      </button>
      <button type="button" aria-label={a ? `Comments · ${a.commentCount}` : "Comments"}
        onClick={e => viewer.open({ refs: [postRef], index: 0, label, comments: true, trigger: e.currentTarget })}
        className="min-h-11 px-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#17100F]/80 hover:text-[#17100F]"
        data-testid={`button-comments-${postRef.id}`}>
        <MessageCircle className="w-[18px] h-[18px]" aria-hidden />{n(a?.commentCount)}
      </button>
      <button type="button" onClick={share} aria-label="Share" data-testid={`button-share-${postRef.id}`}
        className="min-h-11 min-w-11 px-2 inline-flex items-center justify-center text-[#17100F]/80 hover:text-[#17100F]">
        <Send className="w-[18px] h-[18px]" aria-hidden />
      </button>
      <GuestJoinPrompt action={guest} onClose={() => setGuest(null)} />
    </span>
  );
}
