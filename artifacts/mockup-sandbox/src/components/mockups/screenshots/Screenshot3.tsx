import { ScreenBase } from "./shared/ScreenBase";

export default function Screenshot3() {
  return (
    <ScreenBase
      headline={"Watch Progress\nIn Real Time."}
      subheadline={"Impact updates straight from the field."}
      accent={"Live updates from the ground."}
    >
      <div style={{ height: "100%", background: "#F9F6F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Nav */}
        <div style={{ background: "linear-gradient(135deg, #B50000 0%, #7A0000 100%)", padding: "44px 14px 10px" }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Updates</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, marginTop: 1 }}>Cornerstone Youth Foundation</div>
        </div>

        <div style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 7, overflow: "hidden" }}>
          {[
            { tag: "MILESTONE", tagBg: "#B50000", tagFg: "#fff", title: "50 young people complete our carpentry programme", time: "3d ago", likes: 87, hasImg: true },
            { tag: "CAMPAIGN", tagBg: "#F5C000", tagFg: "#7A0000", title: "Help fund the next cohort — 30 spots available", time: "21d ago", likes: 71, hasImg: false },
            { tag: "UPDATE", tagBg: "#1a1a1a", tagFg: "#fff", title: "New workshop opens in Kingston", time: "1mo ago", likes: 55, hasImg: false },
          ].map((p) => (
            <div key={p.title} style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #E0D8CC", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              {p.hasImg && (
                <div style={{ height: 52, background: "linear-gradient(135deg, #D4A800 0%, #B58900 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 20 }}>🏗️</div>
                </div>
              )}
              <div style={{ padding: "8px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                  <span style={{ background: p.tagBg, color: p.tagFg, fontSize: 7, fontWeight: 800, padding: "2px 6px", borderRadius: 100, letterSpacing: "0.05em" }}>{p.tag}</span>
                  <span style={{ fontSize: 8, color: "#aaa" }}>{p.time}</span>
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.4, marginBottom: 5 }}>{p.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 9, color: "#ccc" }}>♥</span>
                  <span style={{ fontSize: 9, color: "#aaa" }}>{p.likes}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScreenBase>
  );
}
