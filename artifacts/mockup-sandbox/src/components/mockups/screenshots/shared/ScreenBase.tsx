import React from "react";
import { PhoneFrame } from "./PhoneFrame";

interface Props {
  headline: string;
  subheadline: string;
  accent: string;
  children: React.ReactNode;
}

export function ScreenBase({ headline, subheadline, accent, children }: Props) {
  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      overflow: "hidden",
    }}>
      {/* ── Top 40% — headline ─────────────────────────── */}
      <div style={{
        flex: "0 0 40%",
        background: "linear-gradient(160deg, #D40000 0%, #B50000 50%, #9A0000 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 32px 16px",
        gap: 8,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative radial glow */}
        <div style={{
          position: "absolute",
          top: "-40%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "120%",
          height: "160%",
          background: "radial-gradient(ellipse at center top, rgba(255,120,0,0.12) 0%, transparent 60%)",
          pointerEvents: "none",
        }} />

        {/* Logo mark */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
          opacity: 0.75,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: "#F5C000" }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#fff", textTransform: "uppercase" }}>Root ProjX</span>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: "#F5C000" }} />
        </div>

        {/* Main headline */}
        <div style={{
          fontSize: headline.length > 14 ? 42 : 52,
          fontWeight: 900,
          color: "#fff",
          textAlign: "center",
          lineHeight: 1.05,
          letterSpacing: "-0.025em",
          textShadow: "0 2px 20px rgba(0,0,0,0.25)",
        }}>
          {headline}
        </div>

        {/* Subheadline */}
        <div style={{
          fontSize: 22,
          fontWeight: 500,
          color: "rgba(255,255,255,0.82)",
          textAlign: "center",
          lineHeight: 1.35,
          maxWidth: 340,
        }}>
          {subheadline}
        </div>

        {/* Gold accent */}
        <div style={{
          marginTop: 4,
          background: "rgba(0,0,0,0.25)",
          borderRadius: 100,
          padding: "6px 18px",
          border: "1px solid rgba(245,192,0,0.3)",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#F5C000", letterSpacing: "0.02em" }}>
            {accent}
          </span>
        </div>
      </div>

      {/* ── Bottom 60% — phone ─────────────────────────── */}
      <div style={{
        flex: "0 0 60%",
        background: "linear-gradient(180deg, #8A0000 0%, #6A0000 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle grid/texture */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          pointerEvents: "none",
        }} />

        {/* Bottom gradient fade */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          background: "linear-gradient(0deg, rgba(0,0,0,0.3) 0%, transparent 100%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1, marginTop: -16 }}>
          <PhoneFrame>{children}</PhoneFrame>
        </div>
      </div>
    </div>
  );
}
