import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Play, Plus, Maximize2, Pin } from "lucide-react";
import type { SupporterShowcase } from "@workspace/api-client-react";
import { SupporterPostCard } from "@/components/supporter/SupporterPostCard";
import { useToast } from "@/hooks/use-toast";
import { MANUAL_LIMIT, formatWhen, groupInvolvement, initialsOf, refreshShowcase, removeInvolvement } from "@/lib/supporter-showcase";
import type { SupporterPostRecord } from "@/lib/supporter-publishing";
import { AddInvolvementDialog } from "./AddInvolvementDialog";
import { useBookmarks, useToggleBookmark, GENERIC_ERROR } from "@/lib/bookmarks";
import { CampaignSymbol } from "@/components/campaign-symbol";
import { usePostViewer } from "@/components/post-viewer/PostViewerProvider";

const Empty = ({ text, testId }: { text: string; testId: string }) => (
  <p className="border border-dashed border-[#17100F]/35 px-6 py-10 text-center text-[15px] text-[#17100F]/70" data-testid={testId}>{text}</p>
);

export function PostsTab({ posts, editable }: { posts: SupporterPostRecord[]; editable: boolean }) {
  void editable;
  const viewer = usePostViewer();
  if (!posts.length) return <Empty testId="status-posts-empty" text="Nothing shared yet." />;
  const refs = posts.map(p => ({ kind: "post" as const, id: p.id }));
  return (
    <div className="divide-y divide-[#17100F]/12">
      {posts.map((p, i) => (
        <div key={p.id} id={`post-${p.id}`} className="py-8 first:pt-2 scroll-mt-24 target:bg-[#F3BF2C]/10">
          <SupporterPostCard post={p} onOpen={trigger => viewer.open({ refs, index: i, label: p.author.name, trigger })} />
          <button type="button" onClick={e => viewer.open({ refs, index: i, label: p.author.name, trigger: e.currentTarget })}
            className="mt-2 min-h-10 inline-flex items-center gap-1.5 rp-label !text-[11px] text-[#17100F]/75 hover:text-[#CA0813]"
            data-testid={`button-open-post-${p.id}`}><Maximize2 className="w-3.5 h-3.5" aria-hidden />Open post</button>
        </div>
      ))}
    </div>
  );
}

export function MediaTab({ posts }: { posts: SupporterPostRecord[] }) {
  const viewer = usePostViewer();
  const media = posts.filter(p => p.type !== "text" && p.media.length > 0);
  if (!media.length) return <Empty testId="status-media-empty" text="No photos or videos yet." />;
  const refs = media.map(p => ({ kind: "post" as const, id: p.id }));
  return (
    <div className="grid grid-cols-3 gap-[3px]" data-testid="grid-media">
      {media.map((p, i) => {
        const lead = [...p.media].sort((a, b) => a.order - b.order)[0]!;
        const thumb = p.coverUrl || (lead.type === "video" ? lead.video_thumbnail_url : lead.url);
        return (
          <button key={p.id} type="button" onClick={e => viewer.open({ refs, index: i, label: p.author.name, trigger: e.currentTarget })} className="relative aspect-[4/5] overflow-hidden bg-[#17100F] group text-left"
            aria-label={`Open ${p.type} post${p.caption ? `: ${p.caption.slice(0, 60)}` : ""}`} data-testid={`tile-media-${p.id}`}>
            {thumb ? <img src={thumb} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              : <video src={`${lead.url}#t=0.1`} muted preload="metadata" playsInline className="absolute inset-0 w-full h-full object-cover pointer-events-none" aria-hidden />}
            {p.type === "video" && <Play className="absolute top-2 right-2 w-4 h-4 text-[#FBF8F2] fill-[#FBF8F2] drop-shadow" aria-hidden />}
            {p.pinned && <span className="absolute top-2 left-2 bg-[#F3EFE5] p-1" aria-label="Pinned post"><Pin size={14} aria-hidden /></span>}
          </button>
        );
      })}
    </div>
  );
}

export function InvolvementTab({ showcase, editable, token, onOpenPost }: {
  showcase: SupporterShowcase; editable: boolean; token: string | null; onOpenPost: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const groups = groupInvolvement(showcase.involvement);
  const manualCount = showcase.involvement.filter(i => i.source === "manual").length;
  const remove = useMutation({
    mutationFn: (id: string) => removeInvolvement(id, token!),
    onSuccess: async () => { await refreshShowcase(qc); setConfirmId(null); toast({ title: "Removed" }); },
    onError: () => toast({ title: GENERIC_ERROR, variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#17100F]">
        <p className="text-[13px] text-[#17100F]/70">
          {editable ? "Filled in from your posts and shared gifts. Add anything else you've done." : "Projects and groups this supporter has been part of."}
        </p>
        {editable && token && (
          <button type="button" className="min-h-11 inline-flex items-center gap-1 text-[14px] font-semibold text-[#17100F] hover:underline disabled:opacity-50" onClick={() => setAdding(true)}
            disabled={manualCount >= MANUAL_LIMIT} title={manualCount >= MANUAL_LIMIT ? `You can add up to ${MANUAL_LIMIT} entries` : undefined} data-testid="button-add-involvement">
            <Plus className="w-4 h-4" /> Add involvement
          </button>
        )}
      </div>

      {!groups.length ? (
        <div className="mt-6"><Empty testId="status-involvement-empty" text="Nothing here yet. Giving, volunteering and visits will show up here." /></div>
      ) : groups.map(g => (
        <section key={g.key} className="border-b border-[#17100F] py-4" data-testid={`group-involvement-${g.key}`}>
          <header className="flex items-center gap-3 mb-2">
            {g.logo ? <img src={g.logo} alt="" className="w-9 h-9 rounded-full object-cover border border-[#17100F]/20 bg-white" />
              : <span className="w-9 h-9 rounded-full border border-[#17100F]/40 bg-[#F4EFE6] grid place-items-center text-[11px] font-extrabold" aria-hidden>{initialsOf(g.name)}</span>}
            <div className="min-w-0 [overflow-wrap:anywhere]">
              {g.organisationId ? <Link href={`/organisations/${g.organisationId}`} className="font-bold text-[15px] hover:underline" data-testid={`link-involvement-org-${g.organisationId}`}>{g.name}</Link>
                : <span className="font-bold text-[15px]">{g.name}</span>}
              <p className="rp-label !text-[10px] text-[#17100F]/60">
                {g.organisationId ? [g.sector, g.location].filter(Boolean).join(" · ") : "Not on Root ProjX yet"}
              </p>
            </div>
          </header>
          <ul className="sm:pl-12">
            {g.items.map(it => {
              const removable = editable && it.source === "manual";
              const postId = it.href?.startsWith("#post-") ? it.href.slice(6) : null;
              const text = it.details || "";
              return (
                <li key={it.id} className="grid grid-cols-[84px_minmax(0,1fr)] sm:grid-cols-[100px_minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2.5 border-t border-[#17100F]/10 first:border-t-0 text-[14px]" data-testid={`row-involvement-${it.id}`}>
                  <span className="font-bold">{it.donationPresentation && <CampaignSymbol presentation={it.donationPresentation} className="w-6 h-6 mr-2 align-middle" />}{it.activity}</span>
                  <span className="min-w-0 [overflow-wrap:anywhere] whitespace-pre-wrap">
                    {postId ? <button type="button" onClick={() => onOpenPost(postId)} className="underline underline-offset-2 text-left hover:text-[#CA0813]" data-testid={`link-involvement-post-${it.id}`}>{text}</button>
                      : it.href ? <Link href={it.href} className="underline underline-offset-2">{text}</Link> : text}
                    {editable && !it.shared && <span className="ml-2 rp-label !text-[10px] inline-flex items-center gap-1 text-[#17100F]/60"><Lock className="w-3 h-3" />Only me</span>}
                  </span>
                  <span className="col-start-2 sm:col-start-auto flex items-center gap-3 sm:justify-end">
                    <span className="rp-label !text-[10px] text-[#17100F]/65 sm:whitespace-nowrap" data-testid={`text-involvement-when-${it.id}`}>{formatWhen(it.when)}</span>
                    {removable && (confirmId === it.id ? (
                      <span className="inline-flex items-center gap-2 text-[12px]">
                        <button type="button" className="font-bold text-[#CA0813] underline min-h-9" disabled={remove.isPending} onClick={() => remove.mutate(it.id)} data-testid={`button-involvement-remove-confirm-${it.id}`}>{remove.isPending ? "Removing…" : "Remove"}</button>
                        <button type="button" className="underline min-h-9" onClick={() => setConfirmId(null)} data-testid={`button-involvement-remove-cancel-${it.id}`}>Keep</button>
                      </span>
                    ) : (
                      <button type="button" className="rp-link-u !font-semibold text-[12px] min-h-9" onClick={() => setConfirmId(it.id)} data-testid={`button-involvement-remove-${it.id}`}>Remove</button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {editable && token && <AddInvolvementDialog open={adding} onOpenChange={setAdding} token={token} profileIsPublic={showcase.isPublic} />}
    </div>
  );
}

type SavedFilter = "all" | "posts" | "campaigns";

export function SavedTab() {
  const q = useBookmarks();
  const toggle = useToggleBookmark();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const raw = new URLSearchParams(search).get("filter");
  const filter: SavedFilter = raw === "posts" || raw === "campaigns" ? raw : "all";
  const setFilter = (f: SavedFilter) => {
    const p = new URLSearchParams(search);
    if (f === "all") p.delete("filter"); else p.set("filter", f);
    const qs = p.toString();
    navigate(qs ? `${location}?${qs}` : location);
  };
  const items = (q.data ?? []).filter(b => !b.archived && (filter === "all" || (filter === "campaigns" ? b.kind === "campaign" : b.kind !== "campaign")));
  const viewer = usePostViewer();
  const postItems = items.filter(b => b.available && b.kind !== "campaign");
  const postRefs = postItems.map(b => ({ kind: b.kind as "post" | "update", id: b.targetId }));
  const activate = (b: (typeof items)[number], trigger: HTMLElement) => {
    if (b.kind === "campaign") { open(b.href); return; }
    const i = postItems.indexOf(b);
    if (i >= 0) viewer.open({ refs: postRefs, index: i, label: "Saved", trigger });
  };
  const open = (href: string | null) => { if (!href) return; if (/^https?:/.test(href)) window.location.href = href; else navigate(href); };

  return (
    <div data-testid="section-saved">
      <p className="flex items-center gap-1.5 text-[13px] text-[#17100F]/70 pb-3" data-testid="text-saved-private"><Lock className="w-3.5 h-3.5" aria-hidden />Only you can see what you've saved.</p>
      <div className="flex gap-2 mb-4" role="group" aria-label="Filter saved">
        {(["all", "posts", "campaigns"] as const).map(f => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={`rp-label !text-[11px] min-h-9 px-3 border border-[#17100F] ${filter === f ? "bg-[#17100F] text-[#FBF8F2]" : "hover:bg-[#17100F]/5"}`} data-testid={`filter-saved-${f}`}>{f}</button>
        ))}
      </div>
      {q.isLoading ? (
        <div className="grid grid-cols-3 gap-[3px]" aria-busy="true" data-testid="status-saved-loading">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} className="aspect-square bg-[#17100F]/10 animate-pulse" />)}</div>
      ) : q.isError ? (
        <div className="border border-dashed border-[#17100F]/35 px-6 py-10 text-center" role="alert">
          <p className="text-[15px]">{GENERIC_ERROR}</p>
          <button type="button" className="rp-btn rp-btn-yellow !min-h-10 !text-[14px] mt-4" onClick={() => q.refetch()} data-testid="button-saved-retry">Try again</button>
        </div>
      ) : !items.length ? (
        <Empty testId="status-saved-empty" text="Nothing saved yet. Tap the bookmark on any post or campaign to keep it here." />
      ) : (
        <div className="grid grid-cols-3 gap-[3px]" data-testid="grid-saved">
          {items.map(b => {
            if (!b.available) return (
              <div key={b.id} className="relative aspect-square bg-[#17100F]/[.06] border border-dashed border-[#17100F]/25 p-2 sm:p-3 flex flex-col justify-between text-[#17100F]/50" data-testid={`tile-saved-unavailable-${b.id}`}>
                <p className="text-[11px] sm:text-[13px] leading-snug">This post was removed or made private</p>
                <button type="button" className="self-start underline text-[12px] sm:text-[13px] font-semibold text-[#17100F]/80 min-h-8 disabled:opacity-50" disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ existing: b })} data-testid={`button-saved-remove-${b.id}`}>Remove</button>
              </div>
            );
            const label = b.title || b.authorName;
            if (b.imageUrl || b.videoUrl) return (
              <button key={b.id} type="button" onClick={e => activate(b, e.currentTarget)} className="relative aspect-square overflow-hidden bg-[#17100F] group" aria-label={`Open ${b.kind}: ${label}`} data-testid={`tile-saved-${b.id}`}>
                {b.imageUrl ? <img src={b.imageUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  : <video src={`${b.videoUrl}#t=0.1`} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover pointer-events-none" aria-hidden />}
                {b.kind === "campaign" && <span className="absolute top-1.5 left-1.5 rp-label !text-[9px] sm:!text-[10px] bg-[#F3BF2C] text-[#17100F] px-1.5 py-0.5">Campaign</span>}
                {b.isVideo && <Play className="absolute top-2 right-2 w-4 h-4 text-[#FBF8F2] fill-[#FBF8F2] drop-shadow" aria-hidden />}
              </button>
            );
            return (
              <button key={b.id} type="button" onClick={e => activate(b, e.currentTarget)} className="relative aspect-square overflow-hidden bg-[#FBF8F2] border border-[#17100F]/15 p-2 sm:p-4 flex flex-col justify-between text-left hover:border-[#17100F]" data-testid={`tile-saved-${b.id}`}>
                {b.kind === "campaign" && <span className="self-start rp-label !text-[9px] sm:!text-[10px] bg-[#F3BF2C] text-[#17100F] px-1.5 py-0.5 mb-1">Campaign</span>}
                <p className="text-[11px] sm:text-[15px] leading-snug line-clamp-4 sm:line-clamp-5 [overflow-wrap:anywhere]">{b.title}</p>
                <span className="flex items-center gap-1.5 min-w-0 mt-1">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 rounded-full bg-[#17100F] text-[#F3BF2C] grid place-items-center text-[8px] sm:text-[10px] font-extrabold" aria-hidden>{initialsOf(b.authorName)}</span>
                  <span className="text-[10px] sm:text-[12px] font-semibold truncate">{b.authorName}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
