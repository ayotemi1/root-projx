import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  listSupporterNotifications, readSupporterNotification,
  type SupporterNotification, type SupporterNotificationInbox,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";

const ROOT = "supporter-notifications";
export const notificationsKey = (token: string | null) => [ROOT, token] as const;

/** One private cache per auth token; disabled for guests, unapproved organisations and admin delegation. */
export function useSupporterNotifications() {
  const { token, user } = useAuth();
  const qc = useQueryClient();
  // Supporters and approved organisation owners; never admin-delegated org tokens.
  const enabled = !!token && !!user && !token.startsWith("org-admin.") && (
    user.accountType === "supporter" || (user.accountType === "organisation" && user.approvalStatus === "approved"));

  useEffect(() => {
    // Drop any other account's private inbox as soon as the account changes.
    qc.removeQueries({ queryKey: [ROOT], predicate: q => q.queryKey[1] !== token });
  }, [token, qc]);

  const query = useQuery<SupporterNotificationInbox>({
    queryKey: notificationsKey(token),
    enabled,
    queryFn: ({ signal }) => listSupporterNotifications({ signal, headers: { Authorization: `Bearer ${token}` } }),
    refetchOnWindowFocus: "always",
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
  return { ...query, enabled, token };
}

/** Mark read first; navigate only after the server confirms. */
export function useOpenNotification(onNavigate?: () => void) {
  const { token } = useAuth();
  const currentToken = useRef(token);
  currentToken.current = token;
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  useEffect(() => { setPendingId(null); setFailedId(null); }, [token]);

  const open = async (n: SupporterNotification) => {
    if (!token || pendingId) return;
    setPendingId(n.id); setFailedId(null);
    try {
      const inbox = await readSupporterNotification(n.id, { headers: { Authorization: `Bearer ${token}` } });
      if (currentToken.current !== token) return;
      qc.setQueryData(notificationsKey(token), inbox);
      void qc.invalidateQueries({ queryKey: notificationsKey(token) });
      onNavigate?.();
      navigate(n.href);
      const hash = n.href.split("#")[1];
      if (hash) setTimeout(() => document.getElementById(decodeURIComponent(hash))?.scrollIntoView(), 120);
    } catch {
      if (currentToken.current === token) setFailedId(n.id);
    } finally {
      if (currentToken.current === token) setPendingId(null);
    }
  };
  return { open, pendingId, failedId };
}
