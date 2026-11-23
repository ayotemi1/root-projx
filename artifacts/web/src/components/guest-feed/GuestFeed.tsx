import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { BadgeCheck, Bookmark, Heart, Images, MessageCircle, Play, Repeat2, Send } from "lucide-react";
import * as api from "@/lib/api";
import { DonationAmountDialog } from "@/components/donation-amount-dialog";
import type { FeedUpdate, Org } from "@/lib/api";
import { ContentDialog } from "@/components/org-content/content-gallery";
import { summarise } from "@/lib/content-media";
import { GuestJoinPrompt } from "./GuestJoinPrompt";
import { VisitorHeading } from "@/components/visitor/VisitorHeading";
import { InlineVideoPlayer } from "@/components/inline-video-player";

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  if (s < 2629800) return `${Math.floor(s / 604800)}w`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Logo({ name, logo, size = 40 }: { name: string; logo: string | null; size?: number }) {
  const [bad, setBad] = useState(false);
  return (
    <span className="shrink-0 rounded-full border border-[#17100F] bg-[#FBF8F2] overflow-hidden inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {logo && !bad ? (
        <img src={logo} alt="" className="w-full h-full object-contain" loading="lazy" onError={() => setBad(true)} />
      ) : (
        <span className="text-[13px] font-bold text-[#CA0813]">{name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase()}</span>
      )}
    </span>
  );
}

function JoinBox({ className = "" }: { className?: string }) {
  return (
    <section className={`bg-[#17100F] text-[#F4EFE6] p-5 ${className}`} aria-label="Join the movement" data-testid="box-guest-join">
      <h2 className="rp-display text-[#F3BF2C] text-[30px] sm:text-[34px]">Join the movement</h2>
      <p className="mt-3 text-[15px] leading-relaxed">Become a supporter. Follow grassroots organisations, read their updates and see your impact in real time.</p>
      <Link href="/register" className="rp-btn rp-btn-yellow w-full mt-5 !text-[15px]" data-testid="link-guest-join">Join</Link>
      <p className="mt-4 text-center text-[14px]">Already a supporter? <Link href="/login" className="font-bold underline underline-offset-2" data-testid="link-guest-signin">Sign in</Link></p>
    </section>
  );
}

function GuestPost({ item, org, onOpen, gate }: { item: FeedUpdate; org?: Org; onOpen: () => void; gate: (a: string) => void }) {
  const [donateOpen, setDonateOpen] = useState(false);
  const s = summarise(item);
  const cover = s.images[0];
  const hasVideo = s.videos.length > 0 || !!s.link?.embedUrl;
  const count = s.images.length + s.videos.length;
  const name = item.orgName || org?.name || "Organisation";
  const kind = item.type === "campaign" ? "Campaign update" : item.type === "milestone" ? "Milestone" : "Organisation update";
  const btn = "inline-flex items-center gap-1.5 min-h-11 min-w-11 justify-center text-[14px] text-[#17100F] hover:text-[#CA0813]";
  return (
    <article className="rp-rise pb-8 border-b border-[#17100F]/15" data-testid={`card-guest-post-${item._id}`}>
      {donateOpen && <DonationAmountDialog onClose={() => setDonateOpen(false)} orgId={item.orgId} orgName={name} />}
      <header className="flex items-center gap-3 mb-3">
        <Link href={`/organisations/${item.orgId}`} aria-label={`Visit ${name}`}><Logo name={name} logo={org?.logo ?? null} size={34} /></Link>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5">
            <Link href={`/organisations/${item.orgId}`} className="text-[16px] font-bold hover:underline truncate">{name}</Link>
            {org?.verified && <BadgeCheck className="w-4 h-4 text-[#F4EFE6] fill-[#1F7A3D] shrink-0" aria-label="Verified" />}
          </p>
          <p className="rp-label !text-[10px] text-[#17100F]/60">{ago(item.createdAt)} · {kind}</p>
        </div>
      </header>
      {(cover || s.videos[0]) && (
        s.videos[0] ? <div className="relative w-full aspect-square border border-[#17100F] bg-[#17100F]">
          <InlineVideoPlayer src={s.videos[0]} poster={cover} label={`${name} video`} />
          {count > 1 && <span className="absolute top-3 right-3 rp-label !text-[11px] bg-[#17100F]/80 text-white px-2 py-1 pointer-events-none">{count} items</span>}
        </div> : <button type="button" onClick={onOpen} className="group relative block w-full aspect-square overflow-hidden border border-[#17100F] bg-[#17100F] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#F3BF2C]" aria-label={`Open ${item.title || `${name} post`}`} data-testid={`button-open-post-${item._id}`}>
          {cover ? <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover" />
            : <video src={`${s.videos[0]}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover pointer-events-none" aria-hidden />}
          {count > 1 && <span className="absolute top-3 right-3 rp-label !text-[11px] bg-[#17100F]/80 text-white px-2 py-1 inline-flex items-center gap-1"><Images className="w-3 h-3" />{count}</span>}
          {hasVideo && <span className="absolute inset-0 flex items-center justify-center"><span className="w-12 h-12 rounded-full bg-[#F3BF2C] border border-[#17100F] flex items-center justify-center"><Play className="w-4 h-4 fill-[#17100F] text-[#17100F] ml-0.5" /></span></span>}
        </button>
      )}
      {item.title && <h2 className="rp-display text-[24px] sm:text-[28px] mt-4"><button type="button" onClick={onOpen} className="text-left uppercase hover:underline">{item.title}</button></h2>}
      {item.content && <p className="mt-2 text-[15px] leading-relaxed text-[#17100F]/85 line-clamp-3">{item.content}</p>}
      {!cover && !s.videos[0] && <button type="button" onClick={onOpen} className="mt-1 min-h-11 text-[14px] font-bold underline underline-offset-2" data-testid={`button-more-${item._id}`}>Read more</button>}
      <footer className="mt-2 flex items-center gap-2 -ml-2.5">
        <button type="button" className={btn} onClick={() => gate("like posts")} aria-label="Like" data-testid={`button-like-${item._id}`}><Heart className="w-[18px] h-[18px]" />{item.likes > 0 && <span>{item.likes}</span>}</button>
        <button type="button" className={btn} onClick={() => gate("comment on posts")} aria-label="Comment" data-testid={`button-comment-${item._id}`}><MessageCircle className="w-[18px] h-[18px]" /></button>
        <button type="button" className={btn} onClick={() => gate("repost updates")} aria-label="Repost" data-testid={`button-repost-${item._id}`}><Repeat2 className="w-[18px] h-[18px]" /></button>
        <button type="button" className={btn} onClick={() => gate("send posts")} aria-label="Send" data-testid={`button-send-${item._id}`}><Send className="w-[18px] h-[18px]" /></button>
        <button type="button" className={`${btn} ml-auto`} onClick={() => gate("save posts")} aria-label="Save" data-testid={`button-save-${item._id}`}><Bookmark className="w-[18px] h-[18px]" /></button>
        <button type="button" onClick={() => setDonateOpen(true)} className="min-h-11 inline-flex items-center px-2 text-[14px]" data-testid={`link-donate-${item._id}`}><span className="rp-link-u">Donate</span></button>
      </footer>
    </article>
  );
}

export function GuestFeed() {
  const [open, setOpen] = useState<FeedUpdate | null>(null);
  const [gateAction, setGateAction] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const feedQ = useQuery({ queryKey: ["feed", "public"], queryFn: api.getPublicFeed, staleTime: 0, refetchInterval: 30_000 });
  const orgsQ = useQuery({ queryKey: ["organisations", "guest-feed"], queryFn: () => api.getOrganisations() });
  const orgMap = useMemo(() => new Map((orgsQ.data ?? []).map(o => [o._id, o])), [orgsQ.data]);
  const verified = useMemo(() => (orgsQ.data ?? []).filter(o => o.verified).slice(0, 5), [orgsQ.data]);
  const posts = useMemo(() => [...(feedQ.data ?? [])].filter(p => !p.status || p.status === "published")
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)), [feedQ.data]);

  const search = useSearch();
  const linked = new URLSearchParams(search).get("post");
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!linked || handled.current === linked || feedQ.isLoading) return;
    handled.current = linked;
    const f = (feedQ.data ?? []).find(u => u._id === linked);
    if (f) setOpen(f);
  }, [linked, feedQ.isLoading, feedQ.data]);
  const close = () => { setOpen(null); if (linked) navigate("/feed", { replace: true }); };

  return (
    <div className="max-w-[1240px] mx-auto px-5 md:px-8 py-12 md:py-16 grid lg:grid-cols-[minmax(0,680px)_340px] justify-between gap-x-12" data-testid="page-guest-feed">
      <div className="min-w-0">
        <JoinBox className="lg:hidden mb-12" />
        <VisitorHeading label="Live from the ground" title="Live feed" intro="Real updates from grassroots organisations on Root ProjX, newest first." />
        <section className="mt-8 space-y-8" aria-label="Posts">
          {feedQ.isLoading ? [0, 1].map(i => (
            <div key={i} className="animate-pulse" data-testid="status-guest-loading"><div className="flex gap-3 mb-3"><div className="w-9 h-9 rounded-full bg-[#17100F]/10" /><div className="h-4 w-40 bg-[#17100F]/10 mt-2" /></div><div className="aspect-square bg-[#17100F]/10" /></div>
          )) : feedQ.isError ? (
            <div className="border border-[#17100F] p-8 text-center" role="alert">
              <p className="rp-display text-[26px]">We couldn't load these posts.</p>
              <button type="button" className="rp-btn rp-btn-yellow mt-5" onClick={() => void feedQ.refetch()} data-testid="button-retry-guest-feed">Try again</button>
            </div>
          ) : posts.length === 0 ? (
            <div className="border border-[#17100F] p-8 text-center"><p className="rp-display text-[26px]">No posts yet</p><p className="mt-2 text-[14px] text-[#17100F]/70">Updates from organisations will appear here as soon as they're published.</p></div>
          ) : posts.map(p => <GuestPost key={p._id} item={p} org={orgMap.get(p.orgId)} onOpen={() => setOpen(p)} gate={setGateAction} />)}
          {!feedQ.isLoading && !feedQ.isError && (
            <div className="border border-[#17100F] bg-[#FBF8F2] p-6 text-center" data-testid="box-caught-up">
              <p className="rp-display text-[24px]">You're all caught up</p>
              <p className="mt-2 text-[14px] text-[#17100F]/75">Join to follow organisations and see their updates first.</p>
              <Link href="/register" className="rp-btn rp-btn-yellow mt-4 !text-[15px]" data-testid="link-caught-up-join">Join the movement</Link>
            </div>
          )}
        </section>
      </div>
      <aside className="hidden lg:block">
        <div className="sticky top-[100px]">
          <JoinBox />
          <section className="mt-12" aria-labelledby="on-rp">
            <h2 id="on-rp" className="rp-label !text-[10px] !font-medium pb-3 border-b border-[#17100F]" style={{ fontFamily: "var(--app-font-mono)", fontStretch: "100%", fontVariationSettings: "normal" }}>On Root ProjX</h2>
            {verified.map(o => (
              <div key={o._id} className="flex items-center gap-2.5 py-3 border-b border-[#17100F]/15" data-testid={`row-guest-org-${o._id}`}>
                <Link href={`/organisations/${o._id}`} aria-label={o.name}><Logo name={o.name} logo={o.logo} size={30} /></Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/organisations/${o._id}`} className="block text-[13px] font-bold truncate hover:underline">{o.name}</Link>
                  <p className="text-[11px] text-[#17100F]/65 truncate">{o.category}{(o.city || o.country) ? ` · ${o.city || o.country}` : ""}</p>
                </div>
                <button type="button" onClick={() => setGateAction("follow organisations")} className="border border-[#17100F] px-3 h-7 text-[12px] font-bold hover:bg-[#17100F] hover:text-[#F4EFE6]" data-testid={`button-follow-${o._id}`}>Follow</button>
              </div>
            ))}
            <Link href="/discover" className="rp-link-u inline-block mt-4 text-[14px]" data-testid="link-discover-orgs">Discover organisations</Link>
          </section>
        </div>
      </aside>
      <ContentDialog item={open} onClose={close} />
      <GuestJoinPrompt action={gateAction} onClose={() => setGateAction(null)} />
    </div>
  );
}
