import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOwnerPost, manageOwnPost, getMySupporterShowcase, type ManageOwnPostInput } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { authInit } from "@/components/inbox/use-messaging";
import { postPath } from "@/components/post-viewer/PostViewerProvider";
import type { PostRef } from "@/lib/post-activity";
import { OwnPostMenu, type OwnerPostAction } from "./OwnPostMenu";
import { PostEditDialog } from "./PostEditDialog";
import { holdFeedPlayback } from "@/components/inline-video-player";
import { ChangeCoverDialog } from "./ChangeCoverDialog";
import { uploadPostCover } from "@/lib/post-cover";
import { getOrgFeed } from "@/lib/api";

export function OwnPostActions({ postRef, owner, onRemoved, className }: {
  postRef: PostRef; owner: boolean; onRemoved?: () => void; className?: string;
}) {
  const { token, user } = useAuth();
  const qc = useQueryClient();
  const [editor, setEditor] = useState(false);
  const [covering, setCovering] = useState(false);
  const uploaded = useRef<{ hash: string; id: string } | null>(null);
  useEffect(() => { uploaded.current = null; setEditor(false); setCovering(false); }, [user?.id, postRef.kind, postRef.id]);
  useEffect(() => editor || covering ? holdFeedPlayback() : undefined, [editor, covering]);
  const q = useQuery({
    queryKey: ["owner-post", postRef.kind, postRef.id, token],
    queryFn: ({ signal }) => getOwnerPost(postRef.kind, postRef.id, authInit(token, signal)),
    enabled: owner && !!token, staleTime: 15_000,
  });
  const save = useMutation({
    mutationFn: (input: ManageOwnPostInput) => manageOwnPost(postRef.kind, postRef.id, input, authInit(token)),
    onSuccess: async () => {
      await qc.invalidateQueries({ predicate: query => query.queryKey.some(k => typeof k === "string" &&
        /^(owner-post|post-|feed|managed-posts|org[-/]|bookmarks|supporter-|\/api\/supporter-|\/api\/feed)/.test(k)) });
    },
  });
  const neighbours = useQuery({
    queryKey: ["owner-post-neighbours", token, postRef.kind, postRef.id],
    enabled: owner && !!token && covering && !!q.data,
    queryFn: async () => {
      if (postRef.kind === "update") return (await getOrgFeed(q.data!.author.id)).filter(p => p._id !== postRef.id)
        .map(p => ({ url: p.coverUrl || p.imageUrl || p.mediaUrls.find(u => /\.(jpe?g|png|webp)(?:[?#]|$)/i.test(u)) || "" })).filter(p => p.url).slice(0, 5);
      const profile = await getMySupporterShowcase(authInit(token));
      return profile.posts.filter(p => p.id !== postRef.id).map(p => ({ url: p.coverUrl || p.media[0]?.video_thumbnail_url || (p.media[0]?.type === "photo" ? p.media[0].url : "") || "" })).filter(p => p.url).slice(0, 5);
    },
  });
  const onAction = async (action: OwnerPostAction) => {
    if (!q.data) return;
    if (action === "edit") { setEditor(true); return; }
    if (action === "cover") { setCovering(true); return; }
    if (action === "copy") {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      await navigator.clipboard.writeText(new URL(`${base}${postPath(postRef)}`, window.location.origin).href);
      return;
    }
    const input: ManageOwnPostInput = action === "pin" ? { pinned: !q.data.pinned } :
      action === "commenting" ? { commentsDisabled: !q.data.commentsDisabled } :
      { status: action === "restore" ? "published" : action === "delete" ? "deleted" : "archived" };
    await save.mutateAsync(input);
    if (action === "delete" || action === "archive") onRemoved?.();
  };
  if (!owner || !q.data || q.data.status === "deleted") return null;
  return <>
    {(editor || covering) && <span hidden data-post-management-open />}
    <OwnPostMenu video={q.data.media.some(m => m.type === "video")} pinned={q.data.pinned}
      archived={q.data.status === "archived"} commentsDisabled={q.data.commentsDisabled} onAction={onAction} className={className} />
    {editor && <PostEditDialog post={q.data} hidden={covering} onSave={async input => { await save.mutateAsync(input); }}
      onClose={() => setEditor(false)} onChangeCover={() => setCovering(true)} />}
    {covering && <ChangeCoverDialog post={q.data} neighbours={neighbours.data} onClose={() => setCovering(false)}
      onSave={async file => {
        const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
        const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
        if (uploaded.current?.hash !== hash) {
          const media = await uploadPostCover(file, token!);
          uploaded.current = { hash, id: media.id };
        }
        await save.mutateAsync({ coverMediaId: uploaded.current!.id });
      }} />}
  </>;
}
