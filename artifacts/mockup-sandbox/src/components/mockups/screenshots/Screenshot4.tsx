import { ScreenBase } from "./shared/ScreenBase";

export default function Screenshot4() {
  return (
    <ScreenBase
      headline={"See Where\nYour Money Goes."}
      subheadline={"Real campaigns. Real impact. Real transparency."}
      accent={"Verified. Transparent. Real."}
    >
      <div style={{ height: "100%", background: "#F9F6F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #B50000 0%, #7A0000 100%)", padding: "44px 14px 10px" }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Campaigns</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, marginTop: 1 }}>Live & Verified</div>
        </div>

        <div style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 7, overflow: "hidden" }}>
          {[
            { title: "Vocational Skills Cohort 8", raised: "£9,300", goal: "£15,000", pct: 62, days: "18 days left", hot: true },
            { title: "New Community Workshop", raised: "£6,200", goal: "£8,000", pct: 77, days: "5 days left", hot: false },
            { title: "Mentorship Programme 2025", raised: "£3,100", goal: "£10,000", pct: 31, days: "42 days left", hot: false },
          ].map((c) => (
            <div key={c.title} style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E0D8CC", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3, flex: 1, paddingRight: 6 }}>{c.title}</div>
                {c.hot && (
                  <span style={{ background: "rgba(245,192,0,0.15)", color: "#C49800", fontSize: 7, fontWeight: 800, padding: "2px 6px", borderRadius: 100, flexShrink: 0 }}>🔥 HOT</span>
                )}
              </div>
              <div style={{ height: 6, background: "#E0D8CC", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${c.pct}%`, height: "100%", background: c.pct > 70 ? "linear-gradient(90deg, #F5C000, #D4A800)" : "linear-gradient(90deg, #F5C000aa, #D4A800aa)", borderRadius: 3 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: "#B50000" }}>{c.raised} <span style={{ fontWeight: 400, color: "#aaa" }}>of {c.goal}</span></span>
                <span style={{ fontSize: 8, color: c.pct > 70 ? "#B50000" : "#888", fontWeight: 600 }}>{c.days}</span>
              </div>
            </div>
          ))}

          {/* Total raised card */}
          <div style={{ background: "linear-gradient(135deg, #B50000 0%, #7A0000 100%)", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>Total raised this month</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#F5C000" }}>£18,600</div>
            </div>
            <div style={{ fontSize: 22 }}>🇯🇲</div>
          </div>
        </div>
      </div>
    </ScreenBase>
  );
}
