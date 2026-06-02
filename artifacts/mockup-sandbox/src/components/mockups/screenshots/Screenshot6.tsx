import { ScreenBase } from "./shared/ScreenBase";

export default function Screenshot6() {
  return (
    <ScreenBase
      headline={"For The Diaspora.\nBy The Diaspora."}
      subheadline={"Stay connected to the communities that shaped you."}
      accent={"Restoration. Culture. Access."}
    >
      <div style={{ height: "100%", background: "#F9F6F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Nav */}
        <div style={{ background: "linear-gradient(135deg, #B50000 0%, #7A0000 100%)", padding: "44px 14px 10px" }}>
          <div style={{ color: "#F5C000", fontWeight: 900, fontSize: 16 }}>Root ProjX</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 9 }}>Impact Feed</div>
        </div>

        <div style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 7, overflow: "hidden" }}>
          {[
            { init: "CY", org: "Cornerstone Youth", time: "3d", tag: "MILESTONE", tagBg: "#B50000", tagFg: "#fff", title: "50 young people complete our carpentry programme", likes: 87 },
            { init: "UJ", org: "UK-Jamaica Bridge", time: "7d", tag: "CAMPAIGN", tagBg: "#F5C000", tagFg: "#7A0000", title: "Jamaica Flood Relief — match-funded until 31 May", likes: 143, featured: true },
            { init: "GR", org: "Green Roots Initiative", time: "10d", tag: "MILESTONE", tagBg: "#B50000", tagFg: "#fff", title: "10,000 trees planted — one root at a time", likes: 109 },
          ].map((p) => (
            <div key={p.title} style={{
              background: "#fff",
              borderRadius: 10,
              padding: "9px 11px",
              border: p.featured ? "1.5px solid #F5C000" : "1px solid #E0D8CC",
              boxShadow: p.featured ? "0 2px 12px rgba(245,192,0,0.18)" : "0 1px 6px rgba(0,0,0,0.06)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ width: 26, height: 26, borderRadius: 13, background: "linear-gradient(135deg, #B50000, #7A0000)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 900, color: "#fff", flexShrink: 0 }}>{p.init}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#1a1a1a" }}>{p.org}</div>
                  <div style={{ fontSize: 8, color: "#aaa" }}>{p.time} ago</div>
                </div>
                <span style={{ background: p.tagBg, color: p.tagFg, fontSize: 7, fontWeight: 800, padding: "2px 6px", borderRadius: 100 }}>{p.tag}</span>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.4, marginBottom: 6 }}>{p.title}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 9, color: "#aaa" }}>♥ {p.likes}</span>
                  <span style={{ fontSize: 9, color: "#aaa" }}>💬 {Math.floor(p.likes * 0.3)}</span>
                </div>
                <span style={{ fontSize: 8, color: "#B50000", fontWeight: 700 }}>Donate →</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom tab bar */}
        <div style={{ background: "#7A0000", padding: "6px 0 8px", display: "flex", justifyContent: "space-around" }}>
          {[["🏠", "Feed", true], ["🔍", "Discover", false], ["❤️", "Following", false], ["👤", "Account", false]].map(([icon, label, active]) => (
            <div key={String(label)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <span style={{ fontSize: 12 }}>{icon}</span>
              <span style={{ fontSize: 7, fontWeight: active ? 700 : 400, color: active ? "#F5C000" : "rgba(255,255,255,0.5)" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </ScreenBase>
  );
}
