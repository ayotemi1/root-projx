import { userErrorMessage } from "@/lib/error-feedback";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Banknote, CheckCircle, Clock, ExternalLink, Landmark, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api";
import { myPayoutsKey } from "@/lib/payouts-api";
import { openStripeOnboardingTab } from "@/lib/stripe-onboarding-tab";
import { WiseLastPayout } from "@/components/wise-last-payout";
import { BankDetailsOwner, bankDetailsStatusKey, fetchBankDetailsStatus } from "@/components/bank-details-owner";
import type { PayoutMethod, PayoutSetup as PayoutSetupData, WiseStatus } from "@/lib/api";

export const BANK_APPROVED_TEXT = "Set up: bank transfer. Root ProjX has verified your bank details.";

type Tone = "ready" | "pending" | "error" | "none";

const TONE: Record<Tone, string> = {
  ready: "bg-green-50 border-green-200 text-green-800",
  pending: "bg-amber-50 border-amber-200 text-amber-800",
  error: "bg-destructive/10 border-destructive/30 text-destructive",
  none: "bg-secondary border-border text-foreground",
};

function ToneIcon({ tone }: { tone: Tone }) {
  if (tone === "ready") return <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />;
  if (tone === "pending") return <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />;
  return <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />;
}

export function PayoutSetup({
  orgId,
  token,
  totalRaised,
  connectComplete,
}: {
  orgId: string;
  token: string;
  totalRaised: number;
  connectComplete: boolean;
}) {
  const queryClient = useQueryClient();
  const [selectError, setSelectError] = useState("");
  const [stripeError, setStripeError] = useState("");
  const [stripeStarting, setStripeStarting] = useState(false);
  const refreshingStripe = useRef(false);
  const [wiseEmailInput, setWiseEmailInput] = useState("");
  const [wiseError, setWiseError] = useState("");
  const [showWiseInput, setShowWiseInput] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!token || url.searchParams.get("connect") !== "refresh" || refreshingStripe.current) return;
    refreshingStripe.current = true;
    // Consume the marker before requesting: a rejected preview must show the
    // actual error and stop, not enter an automatic redirect/retry loop.
    url.searchParams.delete("connect");
    window.history.replaceState(window.history.state, "", url.toString());
    setStripeError("");
    setStripeStarting(true);
    api.startConnectOnboarding(token).then(({ url }) => window.location.assign(url)).catch((error: Error) => {
      setStripeError(userErrorMessage(error, "start Stripe onboarding"));
      setStripeStarting(false);
    });
  }, [token]);

  const setupQ = useQuery({
    queryKey: ["payout-setup", orgId],
    queryFn: () => api.getPayoutSetup(token),
    enabled: !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  const connectQ = useQuery({
    queryKey: ["connect-status", orgId],
    queryFn: () => api.getConnectStatus(token),
    enabled: !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const wiseQ = useQuery({
    queryKey: ["wise-status", orgId],
    queryFn: () => api.getWiseStatus(token),
    enabled: !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const bankQ = useQuery({
    queryKey: bankDetailsStatusKey(orgId),
    queryFn: () => fetchBankDetailsStatus(token),
    enabled: !!token && setupQ.data?.method === "bank_transfer",
    staleTime: 0,
  });
  const bankStatus = bankQ.data;

  const refetchConnect = connectQ.refetch;
  useEffect(() => {
    if (connectComplete) refetchConnect();
  }, [connectComplete, refetchConnect]);

  const selectMut = useMutation({
    mutationFn: (method: PayoutMethod) => api.selectPayoutMethod(method, token),
    onSuccess: (data: PayoutSetupData) => {
      setSelectError("");
      queryClient.setQueryData(["payout-setup", orgId], data);
      queryClient.invalidateQueries({ queryKey: ["payout-setup", orgId] });
      queryClient.invalidateQueries({ queryKey: myPayoutsKey(orgId) });
    },
    onError: (e: Error) => setSelectError(userErrorMessage(e, "change your payout method")),
  });

  const wiseConnectMut = useMutation({
    mutationFn: (email: string) => api.connectWise(email, token),
    onSuccess: (data: WiseStatus) => {
      setWiseError("");
      setWiseEmailInput(data.wise_email ?? "");
      setShowWiseInput(false);
      queryClient.invalidateQueries({ queryKey: ["wise-status", orgId] });
    },
    onError: (e: Error) => setWiseError(userErrorMessage(e, "connect your Wise account")),
  });

  const wiseDisconnectMut = useMutation({
    mutationFn: () => api.disconnectWise(token),
    onSuccess: () => {
      setWiseEmailInput("");
      setWiseError("");
      queryClient.invalidateQueries({ queryKey: ["wise-status", orgId] });
    },
    onError: (e: Error) => setWiseError(userErrorMessage(e, "disconnect your Wise account")),
  });

  async function startStripe() {
    setStripeError("");
    setStripeStarting(true);
    try {
      await openStripeOnboardingTab(() => api.startConnectOnboarding(token));
    } catch (e) {
      setStripeError(userErrorMessage(e, "start Stripe onboarding"));
    } finally {
      setStripeStarting(false);
    }
  }

  async function openStripeDashboard() {
    setStripeError("");
    try {
      const { url } = await api.getConnectDashboardLink(token);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setStripeError("Could not open Stripe dashboard. Please try again.");
    }
  }

  const setup = setupQ.data;
  const method = setup?.method ?? null;
  const stripe = connectQ.data;
  const wise = wiseQ.data;

  // Plain-words current status
  let tone: Tone = "none";
  let statusText = "You haven't chosen how you get paid yet. Choose one option below.";
  if (method === "stripe") {
    if (connectQ.isError) { tone = "error"; statusText = "Current method: Stripe. We couldn't check your Stripe status right now."; }
    else if (stripe?.payouts_enabled) { tone = "ready"; statusText = "Current method: Stripe. Payouts are enabled."; }
    else if (stripe?.stripe_account_id) { tone = "pending"; statusText = "Current method: Stripe. Finish Stripe onboarding to enable payouts."; }
    else { tone = "pending"; statusText = "Current method: Stripe. Connect your Stripe account to finish setup."; }
  } else if (method === "wise") {
    if (wiseQ.isError) { tone = "error"; statusText = "Current method: Wise. We couldn't check your Wise status right now."; }
    else if (wise?.wise_verified) { tone = "ready"; statusText = `Current method: Wise (${wise.wise_email}). Connected and verified.`; }
    else if (wise?.wise_email) { tone = "pending"; statusText = `Current method: Wise (${wise.wise_email}). Pending verification.`; }
    else { tone = "pending"; statusText = "Current method: Wise. Add your Wise account email to finish setup."; }
  } else if (method === "bank_transfer") {
    if (bankQ.isError) { tone = "error"; statusText = "Current method: bank transfer. Your bank detail status is unavailable. Please retry below."; }
    else if (bankStatus && !bankStatus.hasDetails) { tone = "pending"; statusText = "Current method: bank transfer. Add your bank details below so Root ProjX can pay you."; }
    else if (setup?.payoutManualApproved && bankStatus?.hasDetails && bankStatus.approved) { tone = "ready"; statusText = BANK_APPROVED_TEXT; }
    else if (bankStatus?.hasDetails) { tone = "pending"; statusText = "Current method: bank transfer. Your bank details are saved and awaiting review by Root ProjX."; }
    else { tone = "pending"; statusText = "Current method: bank transfer. Checking your bank details status."; }
  }

  function optionShell(m: PayoutMethod, title: string, icon: React.ReactNode, body: React.ReactNode, selectLabel: string) {
    const active = method === m;
    return (
      <div
        data-testid={`card-payout-${m}`}
        className={`rounded-xl border-2 p-4 flex flex-col gap-3 transition-colors ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-sm flex items-center gap-2">{icon}{title}</p>
          {active && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary text-primary-foreground" data-testid={`badge-active-${m}`}>
              Active
            </span>
          )}
        </div>
        <div className="flex-1 space-y-3">{body}</div>
        {!active && (
          <Button
            variant="outline"
            className="w-full font-semibold whitespace-normal h-auto py-2"
            disabled={selectMut.isPending || setupQ.isLoading || setupQ.isError || stripeStarting || wiseConnectMut.isPending || wiseDisconnectMut.isPending}
            onClick={() => selectMut.mutate(m)}
            data-testid={`button-select-${m}`}
          >
            {selectMut.isPending && selectMut.variables === m ? "Saving…" : selectLabel}
          </Button>
        )}
      </div>
    );
  }

  const stripeBody = method !== "stripe" ? (
    <p className="text-xs text-muted-foreground">Choose Stripe to connect or manage your Stripe account.</p>
  ) : connectQ.isLoading ? (
    <Skeleton className="h-16 w-full rounded-lg" />
  ) : connectQ.isError ? (
    <p className="text-xs text-destructive">{userErrorMessage(connectQ.error, "load your Stripe connection status")}</p>
  ) : stripe?.payouts_enabled ? (
    <>
      <p className="text-sm font-semibold text-green-700 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Payouts enabled</p>
      <div className="bg-secondary rounded-lg p-3 text-center border border-border/50">
        <div className="text-lg font-extrabold">£{totalRaised.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">Donations given to you, all time (before fees)</div>
      </div>
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={openStripeDashboard} data-testid="button-stripe-dashboard">
        <ExternalLink className="w-4 h-4" /> View Stripe dashboard
      </Button>
    </>
  ) : (
    <>
      <p className="text-xs text-muted-foreground">
        {stripe?.stripe_account_id ? "Finish setting up your Stripe account to receive donations." : "Connect a Stripe account to receive donations directly."}
      </p>
      <Button size="sm" className="w-full font-bold" onClick={startStripe} disabled={stripeStarting} data-testid="button-stripe-onboard">
        {stripeStarting ? "Opening Stripe…" : stripe?.stripe_account_id ? "Continue Stripe setup" : "Connect with Stripe"}
        <ExternalLink className="w-3.5 h-3.5 ml-1.5" aria-hidden="true" />
      </Button>
      <p className="text-xs text-muted-foreground">Opens in a new tab. Your dashboard stays open.</p>
    </>
  );

  const wiseBody = method !== "wise" ? (
    <p className="text-xs text-muted-foreground">Choose Wise to add or manage your verified Wise email.</p>
  ) : wiseQ.isLoading ? (
    <Skeleton className="h-16 w-full rounded-lg" />
  ) : wiseQ.isError ? (
    <p className="text-xs text-destructive">{userErrorMessage(wiseQ.error, "load your Wise connection status")}</p>
  ) : wise?.wise_email && !showWiseInput ? (
    <>
      <p className={`text-sm font-semibold flex items-center gap-1.5 ${wise.wise_verified ? "text-green-700" : "text-amber-700"}`}>
        {wise.wise_verified ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
        {wise.wise_verified ? "Connected & verified" : "Saved (pending verification)"}
      </p>
      <p className="text-sm font-semibold truncate" data-testid="text-wise-email">{wise.wise_email}</p>
      <WiseLastPayout status={wise} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => { setWiseEmailInput(wise.wise_email ?? ""); setShowWiseInput(true); }} data-testid="button-wise-change">Change</Button>
        <Button variant="outline" size="sm" className="flex-1 text-destructive" disabled={wiseDisconnectMut.isPending} onClick={() => wiseDisconnectMut.mutate()} data-testid="button-wise-disconnect">
          {wiseDisconnectMut.isPending ? "Disconnecting…" : "Disconnect"}
        </Button>
      </div>
    </>
  ) : !showWiseInput ? (
    <>
      <p className="text-xs text-muted-foreground">Connect your Wise account so Root ProjX can send your funds internationally.</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open("https://wise.com/register", "_blank", "noopener,noreferrer")} data-testid="button-wise-signup">Sign up</Button>
        <Button size="sm" className="flex-1" onClick={() => setShowWiseInput(true)} data-testid="button-wise-have-account">I have Wise</Button>
      </div>
    </>
  ) : (
    <div className="space-y-2">
      <Label htmlFor="wise-email" className="text-xs font-semibold">Wise email</Label>
      <Input id="wise-email" type="email" placeholder="you@yourorg.com" value={wiseEmailInput}
        onChange={(e) => { setWiseEmailInput(e.target.value); setWiseError(""); }}
        disabled={wiseConnectMut.isPending} data-testid="input-wise-email" />
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" disabled={!wiseEmailInput.trim() || wiseConnectMut.isPending} onClick={() => wiseConnectMut.mutate(wiseEmailInput.trim())} data-testid="button-wise-connect">
          {wiseConnectMut.isPending ? "Connecting…" : "Connect"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setShowWiseInput(false); setWiseError(""); }} disabled={wiseConnectMut.isPending}>Cancel</Button>
      </div>
    </div>
  );

  const bankBody = method === "bank_transfer" ? (
    <BankDetailsOwner key={orgId} orgId={orgId} token={token} />
  ) : (
    <p className="text-xs text-muted-foreground">
      Choose bank transfer to securely add your bank account details for Root ProjX to review.
    </p>
  );

  return (
    <Card className="border-border shadow-sm overflow-hidden" data-testid="section-payout-setup">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Banknote className="w-4 h-4 text-primary" /> How you get paid</span>
          <button onClick={() => { setupQ.refetch(); connectQ.refetch(); wiseQ.refetch(); }} className="text-muted-foreground hover:text-primary" aria-label="Refresh payout status" data-testid="button-refresh-payout">
            <RefreshCw className={`w-4 h-4 ${setupQ.isFetching ? "animate-spin" : ""}`} />
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {setupQ.isLoading ? (
          <Skeleton className="h-12 w-full rounded-lg" />
        ) : setupQ.isError ? (
          <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${TONE.error}`} data-testid="status-payout-error">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="flex-1">{userErrorMessage(setupQ.error, "load your payout setup")}</span>
            <Button size="sm" variant="outline" className="h-7" onClick={() => setupQ.refetch()}>Retry</Button>
          </div>
        ) : (
          <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm font-medium ${TONE[tone]}`} data-testid="status-payout-method">
            <ToneIcon tone={tone} />
            <span>{statusText}</span>
          </div>
        )}

        {selectError && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md" role="alert" data-testid="error-payout-select">{selectError}</p>
        )}
        {(stripeError || wiseError) && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md" role="alert">{stripeError || wiseError}</p>
        )}

        <p className="text-xs text-muted-foreground">Only one method is active at a time. Switching keeps your existing Stripe or Wise connection saved.</p>

        <div className="grid md:grid-cols-3 gap-3">
          {optionShell("stripe", "Stripe", <Banknote className="w-4 h-4 text-primary" />, <>
            {stripeBody}
            <p className="text-[11px] text-muted-foreground">Stripe payouts are available in some countries only.</p>
          </>, "Use Stripe")}
          {optionShell("wise", "Wise", <Banknote className="w-4 h-4 text-primary" />, wiseBody, "Use Wise")}
          {optionShell("bank_transfer", "Bank transfer", <Landmark className="w-4 h-4 text-primary" />, bankBody, "I'll receive payments by bank transfer")}
        </div>
      </CardContent>
    </Card>
  );
}
