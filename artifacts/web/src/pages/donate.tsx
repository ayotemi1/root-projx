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

const PRESET_AMOUNTS_GBP = [5, 10, 25, 50, 100];

export default function DonatePage() {
  const [, params] = useRoute("/donate/:orgId");
  const orgId = params?.orgId ?? "";
  const { isAuthenticated, token } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const urlParams = new URLSearchParams(search);

  const [preset, setPreset] = useState<number | null>(25);
  const [custom, setCustom] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");

  const orgQ = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId, token),
    enabled: !!orgId,
  });

  const org = orgQ.data;
  const amountGbp = custom ? parseFloat(custom) : (preset ?? 0);
  const amountPence = Math.round(amountGbp * 100);

  const initials = (org?.name ?? "")
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "??";

  // Suppress unused var warning — urlParams used for future next-param handling
  void urlParams;

  async function handleDonate() {
    if (!isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(`/donate/${orgId}`)}`);
      return;
    }
    if (!amountGbp || amountGbp < 1) {
      setError("Please enter an amount of at least £1.");
      return;
    }
    setError("");
    setRedirecting(true);
    try {
      const { url } = await api.createDonationCheckout(
        { orgId, amountPence },
        token!,
      );
      window.location.href = url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not start checkout. Please try again.");
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
                      ? { backgroundColor: "#F5C000", borderColor: "#F5C000" }
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
                    ? { backgroundColor: "#F5C000", borderColor: "#F5C000" }
                    : {}
                }
              >
                Custom
              </button>
            </div>
          </div>

          {/* Custom amount input — only when Custom is selected */}
          {preset === null && (
            <div>
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                Enter amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">£</span>
                <Input
                  type="number"
                  min="1"
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

          {/* Summary */}
          {amountGbp > 0 && (
            <div className="rounded-xl px-4 py-3 text-sm text-center" style={{ backgroundColor: "rgba(245,192,0,0.12)" }}>
              <span className="text-muted-foreground">Donating </span>
              <strong className="text-lg font-extrabold" style={{ color: "#CC0000" }}>
                £{amountGbp.toFixed(2)}
              </strong>
              {org ? (
                <span className="text-muted-foreground"> to {org.name}</span>
              ) : null}
              <div className="text-xs text-muted-foreground mt-1">
                5% platform fee · {((amountGbp * 0.95)).toFixed(2)} goes directly to the org
              </div>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {isAuthenticated ? (
            <Button
              className="w-full font-bold text-base h-12 text-black"
              style={{ backgroundColor: "#F5C000" }}
              onClick={handleDonate}
              disabled={!amountGbp || amountGbp < 1 || redirecting}
            >
              {redirecting
                ? "Redirecting to Stripe…"
                : amountGbp > 0
                ? `Donate £${amountGbp.toFixed(2)} →`
                : "Select an amount"}
            </Button>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-border px-4 py-4 text-center space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Create a free account to complete your donation
              </p>
              <p className="text-xs text-muted-foreground">Takes 30 seconds — no spam, ever.</p>
              <div className="flex gap-2 mt-3">
                <Link href="/register" className="flex-1">
                  <Button
                    className="w-full font-bold text-black text-sm"
                    style={{ backgroundColor: "#F5C000" }}
                  >
                    Create account
                  </Button>
                </Link>
                <Link href={`/login?next=${encodeURIComponent(`/donate/${orgId}`)}`} className="flex-1">
                  <Button variant="outline" className="w-full text-sm font-semibold">
                    Sign in
                  </Button>
                </Link>
              </div>
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
