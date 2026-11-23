import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Archive, Play } from "lucide-react";
import { listArchivedPosts } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { OwnPostActions } from "@/components/post-management/OwnPostActions";
import { usePostViewer } from "@/components/post-viewer/PostViewerProvider";

export default function ArchivedPostsPage() {
  const { token, user } = useAuth();
  const viewer = usePostViewer();
  const q = useQuery({
    queryKey: ["owner-post-archived", user?.id, token],
    enabled: !!token,
    queryFn: () => listArchivedPosts({ headers: { Authorization: `Bearer ${token}` } }),
  });
  const posts = q.data ?? [];
  const refs = posts.map(p => ({ kind: p.kind as "post" | "update", id: p.id }));
  return <main className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-8 sm:py-12" data-testid="archived-posts">
    <Link href="/profile" className="text-sm underline underline-offset-4">Back to profile</Link>
    <p className="mt-8 text-[10px] font-mono uppercase tracking-[.18em]">Only you</p>
    <h1 className="font-display text-4xl uppercase sm:text-5xl">Archived</h1>
    <p className="mt-2 mb-7 max-w-xl text-sm text-[#17100F]/70">Only you can see these posts. Show a post on your profile to bring it back with its likes and comments.</p>
    {q.isLoading ? <p role="status">Loading archived posts…</p> : q.isError ? <div role="alert">
      <p>We couldn’t load your archived posts.</p><button type="button" onClick={() => void q.refetch()} className="mt-3 border border-[#17100F] bg-white px-4 py-2">Try again</button>
    </div> : posts.length === 0 ? <div className="border border-[#17100F]/30 p-8 text-center">
      <Archive className="mx-auto mb-3" aria-hidden /><h2 className="font-bold">No archived posts</h2>
      <p className="mt-2 text-sm">Posts you archive will appear here.</p>
    </div> : <div className="grid grid-cols-3 gap-[2px]" data-testid="archived-grid">
      {posts.map((p, index) => {
        const cover = p.coverUrl || p.media.find(m => m.thumbnailUrl)?.thumbnailUrl || p.media.find(m => m.type === "photo")?.url;
        return <article key={`${p.kind}:${p.id}`} className="relative aspect-[4/5] overflow-hidden border border-[#17100F]/20 bg-white" data-testid={`archived-${p.id}`}>
          <button type="button" className="absolute inset-0 h-full w-full text-left" onClick={e => viewer.open({ refs, index, label: "Archived", trigger: e.currentTarget })} aria-label={`Open archived post: ${p.caption.slice(0, 100) || "Post"}`}>
            {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <p className="p-3 text-sm sm:p-5 sm:text-lg">{p.caption || "Post"}</p>}
            {p.media.some(m => m.type === "video") && <Play size={17} fill="white" className="absolute left-2 top-2 text-white drop-shadow" aria-hidden />}
          </button>
          <div className="absolute right-1 top-1 bg-white/95"><OwnPostActions postRef={refs[index]} owner /></div>
        </article>;
      })}
    </div>}
  </main>;
}
