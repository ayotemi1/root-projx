import { PhoneFrame } from "./shared/PhoneFrame";

export default function Screenshot5() {
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden" }}>
      <div style={{ flex: "0 0 40%", backgroundColor: "#CC0000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 40px 20px", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.65)", textTransform: "uppercase", marginBottom: 4 }}>Root ProjX</div>
        <div style={{ fontSize: 52, fontWeight: 900, color: "#FFFFFF", textAlign: "center", lineHeight: 1.08, letterSpacing: "-0.02em" }}>Follow The Causes</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: "rgba(255,255,255,0.88)", textAlign: "center", lineHeight: 1.1 }}>You Support.</div>
        <div style={{ marginTop: 12, background: "rgba(0,0,0,0.18)", borderRadius: 100, padding: "8px 22px", textAlign: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#F5C000" }}>Discover grassroots organisations worldwide.</span>
        </div>
      </div>

      <div style={{ flex: "0 0 60%", backgroundColor: "#A00000", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 24 }}>
        <PhoneFrame>
          {/* Discover screen */}
          <div style={{ height: "100%", backgroundColor: "#F9F6F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ backgroundColor: "#B50000", padding: "14px 14px 10px" }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Discover</div>
              {/* Search bar */}
              <div style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 8, padding: "6px 10px", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Search organisations…</span>
              </div>
            </div>
            <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10, overflowY: "hidden" }}>
              {[
                { initials: "CY", name: "Cornerstone Youth Foundation", loc: "Kingston, Jamaica", cat: "Youth Empowerment", followers: 248, raised: "£18.5k" },
                { initials: "MJ", name: "Mothers in Need Jamaica", loc: "St Ann, Jamaica", cat: "Maternal Health", followers: 195, raised: "£12.3k" },
                { initials: "UJ", name: "UK-Jamaica Bridge", loc: "London, UK", cat: "Diaspora Support", followers: 312, raised: "£34.1k" },
              ].map((o) => (
                <div key={o.name} style={{ backgroundColor: "#fff", borderRadius: 12, padding: "11px 12px", border: "1px solid #E0D8CC" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#B50000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff" }}>{o.initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>{o.name}</div>
                      <div style={{ fontSize: 9, color: "#888", marginTop: 1 }}>{o.loc}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 9, backgroundColor: "#F2EDE4", color: "#555", borderRadius: 6, padding: "2px 7px", fontWeight: 600 }}>{o.cat}</span>
                    <span style={{ fontSize: 10, color: "#888" }}>{o.followers} followers · {o.raised} raised</span>
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
