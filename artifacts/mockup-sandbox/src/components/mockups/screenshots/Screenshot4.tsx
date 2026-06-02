import { PhoneFrame } from "./shared/PhoneFrame";

export default function Screenshot4() {
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden" }}>
      <div style={{ flex: "0 0 40%", backgroundColor: "#CC0000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 40px 20px", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.65)", textTransform: "uppercase", marginBottom: 4 }}>Root ProjX</div>
        <div style={{ fontSize: 52, fontWeight: 900, color: "#FFFFFF", textAlign: "center", lineHeight: 1.08, letterSpacing: "-0.02em" }}>See Where</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: "rgba(255,255,255,0.88)", textAlign: "center", lineHeight: 1.1 }}>Your Money Goes.</div>
        <div style={{ marginTop: 12, background: "rgba(0,0,0,0.18)", borderRadius: 100, padding: "8px 22px" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#F5C000" }}>Verified. Transparent. Real.</span>
        </div>
      </div>

      <div style={{ flex: "0 0 60%", backgroundColor: "#A00000", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 24 }}>
        <PhoneFrame>
          {/* Campaigns screen */}
          <div style={{ height: "100%", backgroundColor: "#F9F6F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ backgroundColor: "#B50000", padding: "14px 14px 10px" }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Campaigns</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 2 }}>Cornerstone Youth Foundation</div>
            </div>
            <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10, overflowY: "hidden" }}>
              {[
                { title: "Vocational Skills Cohort 8", raised: 9300, goal: 15000, pct: 62, days: "18 days left" },
                { title: "New Community Workshop", raised: 6200, goal: 8000, pct: 77, days: "5 days left" },
                { title: "Mentorship Programme 2025", raised: 3100, goal: 10000, pct: 31, days: "42 days left" },
              ].map((c) => (
                <div key={c.title} style={{ backgroundColor: "#fff", borderRadius: 12, padding: "12px 14px", border: "1px solid #E0D8CC" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", marginBottom: 8, lineHeight: 1.3 }}>{c.title}</div>
                  <div style={{ height: 7, backgroundColor: "#E0D8CC", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ width: `${c.pct}%`, height: "100%", backgroundColor: "#F5C000", borderRadius: 4 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#B50000" }}>£{c.raised.toLocaleString()}</span>
                      <span style={{ fontSize: 10, color: "#888" }}> of £{c.goal.toLocaleString()}</span>
                    </div>
                    <span style={{ fontSize: 9, color: "#B50000", fontWeight: 600, backgroundColor: "rgba(181,0,0,0.08)", borderRadius: 100, padding: "2px 7px" }}>{c.days}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PhoneFrame>
      </div>
    </div>
  );
}
