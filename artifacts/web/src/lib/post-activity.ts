import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPostViewer, getPostActivity, setPostLike, addPostComment, setPostCommentLike,
  type PostActivity, type PostViewerRecord,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { authInit } from "@/components/inbox/use-messaging";

export type PostKind = "update" | "post";
export type PostRef = { kind: PostKind; id: string };

export const POST_GENERIC_ERROR = "Something went wrong. Please try again.";
export const postRefKey = (r: PostRef) => `${r.kind}:${r.id}`;

/** Shared across viewer, feed cards and the direct post page; token-scoped so accounts never share cache. */
export const postActivityKey = (kind: PostKind, id: string, token: string | null) =>
  ["post-activity", kind, id, token ?? "guest"] as const;
export const postRecordKey = (kind: PostKind, id: string, token: string | null) =>
  ["post-viewer-record", kind, id, token ?? "guest"] as const;

const init = (token: string | null, signal?: AbortSignal): RequestInit =>
  token ? authInit(token, signal) : { signal };

export function usePostRecord(ref: PostRef | null) {
  const { token } = useAuth();
  return useQuery<PostViewerRecord>({
    queryKey: postRecordKey(ref?.kind ?? "post", ref?.id ?? "", token),
    queryFn: ({ signal }) => getPostViewer(ref!.kind, ref!.id, init(token, signal)),
    enabled: !!ref,
    staleTime: 60_000,
    retry: 1,
  });
}

export function usePostActivity(ref: PostRef | null, opts: { poll?: boolean; enabled?: boolean } = {}) {
  const { token } = useAuth();
  return useQuery<PostActivity>({
    queryKey: postActivityKey(ref?.kind ?? "post", ref?.id ?? "", token),
    queryFn: ({ signal }) => getPostActivity(ref!.kind, ref!.id, init(token, signal)),
    enabled: !!ref && opts.enabled !== false,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: opts.poll ? 20_000 : false,
    retry: 1,
  });
}

/** Mutations write only the server-confirmed activity into the shared cache (no invented counts). */
export function usePostActivityActions(ref: PostRef | null) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const put = (a: PostActivity) => { if (ref) qc.setQueryData(postActivityKey(ref.kind, ref.id, token), a); };
  const like = useMutation({
    mutationFn: (liked: boolean) => setPostLike(ref!.kind, ref!.id, { liked }, init(token)),
    onSuccess: put,
  });
  const comment = useMutation({
    mutationFn: (input: { clientId: string; text: string; parentId?: string | null }) =>
      addPostComment(ref!.kind, ref!.id, input, init(token)),
    onSuccess: put,
  });
  const likeComment = useMutation({
    mutationFn: (v: { commentId: string; liked: boolean }) =>
      setPostCommentLike(ref!.kind, ref!.id, v.commentId, { liked: v.liked }, init(token)),
    onSuccess: put,
  });
  return { like, comment, likeComment };
}

export function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
}

export function shortAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  if (s < 31536000) return `${Math.floor(s / 604800)}w`;
  return `${Math.floor(s / 31536000)}y`;
}

export const initialsFrom = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join("") || "RP";
