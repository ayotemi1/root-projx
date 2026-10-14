import { useState } from "react";
import { useRoute, Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";

const PRESET_AMOUNTS_GBP = [3, 5, 10, 25, 50, 100];
const RED = "#CC0000";
const GOLD = "#F5C000";

// Stripe fee estimate — UK card rate (1.5% + £0.20).
// Used for display only; actual fee depends on card type at checkout.
function estimateStripeFeeGbp(amountGbp: number): number {
  return Math.round((amountGbp * 0.015 + 0.20) * 100) / 100;
}

export default function DonatePage() {
  const [, params] = useRoute("/donate/:orgId");
  const orgId = params?.orgId ?? "";
  const { isAuthenticated, token } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const urlParams = new URLSearchParams(search);

  const guestEmail = urlParams.get("email") ?? "";
  const campaignId = urlParams.get("campaign") || undefined;
  const donationPath = `/donate/${orgId}${campaignId ? `?campaign=${encodeURIComponent(campaignId)}` : ""}`;

  const [preset, setPreset] = useState<number | null>(25);
  const [custom, setCustom] = useState("");
  const [feeCovered, setFeeCovered] = useState(true);
  const [wallOptIn, setWallOptIn] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const orgQ = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId, token),
    enabled: !!orgId,
  });

  const org = orgQ.data;
  const originalAmountGbp = custom ? parseFloat(custom) || 0 : (preset ?? 0);
  const originalAmountPence = Math.round(originalAmountGbp * 100);

  const estimatedFeeGbp = originalAmountGbp > 0 ? estimateStripeFeeGbp(originalAmountGbp) : 0;
  const estimatedFeePence = Math.round(estimatedFeeGbp * 100);

  // Gross-up: donor pays original + Stripe fee; org receives full original amount
  const chargedAmountGbp = feeCovered
    ? originalAmountGbp + estimatedFeeGbp
    : originalAmountGbp;
  const chargedAmountPence = feeCovered
    ? originalAmountPence + estimatedFeePence
    : originalAmountPence;

  const initials = (org?.name ?? "")
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "??";

  async function handleDonate() {
    if (!Number.isFinite(originalAmountGbp) || originalAmountGbp < 3) {
      setError("Minimum donation is £3.");
      return;
    }
    if (!isAuthenticated && !guestEmail) {
      setShowAuthPrompt(true);
      return;
    }
    setError("");
    setShowAuthPrompt(false);
    setRedirecting(true);
    try {
      const { url } = await api.createDonationCheckout(
        {
          orgId,
          amountPence: chargedAmountPence,
          campaignId,
          guestEmail: guestEmail || undefined,
          feeCovered,
          originalAmountPence,
          feeAmountPence: feeCovered ? estimatedFeePence : 0,
          wallOptIn: isAuthenticated ? wallOptIn : false,
        },
        token ?? undefined,
      );
      window.location.href = url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not start checkout. Please try again.");
      setRedirecting(false);
    }
  }

  async function handleAnonymousDonate() {
    if (!Number.isFinite(originalAmountGbp) || originalAmountGbp < 3) {
      setError("Minimum donation is £3.");
      return;
    }
    setError("");
    setShowAuthPrompt(false);
    setRedirecting(true);
    try {
      const res = await fetch("/api/donations/anonymous-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          amountPence: chargedAmountPence,
          campaignId,
          feeCovered,
          originalAmountPence,
          feeAmountPence: feeCovered ? estimatedFeePence : 0,
        }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout. Please try again.");
        setRedirecting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error — please check your connection.");
      setRedirecting(false);
    }
  }

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

          {/* Preset amounts */}
          <div>
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
              Choose an amount
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS_GBP.map((amt) => (
                <button
                  key={amt}
                  onClick={() => { setPreset(amt); setCustom(""); setError(""); }}
                  className={`py-3 rounded-lg text-base font-bold border-2 transition-colors ${
                    preset === amt && !custom
                      ? "border-transparent text-black"
                      : "border-border text-foreground hover:border-primary/40"
                  }`}
                  style={
                    preset === amt && !custom
                      ? { backgroundColor: GOLD, borderColor: GOLD }
                      : {}
                  }
                >
                  £{amt}
                </button>
              ))}

              {/* Custom button */}
              <button
                onClick={() => { setPreset(null); setCustom(""); setError(""); }}
                className={`py-3 rounded-lg text-base font-bold border-2 transition-colors ${
                  preset === null && !custom
                    ? "border-transparent text-black"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
                style={
                  preset === null && !custom
                    ? { backgroundColor: GOLD, borderColor: GOLD }
                    : {}
                }
              >
                Custom
              </button>
            </div>
          </div>

          {/* Custom amount input */}
          {preset === null && (
            <div>
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                Enter amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">£</span>
                <Input
                  type="number"
                  min="3"
                  step="0.01"
                  placeholder="0.00"
                  value={custom}
                  autoFocus
                  onChange={(e) => { setCustom(e.target.value); setError(""); }}
                  className="pl-7 text-lg font-bold"
                />
              </div>
            </div>
          )}

          {/* ── Fee coverage toggle ─────────────────────────────────── */}
          {originalAmountGbp > 0 && (
            <div
              className="rounded-xl border-2 p-4 space-y-3 transition-colors"
              style={{
                borderColor: feeCovered ? RED : "#e0d8cc",
                backgroundColor: feeCovered ? "rgba(204,0,0,0.04)" : "transparent",
              }}
            >
              {/* Toggle row */}
              <div className="flex items-start gap-3">
                <button
                  role="switch"
                  aria-checked={feeCovered}
                  onClick={() => setFeeCovered((v) => !v)}
                  className="relative flex-shrink-0 mt-0.5"
                  style={{ width: 44, height: 24 }}
                >
                  <div
                    className="absolute inset-0 rounded-full transition-colors duration-200"
                    style={{ backgroundColor: feeCovered ? RED : "#d1d5db" }}
                  />
                  <div
                    className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                    style={{ transform: feeCovered ? "translateX(22px)" : "translateX(2px)" }}
                  />
                </button>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    Cover transaction fees so 100% of my donation reaches{" "}
                    <span style={{ color: RED }}>{org?.name ?? "the organisation"}</span>
                  </p>
                </div>
              </div>

              {/* Breakdown */}
              <div
                className="rounded-lg px-3 py-2.5 text-sm space-y-1"
                style={{ backgroundColor: feeCovered ? "rgba(204,0,0,0.06)" : "rgba(0,0,0,0.03)" }}
              >
                {feeCovered ? (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Your donation</span>
                      <span>£{originalAmountGbp.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>+ Fee cover (est.)</span>
                      <span>£{estimatedFeeGbp.toFixed(2)}</span>
                    </div>
                    <div
                      className="flex justify-between font-bold pt-1 border-t"
                      style={{ borderColor: "rgba(204,0,0,0.2)", color: RED }}
                    >
                      <span>= Charged to your card</span>
                      <span>£{chargedAmountGbp.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center">
                    <span className="font-semibold" style={{ color: "#92400E" }}>
                      £{estimatedFeeGbp.toFixed(2)}
                    </span>{" "}
                    will be deducted from your donation for transaction fees
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Fee estimate based on UK card rates (1.5% + £0.20). Actual fee may vary by card type.
              </p>
            </div>
          )}

          {/* ── Supporter wall opt-in (authenticated only) ── */}
          {isAuthenticated && originalAmountGbp > 0 && (
            <label
              htmlFor="wall-opt-in"
              className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-secondary/30 transition-colors"
            >
              <input
                type="checkbox"
                id="wall-opt-in"
                checked={wallOptIn}
                onChange={(e) => setWallOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-red-700"
              />
              <div>
                <p className="text-sm font-medium text-foreground leading-snug">
                  Add my name to {org?.name ?? "this organisation"}'s supporter wall
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your first name and last initial will appear on their public profile.
                  You can remove yourself from your account at any time.
                </p>
              </div>
            </label>
          )}

          {/* Summary */}
          {originalAmountGbp > 0 && (
            <div className="rounded-xl px-4 py-3 text-sm text-center" style={{ backgroundColor: "rgba(245,192,0,0.12)" }}>
              {feeCovered ? (
                <>
                  <span className="text-muted-foreground">
                    <strong className="text-lg font-extrabold" style={{ color: RED }}>
                      £{originalAmountGbp.toFixed(2)}
                    </strong>{" "}
                    goes directly to {org?.name ?? "the organisation"}
                  </span>
                  <div className="text-xs text-muted-foreground mt-1">
                    5% platform fee · you cover transaction fees
                  </div>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">Donating </span>
                  <strong className="text-lg font-extrabold" style={{ color: RED }}>
                    £{originalAmountGbp.toFixed(2)}
                  </strong>
                  {org ? <span className="text-muted-foreground"> to {org.name}</span> : null}
                  <div className="text-xs text-muted-foreground mt-1">
                    5% platform fee · £{(originalAmountGbp * 0.95 - estimatedFeeGbp).toFixed(2)} goes directly to the org
                  </div>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {/* Donate button */}
          <Button
            className="w-full font-bold text-base h-12 text-black"
            style={{ backgroundColor: GOLD }}
            onClick={handleDonate}
            disabled={!Number.isFinite(originalAmountGbp) || originalAmountGbp < 3 || redirecting}
          >
            {redirecting
              ? "Redirecting to Stripe…"
              : originalAmountGbp > 0
              ? `Donate £${chargedAmountGbp.toFixed(2)} →`
              : "Select an amount"}
          </Button>

          {/* Inline auth prompt */}
          {showAuthPrompt && (
            <div className="rounded-xl border-2 border-border px-4 py-4 text-center space-y-2 animate-in fade-in">
              <p className="text-sm font-semibold text-foreground">
                Create a free account to complete your donation
              </p>
              <p className="text-xs text-muted-foreground">Takes 30 seconds — no spam, ever.</p>
              <div className="flex gap-2 mt-3">
                <Link
                  href={`/register?${guestEmail ? `email=${encodeURIComponent(guestEmail)}&` : ""}next=${encodeURIComponent(donationPath)}`}
                  className="flex-1"
                >
                  <Button
                    className="w-full font-bold text-black text-sm"
                    style={{ backgroundColor: GOLD }}
                  >
                    Create account
                  </Button>
                </Link>
                <Link href={`/login?next=${encodeURIComponent(donationPath)}`} className="flex-1">
                  <Button variant="outline" className="w-full text-sm font-semibold">
                    Sign in
                  </Button>
                </Link>
              </div>
              <button
                onClick={handleAnonymousDonate}
                disabled={redirecting}
                className="w-full text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors mt-1 disabled:opacity-50"
              >
                {redirecting ? "Redirecting…" : "Donate anonymously — no account needed"}
              </button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Secured by Stripe · Payments go directly to the organisation
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
