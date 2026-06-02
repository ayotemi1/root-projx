import React from "react";

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 230,
      height: 470,
      borderRadius: 36,
      backgroundColor: "#1A1A1A",
      padding: 8,
      boxShadow: "0 32px 64px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.12)",
      position: "relative",
      flexShrink: 0,
    }}>
      {/* Screen area */}
      <div style={{
        width: "100%",
        height: "100%",
        borderRadius: 28,
        overflow: "hidden",
        backgroundColor: "#fff",
        position: "relative",
      }}>
        {/* Dynamic island */}
        <div style={{
          position: "absolute",
          top: 8,
          left: "50%",
          transform: "translateX(-50%)",
          width: 72,
          height: 22,
          backgroundColor: "#1A1A1A",
          borderRadius: 100,
          zIndex: 10,
        }} />
        {/* Status bar */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 36,
          zIndex: 5,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          padding: "0 14px 4px",
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "transparent" }}>9:41</span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {/* Signal bars */}
            <svg width="14" height="9" viewBox="0 0 14 9" fill="rgba(255,255,255,0.0)">
              <rect x="0" y="6" width="2" height="3" rx="0.5" fill="transparent"/>
              <rect x="3" y="4" width="2" height="5" rx="0.5" fill="transparent"/>
              <rect x="6" y="2" width="2" height="7" rx="0.5" fill="transparent"/>
              <rect x="9" y="0" width="2" height="9" rx="0.5" fill="transparent"/>
            </svg>
          </div>
        </div>
        {/* Content */}
        <div style={{ position: "absolute", top: 36, left: 0, right: 0, bottom: 0 }}>
          {children}
        </div>
      </div>
      {/* Side buttons */}
      <div style={{ position: "absolute", right: -3, top: 90, width: 3, height: 24, backgroundColor: "#333", borderRadius: "0 2px 2px 0" }} />
      <div style={{ position: "absolute", left: -3, top: 80, width: 3, height: 18, backgroundColor: "#333", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: -3, top: 106, width: 3, height: 28, backgroundColor: "#333", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: -3, top: 142, width: 3, height: 28, backgroundColor: "#333", borderRadius: "2px 0 0 2px" }} />
    </div>
  );
}
