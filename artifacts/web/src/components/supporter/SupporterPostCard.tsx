import { SupporterAvatar } from "./SupporterAvatar";
import { useRef, useState, type TouchEvent } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Images, Lock, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/lib/api";
import { normaliseEdit } from "@/lib/supporter-post-media";
import { deletePost, followAuthor, unfollowAuthor, type SupporterPostRecord } from "@/lib/supporter-publishing";
import { myShowcaseKey, refreshShowcase } from "@/lib/supporter-showcase";
import { EditedMedia } from "./EditedMedia";
import { BookmarkButton } from "@/components/bookmarks/BookmarkButton";
import { DonationAmountDialog } from "@/components/donation-amount-dialog";
import { CampaignSymbol } from "@/components/campaign-symbol";
import "./supporter-post.css";

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function useSupporterFollow() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ publicId, follow }: { publicId: string; follow: boolean }) =>
      follow ? followAuthor(publicId, token!) : unfollowAuthor(publicId, token!),
    onSuccess: (_r, v) => {
      refreshShowcase(qc);
      void qc.invalidateQueries({ queryKey: ["supporter-follow", v.publicId] });
      toast({ title: v.follow ? "Following" : "Unfollowed", description: v.follow ? "Their posts will appear in your Following tab." : undefined });
    },
    onError: () => toast({ title: "Something went wrong, please try again", variant: "destructive" }),
  });
}

function Carousel({ post }: { post: SupporterPostRecord }) {
  const media = [...post.media].sort((a, b) => a.order - b.order);
  const [i, setI] = useState(0);
  const tx = useRef<number | null>(null);
  if (!media.length) return null;
  const go = (n: number) => setI(Math.max(0, Math.min(media.length - 1, n)));
  const onStart = (e: TouchEvent) => { tx.current = e.touches[0]?.clientX ?? null; };
  const onEnd = (e: TouchEvent) => {
    if (tx.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? tx.current) - tx.current; tx.current = null;
    if (dx < -40) go(i + 1); else if (dx > 40) go(i - 1);
  };
  return (
    <div className="spc-media" onTouchStart={onStart} onTouchEnd={onEnd} aria-roledescription="carousel" data-testid={`carousel-sp-${post.id}`}>
      <div className="spc-track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {media.map((m, idx) => (
          <div className="spc-slide" key={m.id} aria-hidden={idx !== i} aria-label={`${idx + 1} of ${media.length}`}>
            <EditedMedia src={m.url} kind={m.type} poster={m.video_thumbnail_url} controls={m.type === "video"} natural={m.width && m.height ? m.width / m.height : null}
              edit={normaliseEdit({ crop: m.crop, filter: m.filter, adjustments: m.adjustments })} alt={post.caption ? post.caption.slice(0, 120) : `Photo by ${post.author.name}`} />
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <>
          {i > 0 && <button type="button" className="spc-nav is-prev" onClick={() => go(i - 1)} aria-label="Previous" data-testid={`button-sp-prev-${post.id}`}><ChevronLeft size={18} aria-hidden /></button>}
          {i < media.length - 1 && <button type="button" className="spc-nav is-next" onClick={() => go(i + 1)} aria-label="Next" data-testid={`button-sp-next-${post.id}`}><ChevronRight size={18} aria-hidden /></button>}
          <span className="absolute top-3 right-3 z-[3] rp-label !text-[12px] bg-[#17100F]/80 text-white px-2 py-1 inline-flex items-center gap-1"><Images className="w-3 h-3" />{i + 1}/{media.length}</span>
          <div className="spc-dots" aria-hidden>{media.map((m, idx) => <span key={m.id} className={idx === i ? "on" : ""} />)}</div>
        </>
      )}
    </div>
  );
}

export function SupporterPostCard({ post }: { post: SupporterPostRecord }) {
  const { isAuthenticated, user, token } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const follow = useSupporterFollow();
  const [confirm, setConfirm] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const a = post.author;
  // Preview intentionally has no owner privileges in its public DTO. Still
  // suppress self-follow, including immediately after enabling a public link
  // when the older auth snapshot hasn't refreshed yet.
  const ownPublicId = user?.publicProfileSettings?.publicId ||
    qc.getQueryData<{ publicId: string | null }>(myShowcaseKey(token))?.publicId;
  const canFollow = !a.isOwner && !!a.publicId && a.publicId !== ownPublicId && user?.accountType !== "organisation";
  const orgs = useQuery({ queryKey: ["organisations", "post-link"], queryFn: () => api.getOrganisations(), enabled: !!post.organisation_id, staleTime: 5 * 60_000 });
  const camps = useQuery({ queryKey: ["campaigns", "post-link", post.organisation_id], queryFn: () => api.getCampaigns(post.organisation_id!), enabled: !!post.organisation_id && !!post.campaign_id, staleTime: 5 * 60_000 });
  const org = orgs.data?.find(o => o._id === post.organisation_id);
  const camp = camps.data?.find(c => c._id === post.campaign_id);
  const donationPost = (post as SupporterPostRecord & { donation_post?: boolean }).donation_post === true;
  const remove = useMutation({
    mutationFn: () => deletePost(post.id, token!),
    onSuccess: () => { refreshShowcase(qc); toast({ title: "Post deleted" }); },
    onError: () => toast({ title: "Something went wrong, please try again", variant: "destructive" }),
  });
  const name = a.publicId
    ? <Link href={`/supporters/${a.publicId}`} className="text-[18px] font-bold leading-tight hover:underline truncate block" data-testid={`link-sp-author-${post.id}`}>{a.name}</Link>
    : <span className="text-[18px] font-bold leading-tight truncate block" data-testid={`text-sp-author-${post.id}`}>{a.name}</span>;

  return (
    <article className="rp-rise" data-testid={`card-supporter-post-${post.id}`}>
      {donateOpen && org && camp && <DonationAmountDialog onClose={() => setDonateOpen(false)}
        orgId={org._id} orgName={org.name} campaignId={camp._id} campaignName={camp.name}
        campaignPath={camp.sharePath || (camp.publicId ? `/campaigns/${camp.publicId}` : null)}
        currency={camp.currency} />}
      <header className="flex items-center gap-3 mb-3">
        {a.avatarUrl ? <SupporterAvatar avatarUrl={a.avatarUrl} initials={a.initials} size={36} /> : <span className="w-9 h-9 shrink-0 rounded-full bg-[#CA0813] text-[#FBF8F2] grid place-items-center text-[13px] font-extrabold" aria-hidden>{a.initials}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {name}
            {(post.tag?.label || post.community_tag) && <span className="shrink-0 text-[14px] text-[#17100F]/70 truncate" data-testid={`text-sp-tag-${post.id}`}>› {post.tag?.label || post.community_tag}</span>}
          </div>
          <p className="rp-label !text-[12px] text-[#17100F]/60 flex items-center gap-2">
            Supporter · {dateLabel(post.created_at)}
            {post.visibility === "private" && a.isOwner && (
              <span className="inline-flex items-center gap-1 border border-[#17100F]/40 px-1.5 !tracking-[.1em]" data-testid={`status-sp-private-${post.id}`}><Lock className="w-3 h-3" /> Private</span>
            )}
          </p>
        </div>
        {canFollow && (a.following ? (
          <button type="button" onClick={() => follow.mutate({ publicId: a.publicId!, follow: false })} disabled={follow.isPending}
            className="min-h-11 text-[14px] text-[#17100F]/60 inline-flex items-center gap-1 hover:text-[#17100F] disabled:opacity-50" data-testid={`button-sp-unfollow-${post.id}`}>
            <Check className="w-3.5 h-3.5" /> Following
          </button>
        ) : (
          <button type="button" onClick={() => (isAuthenticated ? follow.mutate({ publicId: a.publicId!, follow: true }) : navigate("/login"))} disabled={follow.isPending}
            className="min-h-11 text-[16px] font-bold text-[#CA0813] hover:underline underline-offset-2 disabled:opacity-50 inline-flex items-center gap-1" data-testid={`button-sp-follow-${post.id}`}>
            <Plus className="w-3.5 h-3.5" /> Follow
          </button>
        ))}
      </header>

      <Carousel post={post} />

      {post.caption && <p className={`${post.media.length ? "mt-4 text-[18px]" : "mt-1 border-l-4 border-[#F3BF2C] pl-4 text-[20px] sm:text-[22px] font-medium"} leading-relaxed text-[#17100F]/85 whitespace-pre-wrap break-words`} data-testid={`text-sp-caption-${post.id}`}>{post.caption}</p>}
      {donationPost && camp && org && <button type="button" onClick={() => setDonateOpen(true)}
        className="w-full mt-4 flex gap-3 text-left items-center border border-[#17100F] p-3 hover:bg-[#F3BF2C]/10" data-testid={`button-sp-donation-${post.id}`}>
        <CampaignSymbol campaign={camp} className="w-10 h-10 shrink-0" />
        <span><strong className="block">{camp.name}</strong><small>{org.name} · Support the campaign</small></span>
      </button>}

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {post.organisation_id ? (
          <span className="text-[15px]" data-testid={`text-sp-linked-${post.id}`}>
            With <Link href={`/organisations/${post.organisation_id}`} className="rp-link-u">{org?.name ?? "this organisation"}</Link>
            {camp && <> for <Link href={camp.sharePath ?? (camp.publicId ? `/campaigns/${camp.publicId}` : `/organisations/${post.organisation_id}/campaigns`)} className="rp-link-u">{camp.name}</Link></>}
          </span>
        ) : <span />}
        <BookmarkButton kind="post" targetId={post.id} className="ml-auto" />
        {a.isOwner && (confirm ? (
          <span className="inline-flex items-center gap-3 text-[14px]">
            Delete this post?
            <button type="button" className="min-h-11 font-bold text-[#CA0813] underline" onClick={() => remove.mutate()} disabled={remove.isPending} data-testid={`button-sp-delete-confirm-${post.id}`}>{remove.isPending ? "Deleting…" : "Delete"}</button>
            <button type="button" className="min-h-11 underline" onClick={() => setConfirm(false)} data-testid={`button-sp-delete-cancel-${post.id}`}>Keep</button>
          </span>
        ) : (
          <button type="button" className="min-h-11 inline-flex items-center gap-1.5 text-[14px] text-[#17100F]/70 hover:text-[#CA0813]" onClick={() => setConfirm(true)} data-testid={`button-sp-delete-${post.id}`}>
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        ))}
      </footer>
    </article>
  );
}
