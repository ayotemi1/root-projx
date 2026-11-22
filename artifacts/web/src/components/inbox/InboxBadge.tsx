import { useMessagingContext } from "./use-messaging";

export function InboxBadge({ testId, className = "rpn-badge" }: { testId: string; className?: string }) {
  const q = useMessagingContext();
  const n = q.data?.unreadCount ?? 0;
  if (!q.enabled || !n) return null;
  return <span className={className} data-testid={testId} aria-label={`${n} unread messages`}>{n > 99 ? "99+" : n}</span>;
}
