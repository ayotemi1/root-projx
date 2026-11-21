import type { QueryClient } from "@tanstack/react-query";
import type { SupporterPostRecord } from "@workspace/api-client-react";

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
  void qc.invalidateQueries({ queryKey: [SP_KEY] });
}
