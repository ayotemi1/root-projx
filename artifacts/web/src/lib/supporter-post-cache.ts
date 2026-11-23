import type { QueryClient } from "@tanstack/react-query";
import type { SupporterPostRecord, SupporterShowcase } from "@workspace/api-client-react";

export const SP_KEY = "supporter-posts" as const;

/** Commit an acknowledged save to the owner's lists before background refresh.
 * Cancelling older reads prevents a response started before Share from replacing
 * the confirmed post with an out-of-date list.
 */
export async function cachePublishedPost(qc: QueryClient, post: SupporterPostRecord, token: string) {
  const ownerLists = {
    queryKey: [SP_KEY],
    predicate: (q: { queryKey: readonly unknown[] }) =>
      q.queryKey[3] === token && !q.queryKey[2] &&
      ["mine", "following", "for-you"].includes(String(q.queryKey[1])),
  };
  await qc.cancelQueries(ownerLists);
  qc.setQueriesData<SupporterPostRecord[]>(ownerLists, old =>
    [post, ...(old ?? []).filter(p => p.id !== post.id)]
      .sort((a, b) => b.created_at.localeCompare(a.created_at)));
  // The owner may have opened Create while already on /profile. Navigating
  // back to that same URL won't remount it, so commit there as well.
  const ownerProfile = { queryKey: ["/api/supporter-showcase/me", token] };
  await qc.cancelQueries(ownerProfile);
  qc.setQueryData<SupporterShowcase>(ownerProfile.queryKey, old => old ? {
    ...old,
    posts: [post, ...old.posts.filter(p => p.id !== post.id)]
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    counts: { ...old.counts, posts: old.counts.posts + (old.posts.some(p => p.id === post.id) ? 0 : 1) },
  } : old);
  void qc.invalidateQueries(ownerProfile);
  void qc.invalidateQueries({ queryKey: ["supporter-showcase-public"] });
  void qc.invalidateQueries({ queryKey: [SP_KEY] });
}
