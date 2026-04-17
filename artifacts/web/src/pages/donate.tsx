import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";

const PRESET_AMOUNTS = [10, 25, 50, 100];

export default function DonatePage() {
  const [, params] = useRoute("/donate/:orgId");
  const orgId = params?.orgId ?? "";
  const { isAuthenticated, token } = useAuth();

  const [preset, setPreset] = useState<number | null>(25);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const orgQ = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId, token),
    enabled: !!orgId,
  });

  const org = orgQ.data;
  const amount = custom ? parseFloat(custom) : (preset ?? 0);

  function handleDonate() {
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }
    if (!amount || amount <= 0) return;
    setShowSuccess(true);
  }

  if (showSuccess) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center mx-auto mb-6">
          <CreditCard className="w-10 h-10 text-accent-foreground" />
        </div>
        <h1 className="text-2xl font-extrabold text-foreground mb-3">Stripe — Coming Soon</h1>
        <p className="text-muted-foreground mb-6">
          Your donation of <strong className="text-foreground">£{amount.toFixed(2)}</strong>{" "}
          to <strong className="text-foreground">{org?.name}</strong> will be processed securely
          once the Stripe integration is complete (Step 9).
        </p>
        <Link href={`/organisations/${orgId}`}>
          <Button variant="outline">Back to Organisation</Button>
        </Link>
      </div>
    );
  }

  const initials =
    (org?.name ?? "").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "??";

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Back */}
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
              Choose amount (GBP)
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
              Or enter a custom amount
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                £
              </span>
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
            <div className="bg-secondary rounded-lg p-4 text-sm text-center text-foreground">
              You are donating{" "}
              <strong className="text-primary text-base">£{amount.toFixed(2)}</strong>
              {org ? ` to ${org.name}` : ""}
            </div>
          )}

          {/* Stripe notice */}
          <div className="bg-accent/10 border border-accent/20 rounded-lg px-4 py-3 text-sm text-center text-accent-foreground">
            💳 Secure payments powered by Stripe — coming soon (Step 9)
          </div>

          <Button
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-base h-12"
            onClick={handleDonate}
            disabled={!amount || amount <= 0}
          >
            {amount > 0 ? `Donate £${amount.toFixed(2)}` : "Select an amount"}
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
