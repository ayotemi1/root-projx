import { useState } from "react";
import { Link } from "wouter";
import { X, Heart } from "lucide-react";

const RED = "#B50000";
const GOLD = "#F5B800";
const PRESETS = [5, 10, 25, 50, 100];

interface Props {
  open: boolean;
  onClose: () => void;
  orgId: string;
  orgName: string;
}

export function GuestDonateSheet({ open, onClose, orgId, orgName }: Props) {
  const [preset, setPreset] = useState<number>(25);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const amountGbp = custom ? parseFloat(custom) : preset;
  const amountPence = Math.round((amountGbp || 0) * 100);
  const valid = amountPence >= 100;

  function handleClose() {
    setPreset(25);
    setCustom("");
    setError("");
    setLoading(false);
    onClose();
  }

  async function handleDonate() {
    if (!valid || loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/donations/anonymous-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, amountPence }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong — please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error — please check your connection.");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "0 0 40px",
          animation: "guestSheetUp 0.22s ease",
        }}
      >
        <style>{`@keyframes guestSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

        {/* Header */}
        <div style={{ background: RED, padding: "22px 24px 20px", position: "relative", borderRadius: "20px 20px 0 0" }}>
          <button
            onClick={handleClose}
            style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", padding: 4 }}
          >
            <X size={20} />
          </button>
          <p style={{ margin: "0 0 2px", fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>Donating to</p>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff", paddingRight: 32, lineHeight: 1.25 }}>{orgName}</h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>No account needed · Secured by Stripe</p>
        </div>

        <div style={{ padding: "24px 24px 0" }}>

          {/* Amount presets */}
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Choose an amount
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
            {PRESETS.map((amt) => {
              const active = preset === amt && !custom;
              return (
                <button
                  key={amt}
                  onClick={() => { setPreset(amt); setCustom(""); setError(""); }}
                  style={{
                    padding: "12px 0", borderRadius: 10, fontWeight: 700, fontSize: 17,
                    border: active ? "2px solid transparent" : "2px solid #e0d8cc",
                    background: active ? GOLD : "#fafaf8",
                    color: active ? "#111" : "#333",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  £{amt}
                </button>
              );
            })}
            <button
              onClick={() => { setCustom(custom || ""); setPreset(0); setError(""); }}
              style={{
                padding: "12px 0", borderRadius: 10, fontWeight: 700, fontSize: 14,
                border: custom || preset === 0 ? `2px solid ${RED}` : "2px solid #e0d8cc",
                background: "#fafaf8", color: "#555",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              Custom
            </button>
          </div>

          {/* Custom amount input */}
          {(custom !== "" || preset === 0) && (
            <div style={{ position: "relative", marginBottom: 10 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontWeight: 700, color: "#888", fontSize: 17 }}>£</span>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="0"
                autoFocus
                value={custom}
                onChange={(e) => { setCustom(e.target.value); setError(""); }}
                style={{
                  width: "100%", padding: "12px 14px 12px 32px", fontSize: 17, fontWeight: 700,
                  border: `2px solid ${RED}`, borderRadius: 10, outline: "none",
                  background: "#fff", boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
            </div>
          )}

          {/* Summary */}
          {amountGbp > 0 && (
            <div style={{ background: "rgba(245,184,0,0.1)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, textAlign: "center" }}>
              <span style={{ fontSize: 13, color: "#777" }}>Donating </span>
              <span style={{ fontSize: 21, fontWeight: 900, color: RED }}>£{amountGbp.toFixed(2)}</span>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#aaa" }}>
                3% platform fee · £{(amountGbp * 0.97).toFixed(2)} reaches {orgName}
              </p>
            </div>
          )}

          {error && (
            <p style={{ margin: "0 0 10px", fontSize: 13, color: RED, textAlign: "center" }}>{error}</p>
          )}

          {/* Donate CTA */}
          <button
            onClick={handleDonate}
            disabled={!valid || loading}
            style={{
              width: "100%", padding: "15px", borderRadius: 12, border: "none",
              background: !valid || loading ? "#ccc" : RED,
              color: "#fff", fontWeight: 800, fontSize: 16,
              cursor: !valid || loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 0.2s",
            }}
          >
            <Heart size={16} fill="currentColor" />
            {loading
              ? "Redirecting to Stripe…"
              : valid
                ? `Donate £${amountGbp.toFixed(2)} — no sign-up needed`
                : "Choose an amount"}
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
            <div style={{ flex: 1, height: 1, background: "#e0d8cc" }} />
            <span style={{ fontSize: 12, color: "#bbb" }}>or sign in to track your impact</span>
            <div style={{ flex: 1, height: 1, background: "#e0d8cc" }} />
          </div>

          {/* Auth links */}
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href={`/register?next=${encodeURIComponent(`/donate/${orgId}`)}`}
              onClick={handleClose}
              style={{ flex: 1 }}
            >
              <button
                style={{
                  width: "100%", padding: "11px", borderRadius: 10, border: `2px solid ${GOLD}`,
                  background: GOLD, color: "#111", fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
              >
                Create account
              </button>
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(`/donate/${orgId}`)}`}
              onClick={handleClose}
              style={{ flex: 1 }}
            >
              <button
                style={{
                  width: "100%", padding: "11px", borderRadius: 10, border: `2px solid ${RED}`,
                  background: "transparent", color: RED, fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
              >
                Sign in
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
