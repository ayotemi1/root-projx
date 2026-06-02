import { ScreenBase } from "./shared/ScreenBase";

export default function Screenshot1() {
  return (
    <ScreenBase
      headline={"Give Directly."}
      subheadline={"See exactly where your money lands — every time."}
      accent={"No middlemen. Ever."}
    >
      {/* Org profile screen */}
      <div style={{ height: "100%", background: "#F9F6F0", display: "flex", flexDirection: "column", paddingTop: 44, overflow: "hidden" }}>
        {/* Hero banner */}
        <div style={{ background: "linear-gradient(135deg, #B50000 0%, #7A0000 100%)", padding: "12px 14px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: "#F5C000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#7A0000", flexShrink: 0 }}>CY</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 12, lineHeight: 1.2 }}>Cornerstone Youth Foundation</div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 9, marginTop: 2 }}>Kingston, Jamaica · Youth Empowerment</div>
            </div>
            <div style={{ background: "#F5C000", borderRadius: 100, padding: "3px 8px", fontSize: 8, fontWeight: 800, color: "#7A0000", flexShrink: 0 }}>✓ Verified</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            {[["248", "Followers"], ["£18.5k", "Raised"], ["94", "Impact"]].map(([v, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ color: "#F5C000", fontWeight: 900, fontSize: 15 }}>{v}</div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 8 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* About */}
        <div style={{ padding: "10px 14px 6px" }}>
          <p style={{ fontSize: 10, color: "#555", lineHeight: 1.5, margin: 0 }}>
            Providing mentorship, vocational training, and safe spaces for at-risk youth in Kingston's inner-city communities.
          </p>
        </div>

        {/* Donate button */}
        <div style={{ padding: "0 14px 10px" }}>
          <div style={{ background: "linear-gradient(90deg, #B50000, #9A0000)", borderRadius: 10, padding: "10px", textAlign: "center", boxShadow: "0 4px 12px rgba(181,0,0,0.35)" }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>Donate Now</span>
          </div>
        </div>

        {/* Campaign card */}
        <div style={{ margin: "0 12px 8px", background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E0D8CC", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#1a1a1a", marginBottom: 7 }}>Help fund the next cohort</div>
          <div style={{ height: 5, background: "#E0D8CC", borderRadius: 3, overflow: "hidden", marginBottom: 5 }}>
            <div style={{ width: "62%", height: "100%", background: "linear-gradient(90deg, #F5C000, #D4A800)", borderRadius: 3 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, color: "#B50000", fontWeight: 700 }}>£9,300 raised</span>
            <span style={{ fontSize: 9, color: "#888" }}>of £15,000</span>
          </div>
        </div>

        {/* One-time / Monthly tabs */}
        <div style={{ margin: "0 12px", background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E0D8CC" }}>
          <div style={{ display: "flex", background: "#F2EDE4", borderRadius: 7, padding: 3, marginBottom: 8 }}>
            <div style={{ flex: 1, background: "#B50000", borderRadius: 5, padding: "4px 0", textAlign: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>One-time</span>
            </div>
            <div style={{ flex: 1, padding: "4px 0", textAlign: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: "#888" }}>Monthly</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["£5", "£10", "£25", "£50"].map((a, i) => (
              <div key={a} style={{ flex: 1, background: i === 2 ? "#B50000" : "#F2EDE4", borderRadius: 7, padding: "6px 0", textAlign: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: i === 2 ? "#fff" : "#555" }}>{a}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScreenBase>
  );
}
