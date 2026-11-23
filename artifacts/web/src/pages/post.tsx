import { useEffect, useState } from "react";
import { useParams, useSearch } from "wouter";
import { getPostViewer } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { authInit } from "@/components/inbox/use-messaging";
import { usePostViewer } from "@/components/post-viewer/PostViewerProvider";
import type { PostKind } from "@/lib/post-activity";

/** Shared/reloaded links enter the same host, with the real feed behind it. */
export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearch();
  const { token, isLoading } = useAuth();
  const { open } = usePostViewer();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!id || isLoading) return;
    const controller = new AbortController();
    const query = new URLSearchParams(search);
    setError(false);
    const start = async () => {
      let kind = query.get("kind");
      if (kind !== "update" && kind !== "post") {
        // Old shared links omit kind. Only fall back on a genuine not-found:
        // an outage or auth failure must not masquerade as another post type.
        kind = "update";
        try { await getPostViewer("update", id, token ? authInit(token, controller.signal) : { signal: controller.signal }); }
        catch (e) {
          if ((e as { status?: number }).status !== 404) throw e;
          await getPostViewer("post", id, token ? authInit(token, controller.signal) : { signal: controller.signal });
          kind = "post";
        }
      }
      if (!controller.signal.aborted) open({
        refs: [{ kind: kind as PostKind, id }], index: 0,
        comments: query.get("comments") === "1", direct: true,
      });
    };
    void start().catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [id, search, token, isLoading, open, attempt]);
  return <div className="min-h-[70dvh] grid place-content-center gap-4 text-center" data-testid="page-post">
    {error ? <><p role="alert">This post isn't available right now.</p><button className="rp-btn" onClick={() => setAttempt(n => n + 1)}>Try again</button></>
      : <p role="status">Opening post…</p>}
  </div>;
}
