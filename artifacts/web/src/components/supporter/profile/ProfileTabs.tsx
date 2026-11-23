import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Images, Lock, Play, Plus } from "lucide-react";
import type { SupporterShowcase } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SupporterPostCard } from "@/components/supporter/SupporterPostCard";
import { useToast } from "@/hooks/use-toast";
import { MANUAL_LIMIT, formatWhen, groupInvolvement, initialsOf, refreshShowcase, removeInvolvement } from "@/lib/supporter-showcase";
import type { SupporterPostRecord } from "@/lib/supporter-publishing";
import { AddInvolvementDialog } from "./AddInvolvementDialog";

const Empty = ({ title, body, testId, children }: { title: string; body: string; testId: string; children?: React.ReactNode }) => (
  <div className="border border-dashed border-[#17100F]/35 px-6 py-10 text-center" data-testid={testId}>
    <p className="rp-display text-[26px]">{title}</p>
    <p className="text-sm text-[#17100F]/65 mt-2 max-w-sm mx-auto">{body}</p>
    {children}
  </div>
);

export function PostsTab({ posts, editable }: { posts: SupporterPostRecord[]; editable: boolean }) {
  if (!posts.length) return <Empty testId="status-posts-empty" title="Nothing posted yet" body={editable ? "Share a photo, video or a few words from something you were part of." : "No posts to show here yet."} />;
  return (
    <div className="divide-y divide-[#17100F]/12">
      {posts.map(p => (
        <div key={p.id} id={`post-${p.id}`} className="py-8 first:pt-2 scroll-mt-24 target:bg-[#F3BF2C]/10">
          <SupporterPostCard post={p} />
        </div>
      ))}
    </div>
  );
}

export function MediaTab({ posts }: { posts: SupporterPostRecord[] }) {
  const [open, setOpen] = useState<SupporterPostRecord | null>(null);
  const media = posts.filter(p => p.type !== "text" && p.media.length > 0);
  if (!media.length) return <Empty testId="status-media-empty" title="No photos or videos" body="Photo and video posts collect here as a grid." />;
  return (
    <>
      <div className="grid grid-cols-3 gap-1" data-testid="grid-media">
        {media.map(p => {
          const lead = [...p.media].sort((a, b) => a.order - b.order)[0]!;
          const thumb = lead.type === "video" ? lead.video_thumbnail_url : lead.url;
          return (
            <button key={p.id} type="button" onClick={() => setOpen(p)} className="relative aspect-square overflow-hidden bg-[#17100F] group text-left"
              aria-label={`Open ${p.type} post${p.caption ? `: ${p.caption.slice(0, 60)}` : ""}`} data-testid={`tile-media-${p.id}`}>
              {thumb ? <img src={thumb} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                : <video src={lead.url} muted preload="metadata" playsInline className="absolute inset-0 w-full h-full object-cover" />}
              <span className="absolute inset-0 bg-gradient-to-t from-[#17100F]/85 via-[#17100F]/10 to-transparent" />
              <span className="absolute top-1.5 left-1.5 rp-label !text-[9px] sm:!text-[10px] bg-[#17100F]/75 text-[#FBF8F2] px-1.5 py-0.5 inline-flex items-center gap-1">
                {p.type === "video" ? <Play className="w-2.5 h-2.5" /> : null}{p.type}
              </span>
              {p.media.length > 1 && <Images className="absolute top-1.5 right-1.5 w-4 h-4 text-[#FBF8F2]" aria-hidden />}
              {p.caption && <span className="absolute bottom-1.5 left-1.5 right-1.5 sm:bottom-3 sm:left-3 sm:right-3 text-[#FBF8F2] text-[10px] sm:text-[14px] font-semibold leading-snug line-clamp-3">{p.caption}</span>}
            </button>
          );
        })}
      </div>
      <Dialog open={!!open} onOpenChange={v => !v && setOpen(null)}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-xl p-4 sm:p-6 bg-[#FBF8F2] border-[#17100F] top-[calc(50%-2.25rem)] md:top-1/2 max-h-[calc(100dvh-8.5rem)] md:max-h-[92dvh] overflow-y-auto overscroll-contain touch-pan-y" data-testid="dialog-media-post">
          <DialogTitle className="sr-only">Post</DialogTitle>
          <DialogDescription className="sr-only">The full post with its media.</DialogDescription>
          {open && <div className="pt-6"><SupporterPostCard post={open} /></div>}
        </DialogContent>
      </Dialog>
    </>
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
    onSuccess: () => { setConfirmId(null); refreshShowcase(qc); toast({ title: "Removed" }); },
    onError: () => toast({ title: "Couldn’t remove that, please try again", variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#17100F]">
        <p className="text-[13px] text-[#17100F]/70">
          {editable ? "Filled in from posts you link to an organisation. Add anything else you’ve done." : "Projects and groups this supporter has been part of."}
        </p>
        {editable && token && (
          <button type="button" className="min-h-11 inline-flex items-center gap-1.5 text-[14px] font-bold disabled:opacity-50" onClick={() => setAdding(true)}
            disabled={manualCount >= MANUAL_LIMIT} title={manualCount >= MANUAL_LIMIT ? `You can add up to ${MANUAL_LIMIT} entries` : undefined} data-testid="button-add-involvement">
            <Plus className="w-4 h-4 border border-[#17100F] p-px" /> Add involvement
          </button>
        )}
      </div>

      {!groups.length ? (
        <div className="mt-6"><Empty testId="status-involvement-empty" title="Nothing recorded yet" body={editable ? "Link a post to an organisation, or add something you did by hand, including before you joined." : "Nothing shared here yet."} /></div>
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
              const text = it.details || it.activity;
              return (
                <li key={it.id} className="grid grid-cols-[84px_minmax(0,1fr)] sm:grid-cols-[100px_minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2.5 border-t border-[#17100F]/10 first:border-t-0 text-[14px]" data-testid={`row-involvement-${it.id}`}>
                  <span className="font-bold">{it.activity}</span>
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

export function SavedTab() {
  return (
    <Empty testId="status-saved-unavailable" title="Saved isn’t connected yet" body="Bookmarking posts isn’t available on Root ProjX yet, so there’s nothing saved to show. Only you can see this tab.">
      <Link href="/saved" className="rp-link-u inline-block mt-4 text-[14px]" data-testid="link-saved-page">Go to Saved</Link>
    </Empty>
  );
}
