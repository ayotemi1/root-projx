import { useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { PostViewer } from "@/components/post-viewer/PostViewer";
import NotFound from "@/pages/not-found";

/** Direct /posts/:id?kind=update|post link (shared or reloaded): the viewer over a quiet page. */
export default function PostPage() {
  const params = useParams<{ id: string }>();
  const query = new URLSearchParams(useSearch());
  const kind = query.get("kind");
  const [, navigate] = useLocation();
  const [comments, setComments] = useState(query.get("comments") === "1");
  if (!params.id || (kind !== "update" && kind !== "post")) return <NotFound />;
  const close = () => { if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) window.history.back(); else navigate("/feed"); };
  return (
    <div className="min-h-[70dvh]" data-testid="page-post">
      <PostViewer refs={[{ kind, id: params.id }]} index={0} commentsOpen={comments}
        onClose={close} onGo={() => undefined} onComments={setComments} />
    </div>
  );
}
