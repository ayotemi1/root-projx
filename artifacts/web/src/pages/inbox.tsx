import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MoreHorizontal, Inbox as InboxIcon, Users, X } from "lucide-react";
import {
  getConversationMessages, sendConversationMessage, markConversationRead,
  addMessagingTeamMember, removeMessagingTeamMember,
  type ConversationMessage, type MessageConversation, type MessagingContext,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import {
  PERSONAL, authInit, errorStatus, invalidateMessaging, msgKey,
  useMessagingContext, useInboxList, useThreadNewest, useMessagingTeam,
} from "@/components/inbox/use-messaging";
import "@/components/inbox/inbox.css";

const MAX = 2000;

function stamp(iso: string) {
  const d = new Date(iso); const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (d.toDateString() === now.toDateString()) return `${Math.floor(mins / 60)}h`;
  if (mins < 7 * 1440) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function initials(name: string) {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "RP";
}
function Avatar({ name, url }: { name: string; url?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <span className="rpm-av" aria-hidden>{url && failed !== url ? <img src={url} alt="" onError={() => setFailed(url)} /> : initials(name)}</span>;
}
function useDesktop() {
  const q = "(min-width: 1024px)";
  const [d, setD] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q); const on = () => setD(m.matches);
    m.addEventListener("change", on); return () => m.removeEventListener("change", on);
  }, []);
  return d;
}
function useVisible() {
  const [v, setV] = useState(() => document.visibilityState === "visible");
  useEffect(() => {
    const on = () => setV(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", on); return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return v;
}

function pickScope(ctx: MessagingContext, wanted: string | null, ownId: string | null, isOrg: boolean) {
  const orgIds = ctx.organisations.map(o => o.id);
  if (wanted && orgIds.includes(wanted)) return wanted;
  if (isOrg && ownId && orgIds.includes(ownId)) return ownId;
  if (ctx.personal) return PERSONAL;
  return orgIds[0] ?? null;
}

type Intent = { clientId: string; text: string };

export default function InboxPage() {
  const { token, user, isAuthenticated } = useAuth();
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const urlConv = params.get("conversation");
  const urlOrg = params.get("orgId");
  const desktop = useDesktop();
  const ctx = useMessagingContext();

  const scope = ctx.data ? pickScope(ctx.data, urlOrg, user?.id ? String(user.id) : null, user?.accountType === "organisation") : null;
  const list = useInboxList(scope);
  const conversations = list.data?.conversations ?? [];

  const [selected, setSelected] = useState<string | null>(urlConv);
  const [mobileThread, setMobileThread] = useState<boolean>(!!urlConv);
  const [teamOpen, setTeamOpen] = useState(false);
  const ownerId = user?.id ? String(user.id) : null;
  const previousOwner = useRef<string | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const on = () => {
      const frame = document.querySelector<HTMLElement>('[data-testid="page-inbox"] .rpm-frame');
      if (!frame) return;
      const bottom = (vv?.height ?? window.innerHeight) + (vv?.offsetTop ?? 0);
      const nav = document.querySelector(".rps-bottom")?.getBoundingClientRect();
      const limit = nav && nav.top < bottom && nav.bottom > 0 ? nav.top : bottom;
      root.style.setProperty("--rpm-frame-h", `${Math.max(140, limit - frame.getBoundingClientRect().top - 12)}px`);
    };
    let raf = 0;
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(on); };
    const ro = new ResizeObserver(schedule);
    document.querySelectorAll(".rpm-head,.rpm-scopes,.rpm-acct,.rpm-team").forEach(el => ro.observe(el));
    schedule(); vv?.addEventListener("resize", schedule); vv?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      ro.disconnect(); cancelAnimationFrame(raf); vv?.removeEventListener("resize", schedule); vv?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule); root.style.removeProperty("--rpm-frame-h");
    };
  }, [scope, mobileThread, teamOpen, ctx.data?.organisations.length]);
  const scopeRef = useRef(scope);
  useEffect(() => {
    if (scopeRef.current !== scope && scopeRef.current !== null) { setSelected(null); setMobileThread(false); }
    scopeRef.current = scope;
  }, [scope]);
  useEffect(() => { setSelected(urlConv); if (urlConv) setMobileThread(true); }, [urlConv]);
  useEffect(() => {
    if (previousOwner.current === ownerId) return;
    const switched = previousOwner.current !== null;
    previousOwner.current = ownerId;
    for (const key of drafts.keys()) if (!ownerId || !key.startsWith(`${ownerId}:`)) drafts.delete(key);
    for (const key of intents.keys()) if (!ownerId || !key.startsWith(`${ownerId}:`)) intents.delete(key);
    setSelected(switched ? null : urlConv); setMobileThread(!switched && !!urlConv); setTeamOpen(false);
    if (switched && urlConv) navigate("/inbox", { replace: true });
  }, [ownerId, urlConv, navigate]);

  // Desktop: default to the first chat only when nothing was asked for.
  useEffect(() => {
    if (desktop && !selected && !urlConv && conversations[0]) setSelected(conversations[0].id);
  }, [desktop, selected, urlConv, conversations]);

  const setScope = (s: string) => {
    navigate(s === PERSONAL ? "/inbox" : `/inbox?orgId=${encodeURIComponent(s)}`);
    setSelected(null); setMobileThread(false); setTeamOpen(false);
  };
  const open = (id: string) => { setSelected(id); setMobileThread(true); };
  const back = () => { setMobileThread(false); if (urlConv) navigate(scope && scope !== PERSONAL ? `/inbox?orgId=${encodeURIComponent(scope)}` : "/inbox", { replace: true }); };

  if (!isAuthenticated) {
    return (
      <section className="rpm-page rpm-state-page" data-testid="page-inbox">
        <h1 className="rpm-title">Inbox</h1>
        <div className="rpm-state"><p>Sign in to message the organisations you support.</p>
          <Link href="/login" className="rp-btn rp-btn-yellow" data-testid="link-inbox-signin">Sign in</Link></div>
      </section>
    );
  }

  const scopeOrg = ctx.data?.organisations.find(o => o.id === scope);
  const showScopes = !!ctx.data && (ctx.data.organisations.length + (ctx.data.personal ? 1 : 0)) > 1;
  const threadVisible = desktop || mobileThread;

  return (
    <section className={`rpm-page${mobileThread ? " is-thread" : ""}`} data-testid="page-inbox">
      <div className="rpm-head">
        <h1 className="rpm-title">Inbox</h1>
        {scopeOrg?.canManageTeam && (
          <button type="button" className="rpm-ghost" aria-expanded={teamOpen} onClick={() => setTeamOpen(o => !o)} data-testid="button-messaging-team">
            <Users size={15} aria-hidden /> Messaging team
          </button>
        )}
      </div>

      {showScopes && ctx.data && (
        <div className="rpm-scopes" role="tablist" aria-label="Inbox">
          {ctx.data.personal && (
            <button role="tab" type="button" aria-selected={scope === PERSONAL} className="rpm-scope" onClick={() => setScope(PERSONAL)} data-testid="tab-scope-personal">
              Personal{ctx.data.personalUnreadCount > 0 && <span className="rpm-count">{ctx.data.personalUnreadCount}</span>}
            </button>
          )}
          {ctx.data.organisations.map(o => (
            <button key={o.id} role="tab" type="button" aria-selected={scope === o.id} className="rpm-scope" onClick={() => setScope(o.id)} data-testid={`tab-scope-${o.id}`}>
              {o.name}{o.unreadCount > 0 && <span className="rpm-count">{o.unreadCount}</span>}
            </button>
          ))}
        </div>
      )}

      <AccountId />

      {teamOpen && scopeOrg?.canManageTeam && <TeamPanel orgId={scopeOrg.id} orgName={scopeOrg.name} onClose={() => setTeamOpen(false)} />}

      {ctx.isLoading ? (
        <div className="rpm-frame" aria-busy="true"><ListSkeleton /></div>
      ) : ctx.isError ? (
        <div className="rpm-state" role="alert"><p>We couldn't open your inbox just now.</p>
          <button type="button" className="rp-btn rp-btn-yellow" onClick={() => ctx.refetch()} data-testid="button-retry-inbox">Try again</button></div>
      ) : !scope ? (
        <div className="rpm-state" data-testid="text-inbox-empty"><InboxIcon size={22} aria-hidden /><p>No conversations yet</p></div>
      ) : (
        <div className="rpm-frame">
          <div className="rpm-list" aria-label="Conversations">
            {list.isLoading ? <ListSkeleton /> : list.isError ? (
              <div className="rpm-state sm" role="alert"><p>Conversations didn't load.</p>
                <button type="button" className="rpm-ghost" onClick={() => list.refetch()} data-testid="button-retry-conversations">Retry</button></div>
            ) : conversations.length === 0 ? (
              <div className="rpm-state sm" data-testid="text-inbox-empty"><p>No conversations yet</p>
                {scope === PERSONAL && <Link href="/discover" className="rp-link-u" data-testid="link-inbox-discover">Find an organisation to message</Link>}</div>
            ) : (
              <ul>
                {conversations.map(c => (
                  <li key={c.id}>
                    <button type="button" className="rpm-row" aria-current={selected === c.id ? "true" : undefined}
                      onClick={() => open(c.id)} data-testid={`row-conversation-${c.id}`}>
                      <Avatar name={c.name} url={c.avatarUrl} />
                      <span className="rpm-row-main">
                        <span className={`rpm-row-name${c.unreadCount ? " unread" : ""}`}>{c.name}</span>
                        <span className="rpm-row-last">{c.lastMessage || c.participantLabel}</span>
                      </span>
                      <span className="rpm-row-meta">
                        <span className="rpm-tiny">{stamp(c.updatedAt)}</span>
                        {c.unreadCount > 0 && <span className="rpm-dot" aria-label={`${c.unreadCount} unread`}>{c.unreadCount}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rpm-thread-col">
            {selected ? (
              <Thread key={`${ownerId}:${scope}:${selected}`} scope={scope} conversationId={selected}
                summary={conversations.find(c => c.id === selected)} active={threadVisible} onBack={back} />
            ) : (
              <div className="rpm-state sm rpm-none"><p>{conversations.length ? "Choose a conversation." : "No conversations yet"}</p></div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function AccountId() {
  const { user } = useAuth();
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  if (!user) return null;
  const id = String(user.id);
  const copy = async () => {
    try { await navigator.clipboard.writeText(id); setCopied("ok"); } catch { setCopied("fail"); }
    window.setTimeout(() => setCopied("idle"), 2400);
  };
  return (
    <details className="rpm-acct" data-testid="panel-account-id">
      <summary className="rpm-tiny">Replying for an organisation?</summary>
      <div className="rpm-acct-body">
        <p>Give this account ID to the organisation owner. They can add it to their messaging team, which only lets you read and reply to their messages.</p>
        <div className="rpm-acct-row">
          <code data-testid="text-account-id">{id}</code>
          <button type="button" className="rpm-ghost" onClick={copy} data-testid="button-copy-account-id">
            {copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed" : "Copy account ID"}
          </button>
        </div>
      </div>
    </details>
  );
}

function ListSkeleton() {
  return <div className="rpm-skel" aria-hidden>{[0, 1, 2].map(i => <div key={i}><span className="b c" /><span className="b l" /></div>)}</div>;
}

// Drafts survive thread/scope switches in memory only; never persisted.
const drafts = new Map<string, string>();
const intents = new Map<string, Intent>();

function Thread({ scope, conversationId, summary, active, onBack }: {
  scope: string; conversationId: string; summary?: MessageConversation; active: boolean; onBack: () => void;
}) {
  const { token, user } = useAuth();
  const qc = useQueryClient();
  const visible = useVisible();
  const draftKey = `${user?.id}:${scope}:${conversationId}`;
  const orgParam = scope === PERSONAL ? {} : { orgId: scope };
  const newest = useThreadNewest(scope, conversationId);
  const [older, setOlder] = useState<ConversationMessage[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState(false);
  const [draft, setDraftState] = useState(() => drafts.get(draftKey) ?? "");
  const [intent, setIntent] = useState<Intent | null>(() => intents.get(draftKey) ?? null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [readError, setReadError] = useState(false);
  const [menu, setMenu] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastMarked = useRef(0);
  const marking = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const setDraft = (v: string | ((d: string) => string)) => setDraftState(prev => {
    const n = typeof v === "function" ? v(prev) : v;
    drafts.set(draftKey, n); return n;
  });
  const saveIntent = (i: Intent | null) => { if (i) intents.set(draftKey, i); else intents.delete(draftKey); setIntent(i); };

  const denied = newest.isError && [401, 403, 404].includes(errorStatus(newest.error) ?? 0);
  const data = denied ? undefined : newest.data;
  const conv = data?.conversation ?? summary;

  const messages = useMemo(() => {
    const byId = new Map<string, ConversationMessage>();
    for (const m of older) byId.set(m.id, m);
    for (const m of data?.messages ?? []) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
  }, [older, data?.messages]);

  useEffect(() => {
    if (data?.messages.length) setOlder(prev => {
      const map = new Map(prev.map(m => [m.id, m]));
      for (const m of data.messages) map.set(m.id, m);
      return [...map.values()];
    });
  }, [data?.messages]);
  const gap = messages.find((m, i) => i > 0 && m.sequence > messages[i - 1]!.sequence + 1)?.sequence;
  const cursor = gap ?? messages[0]?.sequence ?? null;
  const hasMore = cursor !== null && cursor > 1;

  const loadEarlier = async () => {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true); setOlderError(false);
    const el = scroller.current; const prevH = el?.scrollHeight ?? 0;
    try {
      const page = await getConversationMessages({ conversationId, beforeSequence: cursor, ...orgParam }, authInit(token));
      if (!alive.current) return;
      setOlder(o => [...page.messages, ...o]);
      requestAnimationFrame(() => { if (el) el.scrollTop += el.scrollHeight - prevH; });
    } catch { if (alive.current) setOlderError(true); }
    finally { if (alive.current) setLoadingOlder(false); }
  };

  // Keep pinned to the bottom when the reader is already there.
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, active]);
  const onScroll = () => {
    const el = scroller.current; if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  // Mark read only for a displayed, visible thread, up to what the server says we have loaded.
  const through = data?.readThrough ?? 0;
  const unread = data?.conversation.unreadCount ?? 0;
  const markRead = () => {
    if (!active || !visible || !data || unread === 0 || through <= lastMarked.current || marking.current) return;
    marking.current = true;
    markConversationRead(conversationId, { through, ...orgParam }, authInit(token))
      .then(() => {
        if (!alive.current) return;
        lastMarked.current = Math.max(lastMarked.current, through); setReadError(false);
        return invalidateMessaging(qc, token);
      })
      .catch(() => { if (alive.current) setReadError(true); })
      .finally(() => { marking.current = false; });
  };
  useEffect(() => { markRead(); }, [active, visible, data, unread, through, conversationId, token, qc, scope, newest.dataUpdatedAt]);

  const trimmed = draft.trim();
  const edited = !!intent && intent.text !== trimmed;

  const send = async (payload: Intent) => {
    setSending(true); setSendError(null);
    try {
      await sendConversationMessage(conversationId, { ...payload, ...orgParam }, authInit(token));
      if (!alive.current) return;
      saveIntent(null);
      setDraft(d => (d.trim() === payload.text ? "" : d.startsWith(payload.text) ? d.slice(payload.text.length).replace(/^\s+/, "") : d));
      stick.current = true;
      await invalidateMessaging(qc, token);
    } catch (e) {
      if (!alive.current) return;
      const s = errorStatus(e);
      if (s !== undefined && s >= 400 && s < 500 && s !== 408 && s !== 429) {
        saveIntent(null);
        setSendError(s === 401 ? "Your session has expired. Sign in again to retry. Your message is kept here." :
          s === 403 || s === 404 ? "You can't send messages in this conversation." : "That message couldn't be sent. Check it and try again.");
      } else {
        setSendError(s === 429 ? "You're sending too quickly. Wait a minute, then retry. Your message is kept here." :
          "Not sent. Your connection or our server dropped out. Your message is kept here.");
      }
    } finally { if (alive.current) setSending(false); }
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (sending || !trimmed || trimmed.length > MAX || conv?.canSend === false) return;
    if (intent) { if (!edited) void send(intent); return; }
    const next = { clientId: crypto.randomUUID(), text: trimmed };
    saveIntent(next); void send(next);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };

  const mySide = conv?.side;

  return (
    <div className="rpm-thread" data-testid={`thread-${conversationId}`}>
      <header className="rpm-thread-head">
        <button type="button" className="rpm-icon rpm-back" onClick={onBack} aria-label="Back to conversations" data-testid="button-inbox-back">
          <ArrowLeft size={18} aria-hidden />
        </button>
        {conv && !denied ? (
          <>
            <Avatar name={conv.name} url={conv.avatarUrl} />
            <div className="rpm-thread-id">
              <span className="rpm-thread-name" data-testid="text-thread-name">{conv.name}</span>
              <span className="rpm-thread-label">{conv.participantLabel}{conv.senderLabel ? ` · Sending as ${conv.senderLabel}` : ""}</span>
            </div>
          </>
        ) : <div className="rpm-thread-id" />}
        <div className="rpm-menu-wrap">
          <button type="button" className="rpm-icon" aria-label="Conversation options" aria-expanded={menu} onClick={() => setMenu(m => !m)} data-testid="button-thread-options">
            <MoreHorizontal size={18} aria-hidden />
          </button>
          {menu && (
            <div className="rpm-menu" role="menu">
              {conv?.peerHref && (
                <Link href={conv.peerHref} role="menuitem" className="rpm-menu-item" data-testid="link-thread-peer">View profile</Link>
              )}
              <button type="button" role="menuitem" className="rpm-menu-item" onClick={() => { setMenu(false); void newest.refetch(); }} data-testid="button-thread-refresh">Refresh</button>
            </div>
          )}
        </div>
      </header>

      {readError && !denied && <p className="rpm-err" role="status">Read status couldn't be saved. <button type="button" className="rp-link-u" onClick={markRead}>Retry</button></p>}
      {newest.isError && data && !denied && <p className="rpm-err" role="status">Messages may be out of date. <button type="button" className="rp-link-u" onClick={() => newest.refetch()}>Retry</button></p>}
      <div className="rpm-scroll" ref={scroller} onScroll={onScroll} aria-live="polite">
        {denied ? (
          <div className="rpm-state sm" role="alert" data-testid="text-thread-unavailable"><p>This conversation isn't available to this account.</p></div>
        ) : newest.isLoading ? (
          <ListSkeleton />
        ) : newest.isError && !data ? (
          <div className="rpm-state sm" role="alert"><p>Messages didn't load.</p>
            <button type="button" className="rpm-ghost" onClick={() => newest.refetch()} data-testid="button-retry-thread">Retry</button></div>
        ) : (
          <>
            {hasMore && (
              <div className="rpm-earlier">
                <button type="button" className="rpm-ghost" onClick={loadEarlier} disabled={loadingOlder} data-testid="button-load-earlier">
                  {loadingOlder ? "Loading…" : olderError ? "Retry loading earlier" : gap ? "Load missing messages" : "Load earlier"}
                </button>
              </div>
            )}
            {messages.length === 0 ? (
              <p className="rpm-hint">Say hello. Messages here are private between you and {conv?.name ?? "them"}.</p>
            ) : (
              <ol className="rpm-msgs">
                {messages.map(m => (
                  <li key={m.id} className={`rpm-msg ${m.side === mySide ? "mine" : "theirs"}`} data-testid={`message-${m.id}`}>
                    <p>{m.text}</p>
                    <time dateTime={m.createdAt} className="rpm-tiny">{stamp(m.createdAt)}</time>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>

      {!denied && (
        <form className="rpm-compose" onSubmit={submit}>
          {(sendError || edited) && (
            <div className="rpm-send-note" role="alert" data-testid="status-send">
              <span>{edited ? "Your last message may already have been delivered. Retry it as written, or start a fresh message." : sendError}</span>
              {intent && (
                <span className="rpm-send-actions">
                  <button type="button" className="rpm-ghost" disabled={sending} onClick={() => { setDraft(intent.text); void send(intent); }} data-testid="button-send-retry">Retry original</button>
                  {edited && <button type="button" className="rpm-ghost" onClick={() => { saveIntent(null); setSendError(null); }} data-testid="button-send-reset">Send as new</button>}
                </span>
              )}
            </div>
          )}
          {conv?.canSend === false ? (
            <p className="rpm-hint">Replies are closed for this conversation.</p>
          ) : (
            <div className="rpm-compose-row">
              <label className="sr-only" htmlFor={`rpm-input-${conversationId}`}>Message</label>
              <textarea id={`rpm-input-${conversationId}`} rows={1} className="rpm-input" placeholder="Write a message…"
                value={draft} maxLength={MAX} onChange={e => setDraft(e.target.value)} onKeyDown={onKey}
                onFocus={() => { stick.current = true; }} data-testid="input-message" />
              <button type="submit" className="rpm-send" disabled={sending || !trimmed || edited} data-testid="button-send-message">
                {sending ? "Sending" : "Send"}
              </button>
            </div>
          )}
          {draft.length > MAX - 200 && <span className="rpm-tiny rpm-limit">{draft.length}/{MAX}</span>}
        </form>
      )}
    </div>
  );
}

function TeamPanel({ orgId, orgName, onClose }: { orgId: string; orgName: string; onClose: () => void }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const team = useMessagingTeam(orgId, true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const apply = useCallback(async (fn: () => Promise<unknown>, fail: string) => {
    setBusy(true); setErr(null);
    try { await fn(); await qc.invalidateQueries({ queryKey: [...msgKey(token), "team", orgId] }); return true; }
    catch (e) { setErr(errorStatus(e) === 404 ? "No Root ProjX account has that ID." : fail); return false; }
    finally { setBusy(false); }
  }, [qc, token, orgId]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const v = email.trim(); if (!v) return;
    if (await apply(() => addMessagingTeamMember(orgId, { userId: v }, authInit(token)), "Couldn't add that person. Try again.")) setEmail("");
  };

  return (
    <section className="rpm-team" aria-labelledby="rpm-team-h" data-testid="panel-messaging-team">
      <div className="rpm-team-head">
        <h2 id="rpm-team-h" className="rpm-mono">Messaging team · {orgName}</h2>
        <button type="button" className="rpm-icon" onClick={onClose} aria-label="Close messaging team" data-testid="button-close-team"><X size={16} aria-hidden /></button>
      </div>
      <p className="rpm-team-note">People added here can read and reply to {orgName}'s messages. It gives no other access: no profile, campaign, payout or bank permissions. To add someone, ask them to open their own Inbox, copy their account ID, and send it to you. Paste it below exactly.</p>
      {team.isLoading ? <ListSkeleton /> : team.isError ? (
        <div className="rpm-state sm" role="alert"><p>Team didn't load.</p><button type="button" className="rpm-ghost" onClick={() => team.refetch()} data-testid="button-retry-team">Retry</button></div>
      ) : (team.data?.members.length ?? 0) === 0 ? (
        <p className="rpm-hint">Only you can reply right now.</p>
      ) : (
        <ul className="rpm-team-list">
          {team.data!.members.map(m => (
            <li key={m.userId} data-testid={`row-team-${m.userId}`}>
              <span className="rpm-team-who"><strong>{m.name}</strong><span>{m.userId}</span></span>
              {confirm === m.userId ? (
                <span className="rpm-send-actions">
                  <button type="button" className="rpm-ghost danger" disabled={busy}
                    onClick={async () => { if (await apply(() => removeMessagingTeamMember(orgId, m.userId, authInit(token)), "Couldn't remove them. Try again.")) setConfirm(null); }}
                    data-testid={`button-confirm-remove-${m.userId}`}>Remove access</button>
                  <button type="button" className="rpm-ghost" onClick={() => setConfirm(null)} data-testid={`button-cancel-remove-${m.userId}`}>Keep</button>
                </span>
              ) : (
                <button type="button" className="rpm-ghost" onClick={() => setConfirm(m.userId)} data-testid={`button-remove-${m.userId}`}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="rpm-team-add" onSubmit={add}>
        <label className="sr-only" htmlFor="rpm-team-email">Team member account ID</label>
        <input id="rpm-team-email" type="text" autoComplete="off" spellCheck={false} maxLength={128} className="rpm-input" placeholder="Team member account ID"
          value={email} onChange={e => setEmail(e.target.value)} data-testid="input-team-email" />
        <button type="submit" className="rpm-send" disabled={busy || !email.trim()} data-testid="button-add-team">Add</button>
      </form>
      {err && <p className="rpm-err" role="alert">{err}</p>}
    </section>
  );
}
