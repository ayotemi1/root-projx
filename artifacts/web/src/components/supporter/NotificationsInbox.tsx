import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Heart, MessageCircle, Receipt, TrendingUp, Megaphone, Sparkles, X, UserPlus } from "lucide-react";
import type { SupporterNotification, SupporterNotificationType } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useSupporterNotifications, useOpenNotification } from "./use-supporter-notifications";
import "./notifications.css";

const filters = [
  { id: "all", label: "All", types: null },
  { id: "following", label: "Organisations you follow", types: ["organisation_post", "story", "campaign_milestone"] },
  { id: "comments", label: "Comments", types: ["comment"] },
  { id: "likes", label: "Likes", types: ["like"] },
] as const satisfies readonly { id: string; label: string; types: readonly SupporterNotificationType[] | null }[];
/** Organisation configuration; same implementation. "follower" arrives with the extended enum. */
const orgFilters: readonly { id: string; label: string; types: readonly string[] | null }[] = [
  { id: "all", label: "All", types: null },
  { id: "donations", label: "Donations", types: ["donation"] },
  { id: "followers", label: "Followers", types: ["follower"] },
  { id: "comments", label: "Comments", types: ["comment"] },
  { id: "likes", label: "Likes", types: ["like"] },
  { id: "campaigns", label: "Campaigns", types: ["campaign_milestone"] },
];
type FilterId = string;

// Unknown/new types (e.g. "message") fall back to the message icon.
const typeIcon: Partial<Record<string, typeof Heart>> = {
  organisation_post: Megaphone, story: Sparkles, comment: MessageCircle,
  like: Heart, follower: UserPlus, campaign_milestone: TrendingUp, donation: Receipt,
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join("") || "RP";
}

function ago(iso: string) {
  const d = new Date(iso); const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function group(items: SupporterNotification[]) {
  const sod = new Date(); sod.setHours(0, 0, 0, 0);
  const week = sod.getTime() - 6 * 86400_000;
  const out: { label: string; items: SupporterNotification[] }[] = [
    { label: "Today", items: [] }, { label: "This week", items: [] }, { label: "Earlier", items: [] },
  ];
  [...items].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).forEach(n => {
    const t = +new Date(n.createdAt);
    out[t >= sod.getTime() ? 0 : t >= week ? 1 : 2]!.items.push(n);
  });
  return out.filter(g => g.items.length);
}

function Mark({ n }: { n: SupporterNotification }) {
  const Icon = typeIcon[n.type] ?? MessageCircle;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (n.avatarUrl && failedSrc !== n.avatarUrl) return <img className="rpn-mark rpn-mark-img" src={n.avatarUrl} alt="" onError={() => setFailedSrc(n.avatarUrl ?? null)} />;
  if (n.type === "donation" || n.type === "campaign_milestone" || !typeIcon[n.type]) return <span className="rpn-mark rpn-mark-icon" aria-hidden><Icon size={16} /></span>;
  return <span className={`rpn-mark ${n.type === "like" || n.type === "comment" ? "rpn-mark-ink" : ""}`} aria-hidden>{initials(n.name)}</span>;
}

export function NotificationsInbox({ variant, titleId, onClose, onNavigate }: {
  variant: "panel" | "page"; titleId: string; onClose?: () => void; onNavigate?: () => void;
}) {
  const q = useSupporterNotifications();
  const { user } = useAuth();
  const activeFilters: readonly { id: string; label: string; types: readonly string[] | null }[] =
    user?.accountType === "organisation" ? orgFilters : filters;
  const { open, pendingId, failedId } = useOpenNotification(onNavigate);
  const [filter, setFilter] = useState<FilterId>("all");
  const items = q.data?.items;
  const groups = useMemo(() => {
    const f = activeFilters.find(x => x.id === filter) ?? activeFilters[0]!;
    const list = (items ?? []).filter(n => !f.types || f.types.includes(n.type));
    return group(list);
  }, [items, filter, activeFilters]);

  return (
    <div className={`rpn rpn-${variant}`} data-testid={`notifications-${variant}`}>
      <div className="rpn-head">
        <h1 id={titleId} tabIndex={-1} className="rpn-title">Notifications</h1>
        {variant === "page" && <Link href="/settings" className="rp-link-u rpn-settings" data-testid="link-notifications-settings">Settings</Link>}
        {onClose && (
          <button type="button" className="rpn-close" onClick={onClose} aria-label="Close notifications" data-testid="button-close-notifications">
            <X size={20} aria-hidden />
          </button>
        )}
      </div>
      <div className="rpn-filters" role="tablist" aria-label="Filter notifications">
        {activeFilters.map(f => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className="rpn-filter"
            onClick={() => setFilter(f.id)} data-testid={`button-notification-filter-${f.id}`}>{f.label}</button>
        ))}
      </div>

      <div className="rpn-body" role="tabpanel">
        {q.isLoading ? (
          <ul className="rpn-list" aria-busy="true" aria-label="Loading notifications">
            {[0, 1, 2, 3].map(i => <li key={i} className="rpn-skel"><span className="rpn-mark" /><span><i /><i /></span></li>)}
          </ul>
        ) : q.isError && !q.data ? (
          <div className="rpn-note" role="alert" data-testid="status-notifications-error">
            <p>We couldn't load your notifications just now.</p>
            <button type="button" className="rps-chip" onClick={() => q.refetch()} data-testid="button-retry-notifications">Retry</button>
          </div>
        ) : groups.length === 0 ? (
          <div className="rpn-empty" data-testid="status-notifications-empty">
            <p className="rpn-empty-h">{filter === "all" ? "You’re all caught up" : "No notifications in this category yet"}</p>
          </div>
        ) : groups.map(g => (
          <section key={g.label} className="rpn-group" aria-label={g.label}>
            <h2 className="rpn-group-h">{g.label}</h2>
            <ul className="rpn-list">
              {g.items.map(n => (
                <li key={n.id}>
                  <button type="button" className={`rpn-item ${n.read ? "" : "is-unread"}`} onClick={() => open(n)}
                    aria-busy={pendingId === n.id} disabled={pendingId === n.id} data-testid={`button-notification-${n.id}`}>
                    <Mark n={n} />
                    <span className="rpn-msg">
                      {n.message} <time dateTime={n.createdAt} className="rpn-time">{ago(n.createdAt)}</time>
                      {!n.read && <span className="sr-only"> (unread)</span>}
                    </span>
                    {n.thumbnailUrl && <img className="rpn-thumb" src={n.thumbnailUrl} alt="" />}
                  </button>
                  {failedId === n.id && (
                    <p className="rpn-fail" role="alert" data-testid={`status-notification-failed-${n.id}`}>
                      That didn't open. Please try again.
                      <button type="button" className="rpn-retry" onClick={() => open(n)} data-testid={`button-retry-notification-${n.id}`}>Retry</button>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function UnreadBadge({ testId }: { testId: string }) {
  const q = useSupporterNotifications();
  const n = q.data?.unreadCount;
  if (!q.enabled || !n) return null;
  return <span className="rpn-badge" data-testid={testId} aria-label={`${n} unread`}>{n > 99 ? "99+" : n}</span>;
}
