import { useState, useEffect, useCallback } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, RefreshCcw } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";

const PRESET_AMOUNTS = [10, 25, 50, 100];

// ── Stripe singleton (lazily resolved once we have the publishable key) ─────────
let stripePromise: ReturnType<typeof loadStripe> | null = null;

function getStripe(publishableKey: string) {
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

// ── Inner payment form (inside Elements context) ──────────────────────────────
function PaymentForm({
  orgName,
  amountGbp,
  donationType,
  onSuccess,
}: {
  orgName: string;
  amountGbp: number;
  donationType: "one_time" | "recurring";
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setStatus("submitting");
    setErrorMsg("");

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/account`,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMsg(error.message ?? "Payment failed.");
      setStatus("error");
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-secondary rounded-lg px-4 py-3 text-sm text-center">
        <span className="text-muted-foreground">Donating </span>
        <strong className="text-primary text-base">£{amountGbp.toFixed(2)}</strong>
        {donationType === "recurring" && (
          <span className="text-muted-foreground"> / month</span>
        )}
        <span className="text-muted-foreground"> to {orgName}</span>
      </div>

      <PaymentElement
        options={{
          layout: "tabs",
          fields: { billingDetails: { address: "never" } },
        }}
      />

      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md px-3 py-2 text-sm">
          {errorMsg}
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || status === "submitting"}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-base h-12"
      >
        {status === "submitting"
          ? "Processing…"
          : donationType === "recurring"
          ? `Start £${amountGbp.toFixed(2)}/month`
          : `Donate £${amountGbp.toFixed(2)}`}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Secured by Stripe · Platform fee {process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "3"}% helps run Root ProjX
      </p>
    </form>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({
  orgName,
  orgId,
  amountGbp,
  donationType,
}: {
  orgName: string;
  orgId: string;
  amountGbp: number;
  donationType: "one_time" | "recurring";
}) {
  return (
    <div className="text-center py-12 px-4">
      <div className="w-20 h-20 rounded-full bg-green-100 border-2 border-green-300 flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-2xl font-extrabold text-foreground mb-3">Thank you!</h2>
      <p className="text-muted-foreground text-base mb-1">
        Your {donationType === "recurring" ? "monthly " : ""}donation of{" "}
        <strong className="text-foreground">£{amountGbp.toFixed(2)}</strong>{" "}
        to <strong className="text-foreground">{orgName}</strong> was successful.
      </p>
      {donationType === "recurring" && (
        <p className="text-muted-foreground text-sm mt-1 mb-6">
          You'll be charged monthly. You can cancel anytime from your account.
        </p>
      )}
      <p className="text-muted-foreground text-sm mb-6">
        You are now following this organisation and will see their updates in your feed.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href={`/organisations/${orgId}`}>
          <Button variant="outline">Back to Organisation</Button>
        </Link>
        <Link href="/account">
          <Button>View Account</Button>
        </Link>
      </div>
    </div>
  );
}

// ── Main donate page ──────────────────────────────────────────────────────────
export default function DonatePage() {
  const [, params] = useRoute("/donate/:orgId");
  const orgId = params?.orgId ?? "";
  const { isAuthenticated, token } = useAuth();
  const [, navigate] = useLocation();

  const [preset, setPreset] = useState<number | null>(25);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [donationType, setDonationType] = useState<"one_time" | "recurring">("one_time");
  const [step, setStep] = useState<"select" | "pay" | "success">("select");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const orgQ = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId, token),
    enabled: !!orgId,
  });

  // Fetch publishable key on mount
  useEffect(() => {
    api.getStripePublishableKey()
      .then((r) => setPublishableKey(r.publishableKey))
      .catch(() => { /* handled inline */ });
  }, []);

  const org = orgQ.data;
  const amount = custom ? parseFloat(custom) : (preset ?? 0);
  const initials = (org?.name ?? "")
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "??";

  async function handleProceedToPayment() {
    if (!isAuthenticated) { navigate("/login"); return; }
    if (!amount || amount <= 0) return;
    setCreating(true);
    setCreateError("");
    try {
      let secret: string;
      if (donationType === "one_time") {
        const res = await api.createPaymentIntent(
          { orgId, amountGbp: amount, note: note.trim() || undefined },
          token!,
        );
        secret = res.clientSecret;
      } else {
        const res = await api.createSubscription(
          { orgId, amountGbp: amount, note: note.trim() || undefined },
          token!,
        );
        secret = res.clientSecret;
      }
      setClientSecret(secret);
      setStep("pay");
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Could not initiate payment.");
    } finally {
      setCreating(false);
    }
  }

  // ── Select amount screen ───────────────────────────────────────────────────
  if (step === "select") {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <Link href={`/organisations/${orgId}`}>
          <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Organisation
          </button>
        </Link>

        {/* Org banner */}
        <div className="bg-nav rounded-2xl px-6 py-5 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-lg font-extrabold flex-shrink-0">
            {initials}
          </div>
          <div>
            <h2 className="text-white font-bold text-base">{org?.name ?? "Loading…"}</h2>
            {org && (
              <p className="text-white/60 text-sm">
                {[org.city, org.country].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Make a Donation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Donation type */}
            <div>
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                Frequency
              </Label>
              <div className="flex gap-2">
                {(["one_time", "recurring"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setDonationType(t)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold border-2 transition-colors ${
                      donationType === t
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {t === "one_time" ? "One-time" : "Monthly"}
                  </button>
                ))}
              </div>
            </div>

            {/* Preset amounts */}
            <div>
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                Amount (GBP)
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => { setPreset(amt); setCustom(""); }}
                    className={`py-3 rounded-lg text-base font-bold border-2 transition-colors ${
                      preset === amt && !custom
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-foreground hover:border-primary/40"
                    }`}
                  >
                    £{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom amount */}
            <div>
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                Custom amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">£</span>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={custom}
                  onChange={(e) => { setCustom(e.target.value); if (e.target.value) setPreset(null); }}
                  className="pl-7 text-lg font-bold"
                />
              </div>
            </div>

            {/* Note */}
            <div>
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                Message of support <span className="font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="A message to this organisation…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>

            {/* Summary */}
            {amount > 0 && (
              <div className="bg-secondary rounded-lg p-4 text-sm text-center">
                You are donating{" "}
                <strong className="text-primary text-base">£{amount.toFixed(2)}</strong>
                {donationType === "recurring" && <span className="text-muted-foreground"> / month</span>}
                {org ? ` to ${org.name}` : ""}
              </div>
            )}

            {createError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md px-3 py-2 text-sm">
                {createError}
              </div>
            )}

            <Button
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-base h-12"
              onClick={handleProceedToPayment}
              disabled={!amount || amount <= 0 || creating}
            >
              {creating
                ? "Preparing…"
                : amount > 0
                ? `Continue to payment → £${amount.toFixed(2)}`
                : "Select an amount"}
            </Button>

            {!isAuthenticated && (
              <p className="text-center text-sm text-muted-foreground">
                You'll need to{" "}
                <Link href="/login" className="text-primary font-semibold hover:underline">
                  sign in
                </Link>{" "}
                to complete your donation.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Payment screen ─────────────────────────────────────────────────────────
  if (step === "pay" && clientSecret && publishableKey) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <button
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors"
          onClick={() => { setStep("select"); setClientSecret(null); }}
        >
          <ArrowLeft className="w-4 h-4" /> Change amount
        </button>

        <div className="bg-nav rounded-2xl px-6 py-5 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-lg font-extrabold flex-shrink-0">
            {initials}
          </div>
          <div>
            <h2 className="text-white font-bold text-base">{org?.name}</h2>
            <p className="text-white/60 text-sm">Secure payment via Stripe</p>
          </div>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Elements
              stripe={getStripe(publishableKey)}
              options={{
                clientSecret,
                appearance: {
                  theme: "stripe",
                  variables: {
                    colorPrimary: "#B50000",
                    colorBackground: "#ffffff",
                    fontFamily: "Inter, system-ui, sans-serif",
                  },
                },
              }}
            >
              <PaymentForm
                orgName={org?.name ?? ""}
                amountGbp={amount}
                donationType={donationType}
                onSuccess={() => setStep("success")}
              />
            </Elements>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="max-w-lg mx-auto">
        <SuccessScreen
          orgName={org?.name ?? ""}
          orgId={orgId}
          amountGbp={amount}
          donationType={donationType}
        />
      </div>
    );
  }

  // ── Loading / error state ──────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <RefreshCcw className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground">Connecting to payment provider…</p>
    </div>
  );
}
