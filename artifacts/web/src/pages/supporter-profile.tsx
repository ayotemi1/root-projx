import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { fetchVisitorShowcase, visitorShowcaseKey } from "@/lib/supporter-showcase";
import { SupporterShowcaseView, type ShowcaseMode } from "@/components/supporter/profile/SupporterShowcaseView";
import { HiddenProfile, ShowcaseError, ShowcaseSkeleton } from "@/components/supporter/profile/ShowcaseStates";

const isNotFound = (e: unknown) => {
  const s = (e as { status?: number } | null)?.status;
  return s === 404 || s === 403;
};

/** Public projection, used for visitors and for the owner's Preview. Never authenticated. */
export function VisitorShowcase({ publicId, preview, onExitPreview }: { publicId: string; preview?: boolean; onExitPreview?: () => void }) {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: visitorShowcaseKey(publicId),
    queryFn: () => fetchVisitorShowcase(publicId),
    retry: (n, e) => !isNotFound(e) && n < 1,
    staleTime: preview ? 0 : 60_000,
  });
  if (q.isLoading) return <ShowcaseSkeleton />;
  if (q.isError) return isNotFound(q.error) ? <HiddenProfile preview={preview} onExitPreview={onExitPreview} /> : <ShowcaseError onRetry={() => q.refetch()} />;
  if (!q.data || !q.data.isPublic) return <HiddenProfile preview={preview} onExitPreview={onExitPreview} />;
  const mode: ShowcaseMode = preview ? "preview" : "visitor";
  return <SupporterShowcaseView showcase={{ ...q.data, isOwner: false }} mode={mode} token={token} onExitPreview={onExitPreview} />;
}

export default function SupporterProfilePage() {
  const { publicId } = useParams();
  if (!publicId) return <HiddenProfile />;
  return <VisitorShowcase publicId={publicId} />;
}
