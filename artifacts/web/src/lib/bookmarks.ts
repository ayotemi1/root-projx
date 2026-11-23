import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listBookmarks, removeBookmark, saveBookmark, type BookmarkInput, type BookmarkView } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { authInit } from "@/components/inbox/use-messaging";

export const GENERIC_ERROR = "Something went wrong, please try again";
export const bookmarksKey = (token: string | null) => ["bookmarks", token] as const;

/** Account-backed bookmarks, private to the signed-in supporter or organisation. */
export function useBookmarks() {
  const { token, user, isAuthenticated } = useAuth();
  const enabled = isAuthenticated && !!token && ["supporter", "organisation"].includes(user?.accountType ?? "");
  const q = useQuery<BookmarkView[]>({
    queryKey: bookmarksKey(token),
    queryFn: ({ signal }) => listBookmarks(authInit(token, signal)),
    enabled,
    staleTime: 30_000,
  });
  return { ...q, enabled };
}

export function useToggleBookmark() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    onMutate: () => qc.cancelQueries({ queryKey: bookmarksKey(token) }),
    mutationFn: async (v: { existing: BookmarkView | null; input?: BookmarkInput }) => {
      if (v.existing) { await removeBookmark(v.existing.id, authInit(token)); return null; }
      return saveBookmark(v.input!, authInit(token));
    },
    onSuccess: (result, v) => {
      // Update from the confirmed server response, not a later background GET.
      qc.setQueryData<BookmarkView[]>(bookmarksKey(token), current => result
        ? [result, ...(current ?? []).filter(b => b.id !== result.id)]
        : (current ?? []).filter(b => b.id !== v.existing!.id));
      void qc.invalidateQueries({ queryKey: bookmarksKey(token) });
      toast({ title: v.existing ? "Removed from Saved" : "Saved", description: v.existing ? undefined : "Only you can see what you've saved." });
    },
    onError: () => toast({ title: GENERIC_ERROR, variant: "destructive" }),
  });
}
