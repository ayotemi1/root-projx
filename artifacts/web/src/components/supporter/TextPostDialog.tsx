import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { Globe, Hash, Lock, Search, X, Building2, MapPin, Heart } from "lucide-react";
import { listSupporterPostTags, type SupporterPostTag } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { profileIsPublic } from "@/lib/supporter-post-media";
import { MAX_TEXT_POST, useTextPost } from "./TextPostProvider";
import "./text-post.css";

const GROUPS: Array<{ type: SupporterPostTag["type"]; label: string; Icon: typeof Hash }> = [
  { type: "community", label: "Communities", Icon: Hash },
  { type: "cause", label: "Causes", Icon: Heart },
  { type: "place", label: "Places", Icon: MapPin },
  { type: "organisation", label: "Organisations you follow", Icon: Building2 },
];
const tagKey = (t: Pick<SupporterPostTag, "type" | "value">) => `${t.type}:${t.value}`;

function TagPicker({ selected, onPick, onClose, token }: {
  selected: SupporterPostTag | null; onPick: (t: SupporterPostTag | null) => void; onClose: () => void; token: string | null;
}) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const tagsQ = useQuery({
    queryKey: ["supporter-post-tags", token],
    queryFn: () => listSupporterPostTags(token ? { headers: { Authorization: `Bearer ${token}` }, credentials: "include" } : { credentials: "include" }),
    enabled: !!token, staleTime: 60_000,
  });
  useEffect(() => { inputRef.current?.focus(); }, []);
  const flat = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (tagsQ.data ?? []).filter(t => !n || t.label.toLowerCase().includes(n) || (t.description ?? "").toLowerCase().includes(n));
  }, [tagsQ.data, q]);
  const ordered = useMemo(() => GROUPS.flatMap(g => flat.filter(t => t.type === g.type)), [flat]);
  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    document.getElementById(`${listId}-o${hi}`)?.scrollIntoView({ block: "nearest" });
  }, [hi, listId]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, ordered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const t = ordered[hi]; if (t) onPick(t); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
  };

  let idx = -1;
  return (
    <div className="rtp-picker" data-testid="picker-text-post-tag">
      <label className="rtp-search">
        <Search size={15} aria-hidden />
        <span className="rtp-sr">Search communities</span>
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search communities"
          role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={ordered.length ? `${listId}-o${hi}` : undefined} data-testid="input-tag-search" />
      </label>
      <div className="rtp-list" id={listId} role="listbox" aria-label="Tags">
        {tagsQ.isLoading ? (
          <div className="rtp-skel" aria-label="Loading tags" data-testid="status-tags-loading"><span /><span /><span /></div>
        ) : tagsQ.isError ? (
          <div className="rtp-empty" role="alert">
            <p>Tags couldn’t be loaded.</p>
            <button type="button" className="rtp-textbtn" onClick={() => tagsQ.refetch()} data-testid="button-tags-retry">Try again</button>
          </div>
        ) : ordered.length === 0 ? (
          <p className="rtp-empty" data-testid="status-tags-empty">No matches for “{q.trim()}”.</p>
        ) : GROUPS.map(g => {
          const items = flat.filter(t => t.type === g.type);
          if (!items.length) return null;
          return (
            <div key={g.type} role="group" aria-label={g.label}>
              <p className="rtp-group">{g.label}</p>
              {items.map(t => {
                idx += 1;
                const i = idx;
                const sel = !!selected && tagKey(selected) === tagKey(t);
                return (
                  <div key={tagKey(t)} id={`${listId}-o${i}`} role="option" aria-selected={sel}
                    className={`rtp-opt${i === hi ? " is-hi" : ""}${sel ? " is-sel" : ""}`}
                    onMouseEnter={() => setHi(i)} onMouseDown={e => e.preventDefault()} onClick={() => onPick(t)}
                    data-testid={`option-tag-${t.type}-${t.value}`}>
                    <span className="rtp-opt-ic" aria-hidden><g.Icon size={13} /></span>
                    <span className="rtp-opt-t">
                      <span className="rtp-opt-l">{t.label}</span>
                      {t.description && <span className="rtp-opt-d">{t.description}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {selected && (
        <button type="button" className="rtp-remove-tag" onClick={() => onPick(null)} data-testid="button-tag-remove">Remove tag</button>
      )}
    </div>
  );
}

export function TextPostDialog() {
  const c = useTextPost();
  const { user, token } = useAuth();
  const [picker, setPicker] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const tagBtnRef = useRef<HTMLButtonElement>(null);
  const counterId = useId();
  const open = c?.open ?? false;
  const profileQ = useQuery({ queryKey: ["profile", user?.id, token], queryFn: () => api.getProfile(token!), enabled: open && !!token, staleTime: 0 });
  useEffect(() => { if (!open) setPicker(false); }, [open]);
  if (!c) return null;

  const prof = profileQ.data as (api.ApiUser & { publicProfile?: { enabled?: boolean } }) | undefined;
  const isPublic: boolean | null = prof ? profileIsPublic(prof) : null;
  const name = prof?.publicProfileSettings?.displayName || prof?.name || user?.name || "You";
  const initials = (prof?.avatarInitials || user?.avatarInitials || name.split(/\s+/).map(w => w[0]).join("").slice(0, 2)).toUpperCase();
  const avatarUrl = (prof as { avatarUrl?: string | null } | undefined)?.avatarUrl ?? (user as { avatarUrl?: string | null } | null)?.avatarUrl ?? null;
  const len = c.text.length;
  const blank = c.text.trim().length === 0;
  const near = len >= MAX_TEXT_POST - 20;

  const pick = (t: SupporterPostTag | null) => {
    c.setTag(t); setPicker(false);
    requestAnimationFrame(() => (t ? textRef.current : tagBtnRef.current)?.focus());
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={o => { if (!o) c.close(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="rtp-overlay" />
        <DialogPrimitive.Content className="rtp-modal" data-testid="dialog-text-post"
          onOpenAutoFocus={e => { e.preventDefault(); textRef.current?.focus(); }}
          onEscapeKeyDown={e => { if (c.pending) e.preventDefault(); else if (picker) { e.preventDefault(); setPicker(false); tagBtnRef.current?.focus(); } }}
          onPointerDownOutside={e => { if (c.pending) e.preventDefault(); }}
          onCloseAutoFocus={e => { const el = c.returnFocusRef.current; if (el && document.contains(el)) { e.preventDefault(); el.focus(); } }}>
          <header className="rtp-head">
            <DialogPrimitive.Title className="rtp-title" data-testid="text-text-post-title">Text post</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rtp-x" aria-label="Close" disabled={c.pending} data-testid="button-close-text-post"><X size={20} aria-hidden /></DialogPrimitive.Close>
          </header>
          <DialogPrimitive.Description className="rtp-sr">Write a text post of up to {MAX_TEXT_POST} characters and optionally tag a community.</DialogPrimitive.Description>

          <div className="rtp-body">
            <span className="rtp-av" aria-hidden>{avatarUrl ? <img src={avatarUrl} alt="" /> : initials}</span>
            <div className="rtp-main">
              <div className="rtp-who">
                <span className="rtp-name" data-testid="text-text-post-author">{name}</span>
                <span className="rtp-tagwrap">
                  <button ref={tagBtnRef} type="button" className={`rtp-tagbtn${c.tag ? " is-set" : ""}`} disabled={c.pending}
                    aria-expanded={picker} aria-haspopup="listbox" onClick={() => setPicker(p => !p)}
                    aria-label={c.tag ? `Tagged ${c.tag.label}. Change tag` : "Tag a community"} data-testid="button-text-post-tag">
                    › {c.tag ? c.tag.label : "Tag a community"}
                  </button>
                  {c.tag && !picker && (
                    <button type="button" className="rtp-untag" onClick={() => pick(null)} disabled={c.pending} aria-label={`Remove tag ${c.tag.label}`} data-testid="button-text-post-untag">
                      <X size={12} aria-hidden />
                    </button>
                  )}
                </span>
              </div>
              {picker && <TagPicker selected={c.tag} onPick={pick} onClose={() => { setPicker(false); tagBtnRef.current?.focus(); }} token={token} />}
              <label htmlFor="rtp-text" className="rtp-sr">Post text</label>
              <textarea id="rtp-text" ref={textRef} className="rtp-text" value={c.text} maxLength={MAX_TEXT_POST} rows={5}
                placeholder="What’s new?" disabled={c.pending} aria-describedby={counterId}
                onChange={e => c.setText(e.target.value)} data-testid="input-text-post" />
            </div>
          </div>

          <footer className="rtp-foot">
            <span id={counterId} className={`rtp-count${near ? " is-near" : ""}`} aria-live={near ? "polite" : "off"} data-testid="text-text-post-count">{len}/{MAX_TEXT_POST}</span>
            {c.error && (
              <p className="rtp-error" role="alert" data-testid="status-text-post-error">{c.error}</p>
            )}
            <div className="rtp-foot-row">
              <p className="rtp-vis" data-testid="status-text-post-visibility">
                {isPublic === null
                  ? (profileQ.isError ? <>Visibility follows your Public Profile setting.</> : <>Checking who can see this…</>)
                  : isPublic
                    ? <><Globe size={13} aria-hidden /> Appears on your public profile and may appear in other supporters’ Home feeds.</>
                    : <><Lock size={13} aria-hidden /> Private: only you can see this while your public profile is off.</>}
              </p>
              <button type="button" className="rtp-publish" onClick={() => void c.publish()} disabled={blank || c.pending}
                aria-disabled={blank || c.pending} data-testid="button-text-post-publish">
                {c.pending ? "Publishing…" : c.error ? "Try again" : "Publish"}
              </button>
            </div>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
