import { useEffect, useRef, useState, type TouchEvent } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, X, Heart, MessageCircle, Send, Bookmark, ExternalLink } from "lucide-react";
import type { PostViewerMedia } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useBookmarks } from "@/lib/bookmarks";
import { BookmarkButton } from "@/components/bookmarks/BookmarkButton";
import { GuestJoinPrompt } from "@/components/guest-feed/GuestJoinPrompt";
import { InlineVideoPlayer } from "@/components/inline-video-player";
import { EditedMedia } from "@/components/supporter/EditedMedia";
import { normaliseEdit, type MediaEdit } from "@/lib/supporter-post-media";
import {
  POST_GENERIC_ERROR, initialsFrom, postRefKey, shortAgo, usePostActivity, usePostActivityActions, usePostRecord, type PostRef,
} from "@/lib/post-activity";
import { PostComments } from "./PostComments";
import { VerifiedTick } from "./VerifiedTick";
import { postPath } from "./PostViewerProvider";
import "./post-viewer.css";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

function MediaItem({ m, label, autoPlay }: { m: PostViewerMedia; label: string; autoPlay: boolean }) {
  const edited = !!m.crop && Object.keys(m.crop).length > 0;
  if (edited) {
    const edit = normaliseEdit({ crop: m.crop, filter: m.filter, adjustments: m.adjustments } as Partial<MediaEdit>);
    return (
      <div className="pv-edited">
        <EditedMedia src={m.url} kind={m.type} poster={m.thumbnailUrl} alt={label} edit={edit}
          natural={m.width && m.height ? m.width / m.height : null} fit="contain" controls autoPlay={autoPlay} />
      </div>
    );
  }
  if (m.type === "video") return <InlineVideoPlayer src={m.url} poster={m.thumbnailUrl} label={label} autoPlay={autoPlay} />;
  return <img className="pv-cover" src={m.url} alt={label} draggable={false} />;
}

function Slide({ postRef, commentsOpen, onComments, onGuest, onSwipe }: {
  postRef: PostRef; commentsOpen: boolean; onComments: (v: boolean) => void;
  onGuest: (action: string) => void; onSwipe: (dir: 1 | -1) => void;
}) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const bookmarks = useBookmarks();
  const record = usePostRecord(postRef);
  const activity = usePostActivity(postRef, { poll: true });
  const { like } = usePostActivityActions(postRef);
  const [mi, setMi] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const r = record.data;
  const media = r?.media ?? [];
  const current = media[Math.min(mi, Math.max(0, media.length - 1))];
  const isText = !!r && media.length === 0;
  const a = activity.data;

  const onTouchStart = (e: TouchEvent) => { const t = e.touches[0]; if (t) touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: TouchEvent) => {
    const s = touch.current; touch.current = null;
    const t = e.changedTouches[0];
    if (!s || !t || commentsOpen) return;
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.3) onSwipe(dy < 0 ? 1 : -1);
    else if (media.length > 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) setMi(i => Math.max(0, Math.min(media.length - 1, i + (dx < 0 ? 1 : -1))));
  };

  const share = async () => {
    if (!isAuthenticated) { onGuest("share posts"); return; }
    const url = `${window.location.origin}${BASE}${postPath(postRef)}`;
    try {
      if (navigator.share) await navigator.share({ title: r?.title || r?.author.name || "Root ProjX", url });
      else { await navigator.clipboard.writeText(url); toast({ title: "Link copied" }); }
    } catch (e) {
      if ((e as { name?: string } | null)?.name !== "AbortError") toast({ title: POST_GENERIC_ERROR, variant: "destructive" });
    }
  };

  const toggleLike = () => {
    if (!isAuthenticated) { onGuest("like posts"); return; }
    if (!a || like.isPending) return;
    like.mutate(!a.liked, { onError: () => toast({ title: POST_GENERIC_ERROR, variant: "destructive" }) });
  };

  const count = (n: number | undefined) => activity.isLoading ? <span className="pv-n wait" aria-hidden /> : activity.isError ? null : <span className="pv-n">{n}</span>;
  const label = r ? `${r.author.name} ${current?.type === "video" ? "video" : "photo"}` : "Post";

  return (
    <>
      <div className={`pv-media ${isText ? "pv-text" : ""}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} data-testid="viewer-media">
        {record.isLoading ? <div className="pv-skel" aria-busy="true" aria-label="Loading post" /> : record.isError || !r ? (
          <div className="pv-err" role="alert">
            <p>This post isn't available right now.</p>
            <button type="button" className="rp-btn rp-btn-yellow !min-h-10" onClick={() => record.refetch()} data-testid="button-retry-post">Try again</button>
          </div>
        ) : (
          <>
            {isText ? <p className="pv-q" data-testid="text-viewer-post">{r.caption || r.title}</p> : current && (
              <div className="pv-stage" key={`${current.url}-${mi}`}>
                <MediaItem m={current} label={label} autoPlay={current.type === "video"} />
              </div>
            )}
            {media.length > 1 && (
              <>
                <div className="pv-dots" aria-hidden>{media.map((_, i) => <i key={i} className={i === mi ? "on" : ""} />)}</div>
                {mi > 0 && <button type="button" className="pv-mnav l" onClick={() => setMi(mi - 1)} aria-label={`Previous photo (${mi} of ${media.length})`} data-testid="button-media-prev"><ChevronLeft size={18} /></button>}
                {mi < media.length - 1 && <button type="button" className="pv-mnav r" onClick={() => setMi(mi + 1)} aria-label={`Next photo (${mi + 2} of ${media.length})`} data-testid="button-media-next"><ChevronRight size={18} /></button>}
              </>
            )}
            <div className={`pv-o ${current?.type === "video" ? "has-video" : ""}`}>
              <div className="pv-who">
                <span className="pv-av">{r.author.avatarUrl ? <img src={r.author.avatarUrl} alt="" /> : initialsFrom(r.author.name)}</span>
                {r.author.href ? <Link href={r.author.href} data-testid="link-viewer-author">{r.author.name}</Link> : <span>{r.author.name}</span>}
                {r.author.verified && <VerifiedTick />}
                <time className="pv-time" dateTime={r.createdAt}>{shortAgo(r.createdAt)}</time>
              </div>
              {!isText && (r.caption || r.title) && (
                <p className={`pv-cap ${expanded ? "" : "clamp"}`} data-testid="text-viewer-caption">
                  {r.title && r.caption ? <><b>{r.title}</b> {r.caption}</> : r.caption || r.title}
                </p>
              )}
              {!isText && (r.caption || r.title) && !expanded && (r.caption.length + r.title.length) > 48 && (
                <button type="button" className="pv-more" onClick={() => setExpanded(true)} data-testid="button-caption-more">…more</button>
              )}
              {r.externalUrl && <a className="pv-ext" href={r.externalUrl} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink size={13} aria-hidden />Open original</a>}
              <div className="pv-row">
                <button type="button" className={`pv-i ${a?.liked ? "liked" : ""}`} onClick={toggleLike} aria-pressed={!!a?.liked}
                  disabled={isAuthenticated && (!a || like.isPending)} aria-label={a ? `${a.liked ? "Unlike" : "Like"} · ${a.likes} likes` : "Like"} data-testid="button-viewer-like">
                  <Heart aria-hidden />{count(a?.likes)}
                </button>
                <button type="button" className={`pv-i ${commentsOpen ? "on" : ""}`} onClick={() => onComments(!commentsOpen)} aria-expanded={commentsOpen}
                  aria-label={a ? `Comments · ${a.commentCount}` : "Comments"} data-testid="button-viewer-comments">
                  <MessageCircle aria-hidden />{count(a?.commentCount)}
                </button>
                <button type="button" className="pv-i" onClick={share} aria-label="Share" data-testid="button-viewer-share"><Send aria-hidden /></button>
                {activity.isError && <button type="button" className="pv-retry" onClick={() => activity.refetch()} data-testid="button-retry-activity">Counts unavailable · retry</button>}
                {bookmarks.enabled ? (
                  <BookmarkButton kind={postRef.kind} targetId={postRef.id} unstyled className="pv-i save" />
                ) : !isAuthenticated ? (
                  <button type="button" className="pv-i save" onClick={() => onGuest("save posts")} aria-label="Save" data-testid="button-viewer-save"><Bookmark aria-hidden /></button>
                ) : (
                  <button type="button" className="pv-i save" disabled aria-label="Saving is available on supporter accounts" title="Saving is available on supporter accounts" data-testid="button-viewer-save-unavailable"><Bookmark aria-hidden /></button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {commentsOpen && (
        <PostComments postRef={postRef} activity={a} loading={activity.isLoading} error={activity.isError}
          onRetry={() => activity.refetch()} onClose={() => onComments(false)} onGuest={onGuest} />
      )}
    </>
  );
}

/** One shared viewer: dialog shell, list navigation, keyboard, swipe and focus management. */
export function PostViewer({ refs, index, label, commentsOpen, onClose, onGo, onComments }: {
  refs: PostRef[]; index: number; label?: string; commentsOpen: boolean;
  onClose: () => void; onGo: (i: number) => void; onComments: (v: boolean) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [guest, setGuest] = useState<string | null>(null);
  const ref = refs[index];
  const current = usePostRecord(ref ?? null);
  const name = current.data?.author.name || label || "";
  const hasPrev = index > 0, hasNext = index < refs.length - 1;

  const state = useRef({ index, hasPrev, hasNext, commentsOpen, guest, onClose, onGo, onComments });
  state.current = { index, hasPrev, hasNext, commentsOpen, guest, onClose, onGo, onComments };

  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const resize = () => {
      rootRef.current?.style.setProperty("--pv-visible-height", `${viewport.height}px`);
      rootRef.current?.style.setProperty("--pv-visible-top", `${viewport.offsetTop}px`);
    };
    resize();
    viewport.addEventListener("resize", resize);
    viewport.addEventListener("scroll", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      viewport.removeEventListener("scroll", resize);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = state.current;
      if (s.guest) return; // the join dialog owns the keyboard
      const root = rootRef.current;
      if (!root) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable || t.tagName === "INPUT");
      if (e.key === "Escape") {
        e.preventDefault();
        s.onClose();
        return;
      }
      if (e.key === "Tab") {
        const f = Array.from(root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'))
          .filter(el => el.offsetParent !== null || el === document.activeElement);
        if (!f.length) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      if (typing) return;
      if (e.key === "ArrowRight" && s.hasNext) { e.preventDefault(); s.onGo(s.index + 1); }
      else if (e.key === "ArrowLeft" && s.hasPrev) { e.preventDefault(); s.onGo(s.index - 1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  if (!ref) return null;
  return (
    <div ref={rootRef} className="pv" role="dialog" aria-modal="true" aria-label={`Post ${index + 1} of ${refs.length}${name ? ` by ${name}` : ""}`} data-testid="dialog-post-viewer">
      <div className="pv-backdrop" onClick={onClose} aria-hidden />
      <p className="pv-count" data-testid="text-viewer-count">{index + 1} of {refs.length}{name ? ` · ${name}` : ""}</p>
      <button ref={closeRef} type="button" className="pv-x" onClick={onClose} aria-label="Close post" data-testid="button-close-viewer"><X size={22} /></button>
      {hasPrev && <button type="button" className="pv-arr l" onClick={() => onGo(index - 1)} aria-label="Previous post" data-testid="button-viewer-prev"><ChevronLeft size={24} /></button>}
      {hasNext && <button type="button" className="pv-arr r" onClick={() => onGo(index + 1)} aria-label="Next post" data-testid="button-viewer-next"><ChevronRight size={24} /></button>}
      <div className={`pv-col ${commentsOpen ? "open" : ""}`}>
        <Slide key={postRefKey(ref)} postRef={ref} commentsOpen={commentsOpen} onComments={onComments} onGuest={setGuest}
          onSwipe={dir => { const n = index + dir; if (n >= 0 && n < refs.length) onGo(n); }} />
      </div>
      <GuestJoinPrompt action={guest} onClose={() => setGuest(null)} aboveViewer />
    </div>
  );
}
