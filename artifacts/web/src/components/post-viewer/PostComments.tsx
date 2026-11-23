import { useRef, useState, type FormEvent } from "react";
import { Heart, X } from "lucide-react";
import type { PostActivity, PostViewerAuthor, PostViewerComment } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { POST_GENERIC_ERROR, initialsFrom, newClientId, shortAgo, usePostActivityActions, type PostRef } from "@/lib/post-activity";
import { VerifiedTick } from "./VerifiedTick";

function Avatar({ author }: { author: Pick<PostViewerAuthor, "name" | "avatarUrl"> }) {
  return (
    <span className={`pv-av ${author.avatarUrl ? "img" : ""}`} aria-hidden>
      {author.avatarUrl ? <img src={author.avatarUrl} alt="" /> : initialsFrom(author.name)}
    </span>
  );
}

export function PostComments({ postRef, activity, loading, error, onRetry, onClose, onGuest }: {
  postRef: PostRef; activity: PostActivity | undefined; loading: boolean; error: boolean;
  onRetry: () => void; onClose: () => void; onGuest: (action: string) => void;
}) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { comment, likeComment } = usePostActivityActions(postRef);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<PostViewerComment | null>(null);
  const [failed, setFailed] = useState(false);
  const clientId = useRef<string>(newClientId());
  const attemptedPayload = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const comments = activity?.comments ?? [];
  const tops = comments.filter(c => !c.parentId || !comments.some(p => p.id === c.parentId));
  const repliesOf = (id: string) => comments.filter(c => c.parentId === id);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || comment.isPending) return;
    setFailed(false);
    const parentId = replyTo ? (replyTo.parentId ?? replyTo.id) : null;
    const payload = JSON.stringify([text, parentId]);
    if (attemptedPayload.current !== null && attemptedPayload.current !== payload) clientId.current = newClientId();
    attemptedPayload.current = payload;
    comment.mutate({ clientId: clientId.current, text, parentId }, {
      onSuccess: () => {
        setDraft(""); setReplyTo(null); clientId.current = newClientId(); attemptedPayload.current = null;
        requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));
      },
      onError: () => setFailed(true), // draft and clientId are kept so a retry cannot duplicate
    });
  };

  const row = (c: PostViewerComment, reply = false) => (
    <div key={c.id} className={`pv-c ${reply ? "reply" : ""}`} data-testid={`comment-${c.id}`}>
      <Avatar author={c.author} />
      <div className="pv-cb">
        <b>{c.author.name}</b>{c.author.verified && <VerifiedTick small />} {c.text}
        <div className="pv-cm">
          <span>{shortAgo(c.createdAt)}</span>
          <span aria-hidden>·</span>
          <button type="button" disabled={comment.isPending || activity?.commentsDisabled} onClick={() => { if (!isAuthenticated) { onGuest("reply to comments"); return; } setReplyTo(c); inputRef.current?.focus(); }}
            data-testid={`button-reply-${c.id}`}>Reply</button>
        </div>
      </div>
      <button type="button" className={`pv-ch2 ${c.liked ? "liked" : ""}`} aria-pressed={c.liked}
        aria-label={`${c.liked ? "Unlike" : "Like"} comment by ${c.author.name}`}
        disabled={likeComment.isPending}
        onClick={() => { if (!isAuthenticated) { onGuest("like comments"); return; } likeComment.mutate({ commentId: c.id, liked: !c.liked }, { onError: () => toast({ title: POST_GENERIC_ERROR, variant: "destructive" }) }); }}
        data-testid={`button-like-comment-${c.id}`}>
        <Heart aria-hidden />{c.likes > 0 && <span>{c.likes}</span>}
      </button>
    </div>
  );

  return (
    <section className="pv-cp" aria-label="Comments" data-testid="panel-comments">
      <span className="pv-grab" aria-hidden />
      <header className="pv-ch">
        <h2>Comments{activity ? ` · ${activity.commentCount}` : ""}</h2>
        <button type="button" onClick={onClose} aria-label="Close comments" data-testid="button-close-comments"><X size={22} /></button>
      </header>
      <div className="pv-list" ref={listRef}>
        {loading ? (
          <div aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="pv-c"><span className="pv-av" /><span className="flex-1 h-8 bg-[#17100F]/10 animate-pulse" /></div>)}</div>
        ) : error ? (
          <div className="pv-empty" role="alert">{POST_GENERIC_ERROR} <button type="button" className="underline font-semibold" onClick={onRetry} data-testid="button-retry-comments">Try again</button></div>
        ) : !tops.length ? (
          <p className="pv-empty">No comments yet. Start the conversation.</p>
        ) : tops.map(c => [row(c), ...repliesOf(c.id).map(r => row(r, true))])}
      </div>
      {activity?.commentsDisabled ? <p className="pv-empty" data-testid="text-comments-disabled">Comments are turned off for this post.</p> : isAuthenticated ? (
        <form className="pv-add" onSubmit={submit}>
          {replyTo && <div className="pv-replying"><span>Replying to {replyTo.author.name}</span><button type="button" disabled={comment.isPending} onClick={() => setReplyTo(null)}>Cancel</button></div>}
          <Avatar author={{ name: user?.name ?? "", avatarUrl: user?.avatarUrl ?? null }} />
          <input ref={inputRef} value={draft} maxLength={2000} disabled={comment.isPending} onChange={e => setDraft(e.target.value)}
            placeholder={replyTo ? `Reply to ${replyTo.author.name}…` : "Add a comment…"} aria-label="Add a comment" data-testid="input-comment" />
          <button type="submit" className="pv-post" disabled={!draft.trim() || comment.isPending} data-testid="button-post-comment">
            {comment.isPending ? "Posting…" : failed ? "Retry" : "Post"}
          </button>
          {failed && <p className="pv-adderr" role="alert">{POST_GENERIC_ERROR}</p>}
        </form>
      ) : (
        <div className="pv-add">
          <button type="button" className="rp-btn rp-btn-yellow pv-join !min-h-[44px]" onClick={() => onGuest("comment")} data-testid="button-join-to-comment">Join to comment</button>
        </div>
      )}
    </section>
  );
}
