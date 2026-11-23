import { Bookmark } from "lucide-react";
import type { BookmarkInputKind } from "@workspace/api-client-react";
import { useBookmarks, useToggleBookmark } from "@/lib/bookmarks";

/** Save/unsave toggle. Renders nothing for accounts that cannot bookmark (signed out, organisations). */
export function BookmarkButton({ kind, targetId, orgId, className = "", label = false, unstyled = false }: {
  kind: BookmarkInputKind; targetId: string; orgId?: string | null; className?: string; label?: boolean; unstyled?: boolean;
}) {
  const q = useBookmarks();
  const toggle = useToggleBookmark();
  if (!q.enabled) return null;
  const campaignOrg = kind === "campaign" ? orgId ?? null : null;
  const existing = q.data?.find(b => b.kind === kind && b.targetId === targetId && (kind !== "campaign" || !campaignOrg || b.orgId === campaignOrg)) ?? null;
  const saved = !!existing;
  return (
    <button type="button" aria-pressed={saved} aria-label={saved ? "Remove from Saved" : "Save"}
      disabled={q.isLoading || toggle.isPending}
      onClick={() => toggle.mutate({ existing, input: { kind, targetId, ...(campaignOrg ? { orgId: campaignOrg } : {}) } })}
      className={unstyled ? className : `min-h-11 min-w-11 inline-flex items-center justify-center gap-1.5 text-[#17100F]/80 hover:text-[#17100F] disabled:opacity-50 ${className}`}
      data-testid={`button-bookmark-${kind}-${targetId}`}>
      <Bookmark className={`w-[18px] h-[18px] ${saved ? "fill-current" : ""}`} aria-hidden />
      {label && <span className="text-[14px] font-semibold">{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}
