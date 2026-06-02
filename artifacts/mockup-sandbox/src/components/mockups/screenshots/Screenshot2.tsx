import { PhoneFrame } from "./shared/PhoneFrame";

export default function Screenshot2() {
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden" }}>
      <div style={{ flex: "0 0 40%", backgroundColor: "#CC0000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 40px 20px", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.65)", textTransform: "uppercase", marginBottom: 4 }}>Root ProjX</div>
        <div style={{ fontSize: 52, fontWeight: 900, color: "#FFFFFF", textAlign: "center", lineHeight: 1.08, letterSpacing: "-0.02em" }}>No Middlemen.</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: "rgba(255,255,255,0.88)", textAlign: "center", lineHeight: 1.3 }}>Your donation goes straight to the source.</div>
        <div style={{ marginTop: 12, background: "rgba(0,0,0,0.18)", borderRadius: 100, padding: "8px 22px" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#F5C000" }}>95% reaches the organisation.</span>
        </div>
      </div>

      <div style={{ flex: "0 0 60%", backgroundColor: "#A00000", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 24 }}>
        <PhoneFrame>
          {/* Donation success screen */}
          <div style={{ height: "100%", backgroundColor: "#F9F6F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", gap: 16 }}>
            {/* Success circle */}
            <div style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#B50000", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M8 18L15 25L28 11" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#1a1a1a", marginBottom: 4 }}>Thank you!</div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>Your donation is on its way to<br/>Cornerstone Youth Foundation</div>
            </div>
            {/* Breakdown card */}
            <div style={{ width: "100%", backgroundColor: "#fff", borderRadius: 14, padding: "14px", border: "1px solid #E0D8CC" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Your Donation</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "#555" }}>You gave</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>£25.00</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "#555" }}>To organisation</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#B50000" }}>£23.75</span>
              </div>
              <div style={{ height: 1, backgroundColor: "#E0D8CC", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#888" }}>Platform fee (5%)</span>
                <span style={{ fontSize: 11, color: "#888" }}>£1.25</span>
              </div>
            </div>
            {/* Fee bar */}
            <div style={{ width: "100%", height: 8, backgroundColor: "#E0D8CC", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: "95%", height: "100%", backgroundColor: "#F5C000", borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 11, color: "#888", textAlign: "center" }}>95% went directly to the cause</div>
          </div>
        </PhoneFrame>
      </div>
    </div>
  );
}
