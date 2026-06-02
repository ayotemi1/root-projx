import { PhoneFrame } from "./shared/PhoneFrame";

export default function Screenshot1() {
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden" }}>
      {/* Top 40% — headline */}
      <div style={{ flex: "0 0 40%", backgroundColor: "#CC0000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 40px 20px", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.65)", textTransform: "uppercase", marginBottom: 4 }}>Root ProjX</div>
        <div style={{ fontSize: 52, fontWeight: 900, color: "#FFFFFF", textAlign: "center", lineHeight: 1.08, letterSpacing: "-0.02em" }}>Give Directly.</div>
        <div style={{ fontSize: 36, fontWeight: 700, color: "rgba(255,255,255,0.88)", textAlign: "center", lineHeight: 1.2 }}>See The Impact.</div>
        <div style={{ marginTop: 12, background: "rgba(0,0,0,0.18)", borderRadius: 100, padding: "8px 22px" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#F5C000", letterSpacing: "0.01em" }}>No middlemen. Ever.</span>
        </div>
      </div>

      {/* Bottom 60% — phone */}
      <div style={{ flex: "0 0 60%", backgroundColor: "#A00000", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 24 }}>
        <PhoneFrame>
          {/* Org profile screen */}
          <div style={{ height: "100%", backgroundColor: "#F9F6F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Org cover */}
            <div style={{ background: "linear-gradient(180deg, #B50000 0%, #7A0000 100%)", padding: "20px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#F5C000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#7A0000" }}>CY</div>
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Cornerstone Youth Foundation</div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Kingston, Jamaica · Youth Empowerment</div>
                </div>
                <div style={{ marginLeft: "auto", backgroundColor: "#F5C000", borderRadius: 100, padding: "4px 10px", fontSize: 10, fontWeight: 700, color: "#7A0000" }}>✓ Verified</div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ color: "#F5C000", fontWeight: 800, fontSize: 16 }}>248</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 9 }}>Followers</div>
                </div>
                <div style={{ width: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ color: "#F5C000", fontWeight: 800, fontSize: 16 }}>£18.5k</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 9 }}>Raised</div>
                </div>
                <div style={{ width: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ color: "#F5C000", fontWeight: 800, fontSize: 16 }}>94</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 9 }}>Impact Score</div>
                </div>
              </div>
            </div>
            {/* Description */}
            <div style={{ padding: "12px 14px 10px", fontSize: 11, color: "#444", lineHeight: 1.5 }}>
              Providing mentorship, vocational training, and safe spaces for at-risk youth in Kingston's inner-city communities.
            </div>
            {/* Donate button */}
            <div style={{ padding: "0 14px 12px" }}>
              <div style={{ backgroundColor: "#B50000", borderRadius: 12, padding: "12px", textAlign: "center" }}>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>Donate Now</span>
              </div>
            </div>
            {/* Campaign */}
            <div style={{ margin: "0 14px", backgroundColor: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E0D8CC" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>Help fund the next cohort</div>
              <div style={{ height: 6, backgroundColor: "#E0D8CC", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                <div style={{ width: "62%", height: "100%", backgroundColor: "#F5C000", borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 9, color: "#888" }}>£9,300 raised of £15,000</div>
            </div>
          </div>
        </PhoneFrame>
      </div>
    </div>
  );
}
