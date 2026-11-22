import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMessagingContext, listMessageConversations, getConversationMessages, getMessagingTeam,
  type MessagingContext, type MessageInbox, type ConversationMessages, type MessagingTeam,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";

const ROOT = "messaging";
export const PERSONAL = "personal";
export const msgKey = (token: string | null) => [ROOT, token] as const;
export const authInit = (token: string | null, signal?: AbortSignal): RequestInit =>
  ({ signal, headers: { Authorization: `Bearer ${token}` } });

export function errorStatus(e: unknown): number | undefined {
  const s = (e as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : undefined;
}
const noRetryOnDenied = (count: number, e: unknown) => {
  const s = errorStatus(e);
  if (s === 401 || s === 403 || s === 404) return false;
  return count < 1;
};

/** Private cache per token; any other account's messaging data is dropped on auth change. */
export function useMessagingContext() {
  const { token, user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    qc.removeQueries({ queryKey: [ROOT], predicate: q => q.queryKey[1] !== token });
  }, [token, qc]);
  const enabled = !!token && !!user;
  const q = useQuery<MessagingContext>({
    queryKey: [...msgKey(token), "context"],
    enabled,
    queryFn: ({ signal }) => getMessagingContext(authInit(token, signal)),
    refetchInterval: 12_000,
    refetchOnWindowFocus: "always",
    staleTime: 5_000,
    retry: noRetryOnDenied,
  });
  return { ...q, enabled, token };
}

export function useInboxList(scope: string | null) {
  const { token } = useAuth();
  return useQuery<MessageInbox>({
    queryKey: [...msgKey(token), "inbox", scope],
    enabled: !!token && !!scope,
    queryFn: ({ signal }) => listMessageConversations(scope === PERSONAL ? undefined : { orgId: scope! }, authInit(token, signal)),
    refetchInterval: 5_000,
    refetchOnWindowFocus: "always",
    staleTime: 2_000,
    retry: noRetryOnDenied,
  });
}

export function useThreadNewest(scope: string | null, conversationId: string | null) {
  const { token } = useAuth();
  return useQuery<ConversationMessages>({
    queryKey: [...msgKey(token), "thread", scope, conversationId],
    enabled: !!token && !!scope && !!conversationId,
    queryFn: ({ signal }) => getConversationMessages({ conversationId: conversationId!, ...(scope === PERSONAL ? {} : { orgId: scope! }) }, authInit(token, signal)),
    refetchInterval: 5_000,
    refetchOnWindowFocus: "always",
    staleTime: 2_000,
    retry: noRetryOnDenied,
  });
}

export function useMessagingTeam(orgId: string | null, enabled: boolean) {
  const { token } = useAuth();
  return useQuery<MessagingTeam>({
    queryKey: [...msgKey(token), "team", orgId],
    enabled: !!token && !!orgId && enabled,
    queryFn: ({ signal }) => getMessagingTeam(orgId!, authInit(token, signal)),
    retry: noRetryOnDenied,
  });
}

/** Refresh counters and lists after send/read. */
export function invalidateMessaging(qc: ReturnType<typeof useQueryClient>, token: string | null) {
  return qc.invalidateQueries({ queryKey: msgKey(token) });
}

/** Small unread badge driven by messaging context (total across scopes). */
export function InboxUnreadCount() {
  const q = useMessagingContext();
  return q.data?.unreadCount ?? 0;
}
