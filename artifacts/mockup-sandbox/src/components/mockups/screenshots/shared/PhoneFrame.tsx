import React from "react";

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const PW = 280;
  const PH = 570;
  const BR = 44;
  const PAD = 10;
  const SCR = 36;

  return (
    <div style={{
      position: "relative",
      width: PW,
      height: PH,
      flexShrink: 0,
    }}>
      {/* Glow behind phone */}
      <div style={{
        position: "absolute",
        inset: -30,
        background: "radial-gradient(ellipse at center, rgba(245,192,0,0.18) 0%, transparent 70%)",
        borderRadius: "50%",
        pointerEvents: "none",
      }} />

      {/* Phone shadow */}
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: BR,
        boxShadow: "0 40px 80px rgba(0,0,0,0.65), 0 16px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)",
      }} />

      {/* Phone body */}
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: BR,
        background: "linear-gradient(160deg, #2a2a2a 0%, #111 60%, #1a1a1a 100%)",
        border: "1.5px solid rgba(255,255,255,0.13)",
        overflow: "hidden",
      }}>
        {/* Screen area */}
        <div style={{
          position: "absolute",
          top: PAD,
          left: PAD,
          right: PAD,
          bottom: PAD,
          borderRadius: SCR,
          overflow: "hidden",
          background: "#fff",
        }}>
          {/* App content */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            {children}
          </div>

          {/* Dynamic island overlay */}
          <div style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 80,
            height: 24,
            background: "#111",
            borderRadius: 100,
            zIndex: 20,
          }} />

          {/* Status bar */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 44,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            padding: "0 16px 4px",
            zIndex: 15,
            pointerEvents: "none",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", opacity: 0 }}>9:41</span>
            <div style={{ display: "flex", gap: 3, alignItems: "center" }} />
          </div>
        </div>

        {/* Shine overlay on phone body */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "50%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%)",
          borderRadius: `${BR}px ${BR}px 0 0`,
          pointerEvents: "none",
        }} />
      </div>

      {/* Side buttons */}
      <div style={{ position: "absolute", right: -4, top: 100, width: 4, height: 28, background: "#333", borderRadius: "0 3px 3px 0" }} />
      <div style={{ position: "absolute", left: -4, top: 88, width: 4, height: 20, background: "#333", borderRadius: "3px 0 0 3px" }} />
      <div style={{ position: "absolute", left: -4, top: 116, width: 4, height: 36, background: "#333", borderRadius: "3px 0 0 3px" }} />
      <div style={{ position: "absolute", left: -4, top: 160, width: 4, height: 36, background: "#333", borderRadius: "3px 0 0 3px" }} />
    </div>
  );
}
