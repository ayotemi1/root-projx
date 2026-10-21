import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { CampaignPageView } from "@/components/campaign/campaign-page-view";

/** Owner-only: the real public page rendered from draft data. Payments and share are off. */
export default function CampaignPreviewPage() {
  const params = useParams<{ orgId: string; campId: string }>();
  const { token, user, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();
  const orgId = params.orgId ?? "";
  const campId = params.campId ?? "";
  const recorded = useRef<string | null>(null);
  const [recordState, setRecordState] = useState<"idle" | "saving" | "failed">("idle");
  const uid = user?.id ?? null;
  const isOwner = !!token && !!uid && uid === orgId;

  const q = useQuery({
    queryKey: ["campaign-preview", uid, orgId, campId],
    queryFn: () => api.getCampaignPreview(orgId, campId, token!),
    enabled: isOwner && !!campId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const record = useCallback(() => {
    if (!token) return;
    recorded.current = campId;
    setRecordState("saving");
    api.postWalkthroughEvent(orgId, { event: "campaign_preview", campaignId: campId }, token)
      .then(() => { setRecordState("idle"); return qc.invalidateQueries({ queryKey: ["walkthrough", orgId] }); })
      .catch(() => setRecordState("failed"));
  }, [token, orgId, campId, qc]);

  // Record the real open only after the page actually rendered with data.
  useEffect(() => {
    if (!q.data || !isOwner || recorded.current === campId) return;
    record();
  }, [q.data, isOwner, campId, record]);

  // Never keep a private view cached after sign-out or account switch.
  useEffect(() => {
    if (!isOwner) qc.removeQueries({ queryKey: ["campaign-preview"] });
  }, [isOwner, qc]);

  const backHref = `/dashboard?tab=campaigns&campaign=${encodeURIComponent(campId)}`;

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="sticky top-0 z-50 bg-foreground text-background" role="status" data-testid="banner-draft-preview">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Eye className="w-4 h-4 shrink-0 text-accent" />
          <p className="flex-1 text-sm font-bold">Draft — only you can see this</p>
          <Link href={backHref} className="text-xs font-semibold underline underline-offset-2 inline-flex items-center gap-1" data-testid="link-back-to-editor">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to editor
          </Link>
        </div>
      </div>
      {recordState === "failed" && (
        <div role="alert" className="bg-destructive/10 text-sm px-4 py-2 flex items-center gap-3 max-w-5xl mx-auto" data-testid="alert-preview-record-failed">
          <span className="flex-1">We couldn't record that you previewed this, so the walkthrough can't tick it off yet.</span>
          <Button size="sm" variant="outline" onClick={record} data-testid="button-retry-preview-record">Retry</Button>
        </div>
      )}
      {authLoading ? (
        <div className="max-w-4xl mx-auto px-4 py-10"><Skeleton className="h-64 w-full rounded-3xl" /></div>
      ) : !token || !uid ? (
        <div className="max-w-md mx-auto text-center px-4 py-20" data-testid="state-preview-signin">
          <h1 className="text-xl font-extrabold">Sign in to preview</h1>
          <p className="text-sm text-muted-foreground mt-2">Drafts are only visible to the organisation that owns them.</p>
          <Link href="/login" className="inline-block mt-4 font-bold text-primary underline underline-offset-2">Sign in</Link>
        </div>
      ) : !isOwner ? (
        <div className="max-w-md mx-auto text-center px-4 py-20" data-testid="state-preview-forbidden">
          <AlertCircle className="w-7 h-7 text-primary mx-auto mb-3" />
          <h1 className="text-xl font-extrabold">This isn't your draft</h1>
          <p className="text-sm text-muted-foreground mt-2">Only the organisation that owns this campaign can preview it.</p>
        </div>
      ) : q.isLoading ? (
        <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
          <Skeleton className="h-10 w-3/4" /><Skeleton className="h-64 w-full rounded-3xl" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" />
        </div>
      ) : q.isError || !q.data ? (
        <div className="max-w-md mx-auto text-center px-4 py-20">
          <AlertCircle className="w-7 h-7 text-primary mx-auto mb-3" />
          <h1 className="text-xl font-extrabold">We couldn't open this preview</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {q.error instanceof api.ApiError && (q.error.status === 403 || q.error.status === 404)
              ? "Only the organisation that owns this campaign can preview it."
              : "Check your connection and try again."}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => q.refetch()} data-testid="button-retry-preview">Try again</Button>
        </div>
      ) : (
        <CampaignPageView campaign={q.data.campaign} organisation={q.data.organisation} preview />
      )}
    </div>
  );
}
