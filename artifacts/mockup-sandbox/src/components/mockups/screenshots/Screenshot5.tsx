import { ScreenBase } from "./shared/ScreenBase";

export default function Screenshot5() {
  return (
    <ScreenBase
      headline={"Follow The Causes\nYou Support."}
      subheadline={"Discover grassroots organisations worldwide."}
      accent={"Real orgs. Real communities. Real change."}
    >
      <div style={{ height: "100%", background: "#F9F6F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Nav */}
        <div style={{ background: "linear-gradient(135deg, #B50000 0%, #7A0000 100%)", padding: "44px 14px 8px" }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, marginBottom: 7 }}>Discover</div>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>🔍</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>Search organisations…</span>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ padding: "7px 10px", display: "flex", gap: 5 }}>
          {["All", "Jamaica", "UK", "Youth", "Health"].map((f, i) => (
            <div key={f} style={{ background: i === 0 ? "#B50000" : "#fff", borderRadius: 100, padding: "4px 9px", border: i === 0 ? "none" : "1px solid #E0D8CC" }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: i === 0 ? "#fff" : "#555" }}>{f}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, padding: "0 10px", display: "flex", flexDirection: "column", gap: 7, overflow: "hidden" }}>
          {[
            { init: "CY", name: "Cornerstone Youth Foundation", loc: "Kingston, Jamaica", cat: "Youth Empowerment", score: 94, following: true },
            { init: "MJ", name: "Mothers in Need Jamaica", loc: "St Ann, Jamaica", cat: "Maternal Health", score: 88, following: false },
            { init: "UJ", name: "UK-Jamaica Bridge", loc: "London, UK", cat: "Diaspora Support", score: 91, following: true },
          ].map((o) => (
            <div key={o.name} style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E0D8CC", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: "linear-gradient(135deg, #B50000, #7A0000)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#fff", flexShrink: 0 }}>{o.init}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1a1a1a", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</div>
                <div style={{ fontSize: 8, color: "#aaa", marginBottom: 4 }}>{o.loc}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ background: "#F2EDE4", color: "#666", fontSize: 7, fontWeight: 600, padding: "2px 6px", borderRadius: 5 }}>{o.cat}</span>
                  <span style={{ fontSize: 8, color: "#F5C000", fontWeight: 700 }}>★ {o.score}</span>
                </div>
              </div>
              <div style={{ background: o.following ? "rgba(181,0,0,0.08)" : "#B50000", borderRadius: 8, padding: "5px 8px", flexShrink: 0 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: o.following ? "#B50000" : "#fff" }}>{o.following ? "Following" : "Follow"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScreenBase>
  );
}
