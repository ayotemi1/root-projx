import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyPayouts, gbp, myPayoutsKey, payoutDate, PAYOUT_POLICY_TEXT } from "@/lib/payouts-api";

export function PendingPayout({ orgId, token }: { orgId: string; token: string }) {
  const q = useQuery({
    queryKey: myPayoutsKey(orgId),
    queryFn: () => getMyPayouts(token),
    enabled: !!token && !!orgId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });

  return (
    <Card className="border-border shadow-sm" data-testid="section-pending-payout">
      <CardContent className="p-4 space-y-3">
        <p className="font-bold text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> Payouts</p>
        {q.isLoading ? (
          <Skeleton className="h-10 w-full rounded-lg" />
        ) : q.isError || !q.data ? (
          <div className="flex items-start gap-2 rounded-lg border p-3 text-sm bg-destructive/10 border-destructive/30 text-destructive" role="alert">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="flex-1">Couldn't load your payout status.</span>
            <Button size="sm" variant="outline" className="h-7" onClick={() => q.refetch()}>Retry</Button>
          </div>
        ) : (
          <>
            {q.data.payoutMethod === "none" && (
              <div className="flex items-start gap-2 rounded-lg border p-3 text-sm bg-amber-50 border-amber-200 text-amber-800" data-testid="status-payout-method-none">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Choose how you get paid below so Root ProjX can send your donations.</span>
              </div>
            )}
            {q.data.pendingGbp > 0 ? (
              <p className="text-base font-extrabold text-foreground" data-testid="text-pending-payout">
                Pending payout: <span className="text-primary">{gbp(q.data.pendingGbp)}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="text-pending-payout-none">No payout pending right now.</p>
            )}
            <p className="text-sm text-muted-foreground flex items-center gap-1.5" data-testid="text-last-payout">
              <Clock className="w-3.5 h-3.5" />
              {q.data.lastSettled
                ? <>Last paid: <span className="font-semibold text-foreground">{gbp(q.data.lastSettled.amountGbp)}</span> on {payoutDate(q.data.lastSettled.sentAt)}</>
                : "No payouts sent yet."}
            </p>
            <p className="text-[11px] text-muted-foreground">{PAYOUT_POLICY_TEXT}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
