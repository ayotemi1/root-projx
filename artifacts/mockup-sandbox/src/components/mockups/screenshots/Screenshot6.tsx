import { PhoneFrame } from "./shared/PhoneFrame";

export default function Screenshot6() {
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden" }}>
      <div style={{ flex: "0 0 40%", backgroundColor: "#CC0000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 40px 20px", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.65)", textTransform: "uppercase", marginBottom: 4 }}>Root ProjX</div>
        <div style={{ fontSize: 52, fontWeight: 900, color: "#FFFFFF", textAlign: "center", lineHeight: 1.08, letterSpacing: "-0.02em" }}>For The Diaspora.</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: "rgba(255,255,255,0.88)", textAlign: "center", lineHeight: 1.1 }}>By The Diaspora.</div>
        <div style={{ marginTop: 12, background: "rgba(0,0,0,0.18)", borderRadius: 100, padding: "8px 22px" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#F5C000" }}>Restoration. Culture. Access.</span>
        </div>
      </div>

      <div style={{ flex: "0 0 60%", backgroundColor: "#A00000", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 24 }}>
        <PhoneFrame>
          {/* Home feed screen */}
          <div style={{ height: "100%", backgroundColor: "#F9F6F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ backgroundColor: "#B50000", padding: "14px 14px 10px" }}>
              <div style={{ color: "#F5C000", fontWeight: 900, fontSize: 18 }}>Root ProjX</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 2 }}>Impact Feed</div>
            </div>
            <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10, overflowY: "hidden" }}>
              {[
                { initials: "CY", org: "Cornerstone Youth Foundation", tag: "MILESTONE", tagColor: "#B50000", title: "50 young people complete our carpentry programme", likes: 87, time: "3d" },
                { initials: "UJ", org: "UK-Jamaica Bridge", tag: "CAMPAIGN", tagColor: "#F5C000", tagTextColor: "#7A0000", title: "Jamaica Flood Relief — match-funded until 31 May", likes: 143, time: "7d" },
                { initials: "GR", org: "Green Roots Initiative", tag: "MILESTONE", tagColor: "#B50000", title: "10,000 trees planted — one root at a time", likes: 109, time: "10d" },
              ].map((p) => (
                <div key={p.title} style={{ backgroundColor: "#fff", borderRadius: 12, padding: "10px 12px", border: "1px solid #E0D8CC" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#B50000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#fff", flexShrink: 0 }}>{p.initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#1a1a1a" }}>{p.org}</div>
                      <div style={{ fontSize: 9, color: "#888" }}>{p.time} ago</div>
                    </div>
                    <span style={{ backgroundColor: p.tagColor, color: p.tagTextColor ?? "#fff", fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 100 }}>{p.tag}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.4, marginBottom: 6 }}>{p.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#888"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    <span style={{ fontSize: 10, color: "#888" }}>{p.likes}</span>
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
