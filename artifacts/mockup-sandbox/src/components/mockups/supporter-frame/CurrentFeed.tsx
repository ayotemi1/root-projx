import { useMemo, useState } from "react";
import "./_group.css";
import { useQuery, useMutation, useQueryClient, Link, useLocation, useAuth, api, ContentDialog, useToast, userErrorMessage } from "./_boundaries";
import { ArrowRight, Play, Share2, Images, Film, Check, Plus } from "lucide-react";
import type { FeedUpdate } from "@/lib/api";
import { summarise } from "@/lib/content-media";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "RP";
}
function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function PostCard({ item, onOpen, following, onFollow, followBusy }: {
  item: FeedUpdate; onOpen: () => void; following: boolean | null; onFollow: () => void; followBusy: boolean;
}) {
  const { toast } = useToast();
  const s = summarise(item);
  const cover = s.images[0];
  const hasVideo = s.videos.length > 0 || !!s.link?.embedUrl;
  const count = s.images.length + s.videos.length;
  const kind = hasVideo ? "Video" : cover ? "Photo" : s.link ? s.link.label : "Update";
  const orgName = item.orgName || "Organisation";

  async function share() {
    const url = `${window.location.origin}/organisations/${item.orgId}`;
    const title = item.title || `${orgName} on Root ProjX`;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "The organisation link is on your clipboard." });
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") toast({ title: "Couldn't share", description: "Copy the address from your browser instead.", variant: "destructive" });
    }
  }

  return (
    <article className="rp-rise" data-testid={`card-content-${item._id}`}>
      <header className="flex items-center gap-3 mb-3">
        <Link href={`/organisations/${item.orgId}`} className="w-12 h-12 border border-[#17100F]/25 bg-[#FBF8F2] flex items-center justify-center text-[14px] font-bold shrink-0">
          {initials(orgName)}
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/organisations/${item.orgId}`} className="text-[18px] font-bold leading-tight hover:underline truncate block">{orgName}</Link>
          <p className="rp-label !text-[12px] text-[#17100F]/60">{dateLabel(item.createdAt)}</p>
        </div>
        {following !== true && (
          <button
            type="button"
            onClick={onFollow}
            disabled={followBusy}
            className="min-h-11 text-[16px] font-bold text-[#CA0813] hover:underline underline-offset-2 disabled:opacity-50 inline-flex items-center gap-1"
            data-testid={`button-follow-${item._id}`}
          >
            <Plus className="w-3.5 h-3.5" /> Follow
          </button>
        )}
        {following === true && (
          <span className="text-[14px] text-[#17100F]/60 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Following</span>
        )}
      </header>

      <button
        type="button"
        onClick={onOpen}
        className="group relative block w-full aspect-[4/3] overflow-hidden bg-[#17100F] text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-[#F3BF2C]"
        aria-label={`Open ${item.title || `${orgName} post`}`}
        data-testid={`button-open-post-${item._id}`}
      >
        {cover ? (
          <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        ) : s.videos[0] ? (
          <video src={`${s.videos[0]}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover pointer-events-none" aria-hidden />
        ) : (
          <div className="w-full h-full bg-[#F3BF2C] p-6 sm:p-8 flex items-end">
            <p className="rp-display text-[#17100F] text-[30px] sm:text-[40px] line-clamp-4">{item.title || item.content}</p>
          </div>
        )}
        <span className="absolute top-3 left-3 rp-label !text-[12px] bg-[#17100F] text-white px-2 py-1">{kind}</span>
        {count > 1 && (
          <span className="absolute top-3 right-3 rp-label !text-[12px] bg-[#17100F]/80 text-white px-2 py-1 inline-flex items-center gap-1"><Images className="w-3 h-3" />{count}</span>
        )}
        {hasVideo && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-14 h-14 rounded-full bg-[#F3BF2C] flex items-center justify-center transition-transform group-hover:scale-110">
              <Play className="w-5 h-5 text-[#17100F] fill-[#17100F] ml-0.5" />
            </span>
          </span>
        )}
      </button>

      {(item.title || item.content) && (
        <div className="mt-4">
          {item.title && <h2 className="rp-display text-[30px] sm:text-[40px] text-[#17100F]">{item.title}</h2>}
          {item.content && (
            <p className="mt-2 text-[18px] leading-relaxed text-[#17100F]/85 line-clamp-3">
              {item.content}{" "}
            </p>
          )}
          <button type="button" onClick={onOpen} className="min-h-11 text-[16px] font-bold underline underline-offset-2 mt-1" data-testid={`button-more-${item._id}`}>More</button>
        </div>
      )}

      <footer className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={share} className="p-3.5 -ml-3.5 text-[#17100F]/80 hover:text-[#17100F]" aria-label="Share" data-testid={`button-share-${item._id}`}>
          <Share2 className="w-4 h-4" />
        </button>
        <Link href={`/donate/${item.orgId}`} className="min-h-11 text-[16px] inline-flex items-center gap-1.5 group" data-testid={`link-donate-${item._id}`}>
          <span className="rp-link-u">Donate to {orgName}</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </footer>
    </article>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-16" data-testid="status-content-loading">
      {[0, 1].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="flex gap-3 mb-3"><div className="w-9 h-9 bg-[#17100F]/10" /><div className="h-4 w-40 bg-[#17100F]/10 mt-2" /></div>
          <div className="aspect-[4/3] bg-[#17100F]/10" />
          <div className="h-7 w-3/4 bg-[#17100F]/10 mt-4" />
        </div>
      ))}
    </div>
  );
}

export default function FeedPage() {
  const { isAuthenticated, token, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"public" | "mine">("public");
  const [open, setOpen] = useState<FeedUpdate | null>(null);
  const [, navigate] = useLocation();

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
  const canFollow = isAuthenticated && user?.accountType === "supporter";
  const followsQ = useQuery({
    queryKey: ["follows", "my", token],
    queryFn: () => api.getMyFollows(token!),
    enabled: canFollow,
  });
  const followed = useMemo(() => new Set((followsQ.data ?? []).map((o) => o._id)), [followsQ.data]);

  const follow = useMutation({
    mutationFn: (orgId: string) => api.followOrg(orgId, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follows", "my", token] });
      qc.invalidateQueries({ queryKey: ["feed", "mine", token] });
      toast({ title: "Following", description: "Their posts will appear in your Following tab." });
    },
    onError: (err) => toast({ title: "Couldn't follow", description: userErrorMessage(err, "follow this organisation"), variant: "destructive" }),
  });

  const active = mode === "mine" && isAuthenticated ? mineQ : publicQ;
  const items = active.data ?? [];

  const followState = (orgId: string): boolean | null => {
    if (!isAuthenticated) return false;
    if (!canFollow) return true; // organisations don't follow; hide the control
    if (followsQ.isLoading) return true;
    return followed.has(orgId);
  };
  const onFollow = (orgId: string) => {
    if (!isAuthenticated) { navigate("/login"); return; }
    follow.mutate(orgId);
  };

  return (
    <div className="rp-page-shell py-10 sm:py-14 grid lg:grid-cols-[280px_minmax(0,1fr)] gap-10 lg:gap-16" data-testid="page-live-feed">
      <aside className="lg:sticky lg:top-28 self-start">
        <h1 className="rp-display text-[72px] sm:text-[104px] text-[#17100F] rp-rise">Live<br />Feed</h1>
        <p className="rp-label mt-6 text-[#17100F]/85 leading-relaxed max-w-[280px]">
          Photos, videos, campaigns and everyday moments from organisations.
        </p>
        <div className="mt-8 flex gap-6 border-b border-[#17100F]/15" role="tablist">
          {(["public", "mine"] as const).map((m) => {
            const disabled = m === "mine" && !isAuthenticated;
            const on = mode === m;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={on}
                disabled={disabled}
                onClick={() => !disabled && setMode(m)}
                className={`rp-label !text-[14px] !tracking-[.04em] !normal-case min-h-11 pb-2 -mb-px border-b-2 transition-colors ${
                  on ? "border-[#CA0813] text-[#17100F]" : disabled ? "border-transparent text-[#17100F]/35 cursor-not-allowed" : "border-transparent text-[#17100F]/60 hover:text-[#17100F]"
                }`}
                data-testid={`tab-feed-${m}`}
              >
                {m === "public" ? "All posts" : "Following"}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-[16px] text-[#17100F]/75 leading-relaxed max-w-[280px]">
          {mode === "public"
            ? "Every published post from organisations on Root ProjX, newest first."
            : "Posts from the organisations you follow, newest first."}
          {!isAuthenticated && (
            <> <Link href="/login" className="font-bold underline underline-offset-2">Sign in</Link> to see your Following feed.</>
          )}
        </p>
      </aside>

      <section className="max-w-[860px] w-full min-w-0" aria-label="Organisation posts">
        {active.isLoading ? (
          <FeedSkeleton />
        ) : active.isError ? (
          <div className="border border-[#17100F] p-8 text-center" role="alert">
            <p className="rp-display text-[28px]">We couldn't load these posts.</p>
            <button type="button" className="rp-btn rp-btn-yellow mt-5" onClick={() => active.refetch()} data-testid="button-retry-content">Try again</button>
          </div>
        ) : items.length === 0 ? (
          <div className="border border-dashed border-[#17100F]/40 p-10 text-center">
            <Film className="w-6 h-6 mx-auto text-[#CA0813]" />
            <p className="rp-display text-[28px] mt-3">{mode === "mine" ? "Nothing here yet" : "No posts yet"}</p>
            <p className="text-sm text-[#17100F]/70 mt-2">
              {mode === "mine" ? "Follow organisations to see their posts here." : "Photos, videos, stories and everyday moments will appear here once posted."}
            </p>
            {mode === "mine" && <Link href="/discover" className="rp-btn rp-btn-yellow mt-5">Discover organisations <ArrowRight className="w-4 h-4" /></Link>}
          </div>
        ) : (
          <div className="space-y-20" data-testid="posts-grid">
            {items.map((u) => (
              <PostCard
                key={u._id}
                item={u}
                onOpen={() => setOpen(u)}
                following={followState(u.orgId)}
                onFollow={() => onFollow(u.orgId)}
                followBusy={follow.isPending && follow.variables === u.orgId}
              />
            ))}
            <p className="rp-label !text-[12px] text-center text-[#17100F]/55 pt-4">You're all caught up</p>
          </div>
        )}
      </section>
      <ContentDialog item={open} onClose={() => setOpen(null)} />
    </div>
  );
}
