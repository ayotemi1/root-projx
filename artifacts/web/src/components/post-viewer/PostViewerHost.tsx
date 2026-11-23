import { usePostViewer } from "./PostViewerProvider";
import { PostViewer } from "./PostViewer";

/** Renders the open viewer above whatever page is kept mounted behind it. */
export function PostViewerHost() {
  const { session, close, go, setComments } = usePostViewer();
  if (!session) return null;
  return (
    <PostViewer refs={session.refs} index={session.index} label={session.label} commentsOpen={session.comments}
      onClose={close} onGo={go} onComments={setComments} />
  );
}
