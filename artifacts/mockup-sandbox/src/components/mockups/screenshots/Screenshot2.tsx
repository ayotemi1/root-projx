import { ScreenBase } from "./shared/ScreenBase";

export default function Screenshot2() {
  return (
    <ScreenBase
      headline={"No Middlemen."}
      subheadline={"Your donation goes straight to the source."}
      accent={"95% reaches the organisation."}
    >
      <div style={{ height: "100%", background: "#F9F6F0", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 44, overflow: "hidden" }}>

        {/* Success circle */}
        <div style={{ marginTop: 18, marginBottom: 12, position: "relative" }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: "linear-gradient(135deg, #B50000, #7A0000)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(181,0,0,0.4)" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M6 14L12 20L22 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ position: "absolute", inset: -8, borderRadius: 40, border: "2px solid rgba(181,0,0,0.15)" }} />
        </div>

        <div style={{ fontWeight: 900, fontSize: 18, color: "#1a1a1a", marginBottom: 4, textAlign: "center" }}>Donation Sent! 🎉</div>
        <div style={{ fontSize: 10, color: "#666", textAlign: "center", lineHeight: 1.5, marginBottom: 14 }}>Your gift is on its way to<br/><strong style={{ color: "#B50000" }}>Cornerstone Youth Foundation</strong></div>

        {/* Breakdown */}
        <div style={{ width: "calc(100% - 24px)", background: "#fff", borderRadius: 12, padding: "12px", border: "1px solid #E0D8CC", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 10 }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>Breakdown</div>
          {[
            { label: "Your donation", val: "£25.00", color: "#1a1a1a" },
            { label: "To the organisation", val: "£23.75", color: "#B50000" },
            { label: "Platform fee (5%)", val: "£1.25", color: "#999" },
          ].map(({ label, val, color }, i) => (
            <div key={label}>
              {i === 2 && <div style={{ height: 1, background: "#E0D8CC", margin: "6px 0" }} />}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: i < 2 ? 7 : 0 }}>
                <span style={{ fontSize: 11, color: "#666" }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{val}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 95% bar */}
        <div style={{ width: "calc(100% - 24px)", background: "#fff", borderRadius: 12, padding: "12px", border: "1px solid #E0D8CC" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#1a1a1a" }}>Goes to org</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: "#F5C000" }}>95%</span>
          </div>
          <div style={{ height: 8, background: "#E0D8CC", borderRadius: 4, overflow: "hidden", marginBottom: 5 }}>
            <div style={{ width: "95%", height: "100%", background: "linear-gradient(90deg, #F5C000, #E0A800)", borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 8, color: "#888" }}>Industry average: 72% · Root ProjX: 95%</div>
        </div>
      </div>
    </ScreenBase>
  );
}
