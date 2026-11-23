import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowRight, Play, Share2, Images, Film, Check, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { GuestFeed } from "@/components/guest-feed/GuestFeed";
import * as api from "@/lib/api";
import type { FeedUpdate } from "@/lib/api";
import { ContentDialog } from "@/components/org-content/content-gallery";
import { summarise } from "@/lib/content-media";
import { useToast } from "@/hooks/use-toast";
import { userErrorMessage } from "@/lib/error-feedback";
import { SupporterHomeIntro } from "@/components/supporter/SupporterHomeIntro";
import { OrganisationLogo } from "@/components/organisation-logo";
import { SupporterPostCard } from "@/components/supporter/SupporterPostCard";
import { BookmarkButton } from "@/components/bookmarks/BookmarkButton";
import { PostActivityRow } from "@/components/post-viewer/PostActivityRow";
import { listPosts, spKey, type SupporterPostRecord } from "@/lib/supporter-publishing";
import { DonationAmountDialog } from "@/components/donation-amount-dialog";
import { InlineVideoPlayer } from "@/components/inline-video-player";

type FeedEntry = { kind: "org"; at: number; item: FeedUpdate } | { kind: "sp"; at: number; post: SupporterPostRecord };

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function PostCard({ item, logo, onOpen, following, onFollow, followBusy }: {
  item: FeedUpdate; logo: string | null; onOpen: () => void; following: boolean | null; onFollow: () => void; followBusy: boolean;
}) {
  const { toast } = useToast();
  const [donateOpen, setDonateOpen] = useState(false);
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
      {donateOpen && <DonationAmountDialog onClose={() => setDonateOpen(false)} orgId={item.orgId} orgName={orgName} />}
      <header className="flex items-center gap-3 mb-3">
        <Link href={`/organisations/${item.orgId}`} className="shrink-0" aria-label={`Visit ${orgName}`}>
          <OrganisationLogo name={orgName} logo={logo} />
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

      {s.videos[0] ? (
        <div className="relative w-full aspect-[4/3] border border-[#17100F] bg-[#17100F]">
          <InlineVideoPlayer src={s.videos[0]} poster={cover} label={`${orgName} video`} />
          {count > 1 && <span className="absolute top-3 right-3 rp-label !text-[12px] bg-[#17100F]/80 text-white px-2 py-1 inline-flex items-center gap-1 pointer-events-none"><Images className="w-3 h-3" />{count}</span>}
        </div>
      ) : <button
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
      </button>}

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
        <PostActivityRow postRef={{ kind: "update", id: item._id }} label={item.orgName || undefined} className="-ml-2 -mr-3" />
        <button type="button" onClick={share} className="p-3.5 text-[#17100F]/80 hover:text-[#17100F]" aria-label="Share" data-testid={`button-share-${item._id}`}>
          <Share2 className="w-4 h-4" />
        </button>
        <BookmarkButton kind="update" targetId={item._id} className="mr-auto -ml-2" />
        <button type="button" onClick={() => setDonateOpen(true)} className="min-h-11 text-[16px] inline-flex items-center gap-1.5 group" data-testid={`link-donate-${item._id}`}>
          <span className="rp-link-u">Donate to {orgName}</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
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
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <SignedInFeed /> : <GuestFeed />;
}

function SignedInFeed() {
  const { isAuthenticated, token, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"public" | "mine">("public");
  const [open, setOpen] = useState<FeedUpdate | null>(null);
  const [, navigate] = useLocation();
  const supporterView = user?.accountType !== "organisation";

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

  const spFeed = mode === "mine" ? "following" : "for-you";
  const spQ = useQuery({
    queryKey: spKey({ feed: spFeed }, token),
    queryFn: () => listPosts({ feed: spFeed }, token),
    enabled: mode === "public" || isAuthenticated,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const active = mode === "mine" && isAuthenticated ? mineQ : publicQ;
  const spPosts = spQ.data ?? [];
  const entries = useMemo<FeedEntry[]>(() => [
    ...(active.data ?? []).map(item => ({ kind: "org" as const, at: Date.parse(item.createdAt) || 0, item })),
    ...(spQ.data ?? []).filter(p => !p.removed).map(post => ({ kind: "sp" as const, at: Date.parse(post.created_at) || 0, post })),
  ].sort((a, b) => b.at - a.at), [active.data, spQ.data]);
  const loading = (active.isLoading && !spPosts.length) || (spQ.isLoading && !(active.data ?? []).length);
  const failed = active.isError && (spQ.isError || !spPosts.length);
  const forYou = isAuthenticated && user?.accountType === "supporter";

  // Notification deep-link: /feed?post=<updateId> opens that published update once, after load.
  const search = useSearch();
  const linkedPost = new URLSearchParams(search).get("post");
  const handledPost = useRef<string | null>(null);
  const [postUnavailable, setPostUnavailable] = useState(false);
  useEffect(() => {
    if (!linkedPost) { handledPost.current = null; return; }
    if (handledPost.current === linkedPost) return;
    if (mode !== "public") { setMode("public"); return; }
    if (publicQ.isLoading) return;
    handledPost.current = linkedPost;
    const found = (publicQ.data ?? []).find(u => u._id === linkedPost);
    if (found) { setOpen(found); setPostUnavailable(false); } else setPostUnavailable(true);
  }, [linkedPost, mode, publicQ.isLoading, publicQ.data]);
  const closeDialog = () => {
    setOpen(null);
    if (linkedPost) navigate("/feed", { replace: true });
  };

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
    <div className={supporterView ? "rps-feed" : "rp-page-shell py-10 sm:py-14 grid lg:grid-cols-[280px_minmax(0,1fr)] gap-10 lg:gap-16"} data-testid="page-live-feed">
      {supporterView && <SupporterHomeIntro />}
      <aside className={supporterView ? "mb-7" : "lg:sticky lg:top-28 self-start"}>
        {!supporterView && <>
        <h1 className="rp-display text-[72px] sm:text-[104px] text-[#17100F] rp-rise">Live<br />Feed</h1>
        <p className="rp-label mt-6 text-[#17100F]/85 leading-relaxed max-w-[280px]">
          Photos, videos, campaigns and everyday moments from organisations.
        </p>
        </>}
        <div className={forYou ? "rps-home-feed-tabs" : `${supporterView ? "" : "mt-8 "}flex gap-6 border-b border-[#17100F]/15`} role="tablist" aria-label="Feed">
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
                className={forYou ? "rps-home-feed-tab" : `rp-label !text-[14px] !tracking-[.04em] !normal-case min-h-11 pb-2 -mb-px border-b-2 transition-colors ${
                  on ? "border-[#CA0813] text-[#17100F]" : disabled ? "border-transparent text-[#17100F]/35 cursor-not-allowed" : "border-transparent text-[#17100F]/60 hover:text-[#17100F]"
                }`}
                data-testid={`tab-feed-${m}`}
              >
                {m === "public" ? (forYou ? "For you" : "All posts") : "Following"}
              </button>
            );
          })}
        </div>
        <p className={`mt-4 text-[16px] text-[#17100F]/75 leading-relaxed${supporterView ? "" : " max-w-[280px]"}`}>
          {mode === "public"
            ? forYou ? "Every published organisation post, plus supporter posts matched to your interests, newest first." : "Every published post from organisations on Root ProjX, newest first."
            : forYou ? "Posts from the organisations and supporters you follow, newest first." : "Posts from the organisations you follow, newest first."}
          {!isAuthenticated && (
            <> <Link href="/login" className="font-bold underline underline-offset-2">Sign in</Link> to see your Following feed.</>
          )}
        </p>
      </aside>

      <section className="max-w-[860px] w-full min-w-0" aria-label="Posts">
        {loading ? (
          <FeedSkeleton />
        ) : failed ? (
          <div className="border border-[#17100F] p-8 text-center" role="alert">
            <p className="rp-display text-[28px]">We couldn't load these posts.</p>
            <button type="button" className="rp-btn rp-btn-yellow mt-5" onClick={() => { void active.refetch(); void spQ.refetch(); }} data-testid="button-retry-content">Try again</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="border border-dashed border-[#17100F]/40 p-10 text-center">
            <Film className="w-6 h-6 mx-auto text-[#CA0813]" />
            <p className="rp-display text-[28px] mt-3">{mode === "mine" ? "Nothing here yet" : "No posts yet"}</p>
            <p className="text-sm text-[#17100F]/70 mt-2">
              {mode === "mine" ? "Follow organisations and supporters to see their posts here." : "Photos, videos, stories and everyday moments will appear here once posted."}
            </p>
            {mode === "mine" && <Link href="/discover" className="rp-btn rp-btn-yellow mt-5">Discover organisations <ArrowRight className="w-4 h-4" /></Link>}
          </div>
        ) : (
          <div className="space-y-20" data-testid="posts-grid">
            {entries.map((e) => e.kind === "sp" ? <SupporterPostCard key={`sp-${e.post.id}`} post={e.post} /> : ((u) => (
              <PostCard
                key={u._id}
                item={u}
                logo={followsQ.data?.find(org => org._id === u.orgId)?.logo ?? null}
                onOpen={() => setOpen(u)}
                following={followState(u.orgId)}
                onFollow={() => onFollow(u.orgId)}
                followBusy={follow.isPending && follow.variables === u.orgId}
              />
            ))(e.item))}
            <p className="rp-label !text-[12px] text-center text-[#17100F]/55 pt-4">You're all caught up</p>
          </div>
        )}
      </section>
      {postUnavailable && linkedPost && (
        <div role="alert" className="fixed inset-x-4 bottom-24 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[360px] z-50 border border-[#17100F] bg-[#FBF8F2] p-4" data-testid="status-linked-post-unavailable">
          <p className="font-semibold">This post is no longer available.</p>
          <p className="text-sm text-muted-foreground mt-1">The organisation may have removed it.</p>
          <button type="button" className="rps-chip mt-3" onClick={() => { setPostUnavailable(false); navigate("/feed", { replace: true }); }} data-testid="button-dismiss-linked-post">Dismiss</button>
        </div>
      )}
      <ContentDialog item={open} onClose={closeDialog} />
    </div>
  );
}
