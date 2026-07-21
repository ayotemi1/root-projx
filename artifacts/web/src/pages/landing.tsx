import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, X, Heart } from "lucide-react";

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

interface Org {
  _id: string;
  name: string;
  country: string;
  category: string;
}

// ── Donate modal ──────────────────────────────────────────────────────────────

function DonateModal({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"org" | "amount">("org");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);
  const [preset, setPreset] = useState<number>(25);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const amountGbp = custom ? parseFloat(custom) : preset;
  const amountPence = Math.round((amountGbp || 0) * 100);

  useEffect(() => {
    fetch("/api/organisations")
      .then((r) => r.json())
      .then((data: Org[]) => {
        setOrgs(Array.isArray(data) ? data.slice(0, 20) : []);
      })
      .catch(() => setOrgs([]))
      .finally(() => setOrgsLoading(false));
  }, []);

  async function handleDonate() {
    if (!selectedOrg || amountPence < 100) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/donations/anonymous-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: selectedOrg._id, amountPence }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#fff", borderRadius: "20px 20px 0 0", width: "100%",
          maxWidth: 480, maxHeight: "90vh", overflowY: "auto",
          padding: "28px 24px 40px",
          animation: "slideUp 0.25s ease",
        }}
      >
        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

        {/* Handle bar */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "#e0d8cc", margin: "0 auto 20px" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {step === "amount" && (
              <button onClick={() => setStep("org")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#666" }}>
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#1a1a1a" }}>
                {step === "org" ? "Choose who to support" : `Donate to ${selectedOrg?.name}`}
              </h2>
              {step === "org" && (
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#888" }}>No account needed</p>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#999" }}>
            <X size={20} />
          </button>
        </div>

        {/* ── Step: org picker ─────────────────────────────────────────── */}
        {step === "org" && (
          <>
            {orgsLoading ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#aaa", fontSize: 14 }}>Loading organisations…</div>
            ) : orgs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#aaa", fontSize: 14 }}>No organisations found</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {orgs.map((org) => (
                  <button
                    key={org._id}
                    onClick={() => { setSelectedOrg(org); setStep("amount"); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 16px", borderRadius: 12,
                      border: "1.5px solid #e0d8cc", background: "#fafaf8",
                      cursor: "pointer", textAlign: "left",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#B50000";
                      (e.currentTarget as HTMLButtonElement).style.background = "#fff0f0";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#e0d8cc";
                      (e.currentTarget as HTMLButtonElement).style.background = "#fafaf8";
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                      background: "#7A0000", color: "#F5B800",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 15,
                    }}>
                      {org.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{org.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "#888" }}>{[org.category, org.country].filter(Boolean).join(" · ")}</p>
                    </div>
                    <ChevronLeft size={14} color="#ccc" style={{ transform: "rotate(180deg)", flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Step: amount picker ──────────────────────────────────────── */}
        {step === "amount" && selectedOrg && (
          <>
            {/* Preset amounts */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
              {PRESET_AMOUNTS.map((amt) => {
                const active = preset === amt && !custom;
                return (
                  <button
                    key={amt}
                    onClick={() => { setPreset(amt); setCustom(""); setError(""); }}
                    style={{
                      padding: "13px 0", borderRadius: 10, fontWeight: 700, fontSize: 16,
                      border: active ? "2px solid transparent" : "2px solid #e0d8cc",
                      background: active ? "#F5B800" : "#fafaf8",
                      color: active ? "#111" : "#333",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    £{amt}
                  </button>
                );
              })}
              <button
                onClick={() => { setCustom(""); setPreset(0); }}
                style={{
                  padding: "13px 0", borderRadius: 10, fontWeight: 700, fontSize: 14,
                  border: !custom && preset === 0 ? "2px solid #B50000" : "2px solid #e0d8cc",
                  background: "#fafaf8", color: "#555",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                Custom
              </button>
            </div>

            {/* Custom amount */}
            {!custom && preset === 0 && (
              <div style={{ position: "relative", marginBottom: 16 }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontWeight: 700, color: "#888", fontSize: 16 }}>£</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="0"
                  autoFocus
                  value={custom}
                  onChange={(e) => { setCustom(e.target.value); setError(""); }}
                  style={{
                    width: "100%", padding: "13px 14px 13px 32px", fontSize: 16, fontWeight: 700,
                    border: "2px solid #B50000", borderRadius: 10, outline: "none",
                    background: "#fff", boxSizing: "border-box", fontFamily: "inherit",
                  }}
                />
              </div>
            )}

            {/* Summary */}
            {amountGbp > 0 && (
              <div style={{ background: "rgba(245,184,0,0.12)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, textAlign: "center" }}>
                <span style={{ fontSize: 13, color: "#666" }}>Donating </span>
                <span style={{ fontSize: 20, fontWeight: 900, color: "#B50000" }}>£{amountGbp.toFixed(2)}</span>
                <span style={{ fontSize: 13, color: "#666" }}> to {selectedOrg.name}</span>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#aaa" }}>3% platform fee · {(amountGbp * 0.97).toFixed(2)} goes to the org</p>
              </div>
            )}

            {error && (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#B50000", textAlign: "center" }}>{error}</p>
            )}

            {/* Donate button */}
            <button
              onClick={handleDonate}
              disabled={amountPence < 100 || loading}
              style={{
                width: "100%", padding: "15px", borderRadius: 12, border: "none",
                background: amountPence < 100 || loading ? "#ccc" : "#B50000",
                color: "#fff", fontWeight: 800, fontSize: 16,
                cursor: amountPence < 100 || loading ? "not-allowed" : "pointer",
                transition: "background 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Heart size={16} fill="currentColor" />
              {loading ? "Redirecting to Stripe…" : amountGbp > 0 ? `Donate £${amountGbp.toFixed(2)} anonymously` : "Select an amount"}
            </button>

            <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: 12, color: "#bbb" }}>
              Secured by Stripe · No account needed
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Landing page ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [showDonate, setShowDonate] = useState(false);

  return (
    <div
      className="min-h-screen flex flex-col items-center px-6"
      style={{ backgroundColor: "#CC0000" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm text-center gap-8 py-16">

        {/* Logo */}
        <img
          src="/logo-gold-v2.png"
          alt="Root ProjX"
          className="h-36 sm:h-48 w-auto object-contain"
        />

        {/* Tagline */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-light tracking-widest text-white uppercase">
            Restoration. Culture. Access.
          </h1>
          <p className="text-sm sm:text-base" style={{ color: "rgba(255,255,255,0.65)" }}>
            Support straight to the source.
          </p>
        </div>

        {/* Enter */}
        <Link href="/discover" className="w-full">
          <button
            className="w-full py-4 rounded-xl text-lg font-extrabold tracking-wide transition-opacity hover:opacity-90 active:scale-95"
            style={{ backgroundColor: "#F5C000", color: "#111" }}
          >
            Enter
          </button>
        </Link>

        {/* Anonymous donate */}
        <button
          onClick={() => setShowDonate(true)}
          className="w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-opacity hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
          style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", border: "none" }}
        >
          <Heart size={15} fill="currentColor" />
          Donate anonymously
        </button>

      </div>

      {/* Bottom join links */}
      <div className="pb-14 w-full max-w-sm flex flex-col items-center gap-3">
        <Link href="/onboarding" className="w-full">
          <button
            className="w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-opacity hover:opacity-90 active:scale-95 border-2"
            style={{ borderColor: "rgba(255,255,255,0.55)", color: "#fff", background: "transparent" }}
          >
            Join as an organisation
          </button>
        </Link>
        <Link href="/register" className="w-full">
          <button
            className="w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-opacity hover:opacity-90 active:scale-95 border-2"
            style={{ borderColor: "rgba(255,255,255,0.55)", color: "#fff", background: "transparent" }}
          >
            Join as supporter
          </button>
        </Link>
        <Link href="/login">
          <span className="text-xs cursor-pointer transition-colors" style={{ color: "rgba(255,255,255,0.45)" }}>
            Already have an account? <span className="underline">Sign in</span>
          </span>
        </Link>
      </div>

      {/* Donate modal */}
      {showDonate && <DonateModal onClose={() => setShowDonate(false)} />}
    </div>
  );
}
