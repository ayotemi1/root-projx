import { useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, ChevronRight, ChevronLeft, Sprout, ClipboardList, Search, Rocket } from "lucide-react";

const RED_DEEP = "#7A0000";
const RED = "#B50000";
const GOLD = "#F5B800";

const SECTORS = [
  "Education",
  "Health & Wellbeing",
  "Environment",
  "Community Development",
  "Arts & Culture",
  "Economic Empowerment",
  "Youth",
  "Sport & Recreation",
  "Housing & Homelessness",
  "Disaster Relief",
  "Faith & Spirituality",
  "Other",
];

// 0 = welcome, 1 = org details, 2 = sectors, 3 = socials, 4 = complete
const TOTAL_STEPS = 3;

function ProgressBar({ step }: { step: number }) {
  const pct = Math.round(((step - 1) / TOTAL_STEPS) * 100);
  return (
    <div style={{ height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2 }}>
      <div
        style={{
          height: "100%",
          background: GOLD,
          borderRadius: 2,
          width: `${Math.max(pct, 4)}%`,
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

function TopBar({ step }: { step: number }) {
  const isEdge = step === 0 || step === 4;
  return (
    <div style={{ background: RED_DEEP, padding: "14px 24px", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isEdge ? 0 : 10 }}>
          <img src="/logo-stylised.png" alt="Root ProjX" style={{ height: 36, objectFit: "contain" }} />
          {!isEdge && (
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              Step {step} of {TOTAL_STEPS}
            </span>
          )}
        </div>
        {!isEdge && <ProgressBar step={step} />}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.10)", padding: "40px 48px", width: "100%" }}>
      {children}
    </div>
  );
}

function StepHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1a1a1a", marginBottom: 8, lineHeight: 1.3 }}>
      {children}
    </h2>
  );
}

function StepSub({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 15, color: "#666", marginBottom: 32, lineHeight: 1.6 }}>
      {children}
    </p>
  );
}

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: hint ? 2 : 6 }}>
        {label}
      </label>
      {hint && (
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#999" }}>{hint}</p>
      )}
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  fontSize: 15,
  border: "1.5px solid #e0d8cc",
  borderRadius: 8,
  outline: "none",
  background: "#fafaf8",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function PrefixInput({
  prefix,
  placeholder,
  value,
  onChange,
  testId,
}: {
  prefix: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  testId?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #e0d8cc", borderRadius: 8, background: "#fafaf8", overflow: "hidden" }}>
      <span style={{ padding: "11px 12px 11px 14px", fontSize: 14, color: "#999", background: "#f0ece4", borderRight: "1.5px solid #e0d8cc", whiteSpace: "nowrap", userSelect: "none" }}>
        {prefix}
      </span>
      <input
        data-testid={testId}
        style={{ ...inputStyle, border: "none", borderRadius: 0, background: "transparent", flex: 1 }}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  loading = false,
  hideBack = false,
  nextTestId = "button-next",
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  hideBack?: boolean;
  nextTestId?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32 }}>
      {!hideBack && onBack ? (
        <button
          data-testid="button-back"
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "1.5px solid #e0d8cc", borderRadius: 8,
            padding: "10px 20px", fontSize: 14, color: "#666", cursor: "pointer",
          }}
        >
          <ChevronLeft size={16} /> Back
        </button>
      ) : <span />}
      <button
        data-testid={nextTestId}
        onClick={onNext}
        disabled={nextDisabled || loading}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: nextDisabled || loading ? "#ccc" : RED,
          border: "none", borderRadius: 8,
          padding: "11px 28px", fontSize: 15, fontWeight: 700, color: "#fff",
          cursor: nextDisabled || loading ? "not-allowed" : "pointer",
          transition: "background 0.2s",
        }}
      >
        {loading ? "Submitting…" : nextLabel}
        {!loading && <ChevronRight size={16} />}
      </button>
    </div>
  );
}

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1 fields
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");

  // Step 2 fields
  const [sectors, setSectors] = useState<string[]>([]);

  // Step 3 fields
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");

  function toggleSector(s: string) {
    setSectors((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const socialLinks = {
        instagram: instagram.trim() || undefined,
        facebook: facebook.trim() || undefined,
        twitter: twitter.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
      };

      const res = await fetch("/api/applications/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          contactName,
          email: email.trim().toLowerCase(),
          sectors,
          website: website.trim() || undefined,
          socialLinks,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setStep(4);
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f2ede4" }}>
      <TopBar step={step} />

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* ── Step 0: Welcome ─────────────────────────────────────────── */}
        {step === 0 && (
          <Card>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%", background: RED_DEEP, color: GOLD,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}>
                <Sprout size={36} strokeWidth={2.5} />
              </div>
              <h1 style={{ fontSize: 30, fontWeight: 900, color: "#1a1a1a", marginBottom: 12 }}>
                Apply to list your organisation
              </h1>
              <p style={{ fontSize: 16, color: "#555", lineHeight: 1.7, maxWidth: 480, margin: "0 auto 32px" }}>
                Submit your organisation for review. Once verified, you'll gain access to the platform to connect with diaspora supporters, receive donations, and share your impact.
              </p>
            </div>

            <div style={{ display: "grid", gap: 12, marginBottom: 36 }}>
              {[
                { icon: ClipboardList, title: "Submit your details", sub: "Complete our short application form (takes about 3 minutes)" },
                { icon: Search, title: "Undergo our review process", sub: "Our team verifies your eligibility within 5 business days" },
                { icon: Rocket, title: "Receive platform access", sub: "Get approved, create your profile, and start receiving support" },
              ].map(({ icon: Icon, title, sub }) => (
                <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 16, background: "#f9f6f0", borderRadius: 10, padding: "16px 20px" }}>
                  <Icon size={24} color={RED} style={{ marginTop: 2 }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#1a1a1a" }}>{title}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "#888" }}>{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center" }}>
              <button
                data-testid="button-begin-application"
                onClick={() => setStep(1)}
                style={{
                  background: RED, color: "#fff", border: "none", borderRadius: 10,
                  padding: "14px 40px", fontSize: 16, fontWeight: 800, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 10,
                }}
              >
                Begin application <ChevronRight size={18} />
              </button>
              <p style={{ marginTop: 24, fontSize: 14, color: "#666" }}>
                Looking to support instead?{" "}
                <a href="/register" style={{ color: RED, textDecoration: "none", fontWeight: 700 }} data-testid="link-register">
                  Create a supporter account
                </a>
              </p>
            </div>
          </Card>
        )}

        {/* ── Step 1: Organisation details ────────────────────────────── */}
        {step === 1 && (
          <Card>
            <StepHeading>Organisation details</StepHeading>
            <StepSub>We'll use these details to review your application and communicate our decision.</StepSub>

            <FieldGroup label="Organisation name">
              <input
                data-testid="input-org-name"
                style={inputStyle}
                type="text"
                placeholder="e.g. Kingston Youth Foundation"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                autoFocus
              />
            </FieldGroup>

            <FieldGroup label="Point of contact (your name)">
              <input
                data-testid="input-contact-name"
                style={inputStyle}
                type="text"
                placeholder="e.g. Maria Campbell"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </FieldGroup>

            <FieldGroup label="Email address">
              <input
                data-testid="input-email"
                style={inputStyle}
                type="email"
                placeholder="e.g. hello@yourorg.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FieldGroup>

            {error && (
              <p data-testid="error-message" style={{ color: RED, fontSize: 14, marginTop: -8, marginBottom: 8 }}>{error}</p>
            )}

            <NavButtons
              hideBack
              nextLabel="Next"
              nextTestId="button-next-step1"
              nextDisabled={!orgName.trim() || !contactName.trim() || !email.trim() || !email.includes("@")}
              onNext={() => { setError(""); setStep(2); }}
            />
          </Card>
        )}

        {/* ── Step 2: Sectors ──────────────────────────────────────────── */}
        {step === 2 && (
          <Card>
            <StepHeading>What sectors does your organisation work in?</StepHeading>
            <StepSub>Select all that apply — many organisations span more than one area.</StepSub>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
              {SECTORS.map((s) => {
                const selected = sectors.includes(s);
                return (
                  <button
                    key={s}
                    data-testid={`button-sector-${s.replace(/[^a-z0-9]/gi, '').toLowerCase()}`}
                    onClick={() => toggleSector(s)}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: selected ? `2px solid ${RED}` : "2px solid #e0d8cc",
                      background: selected ? "#fff0f0" : "#fafaf8",
                      color: selected ? RED : "#333",
                      fontWeight: selected ? 700 : 400,
                      fontSize: 14,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                  >
                    {selected && "✓ "}{s}
                  </button>
                );
              })}
            </div>

            {sectors.length > 0 && (
              <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
                {sectors.length} selected
              </p>
            )}

            {error && (
              <p data-testid="error-message" style={{ color: RED, fontSize: 14, marginTop: 8 }}>{error}</p>
            )}

            <NavButtons
              onBack={() => setStep(1)}
              nextLabel="Next"
              nextTestId="button-next-step2"
              nextDisabled={sectors.length === 0}
              onNext={() => { setError(""); setStep(3); }}
            />
          </Card>
        )}

        {/* ── Step 3: Socials & website ────────────────────────────────── */}
        {step === 3 && (
          <Card>
            <StepHeading>Online presence</StepHeading>
            <StepSub>
              Share your website and social profiles so we can verify your organisation.
              All fields are optional — add as many as you have.
            </StepSub>

            <FieldGroup label="Website" hint="Your organisation's main website, if you have one">
              <input
                data-testid="input-website"
                style={inputStyle}
                type="url"
                placeholder="https://yourorg.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                autoFocus
              />
            </FieldGroup>

            <div style={{ borderTop: "1px solid #f0ece4", margin: "24px 0 20px" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "20px 0 16px" }}>
                Social media
              </p>
            </div>

            <FieldGroup label="Instagram">
              <PrefixInput
                testId="input-instagram"
                prefix="instagram.com/"
                placeholder="yourorghandle"
                value={instagram}
                onChange={setInstagram}
              />
            </FieldGroup>

            <FieldGroup label="Facebook">
              <PrefixInput
                testId="input-facebook"
                prefix="facebook.com/"
                placeholder="YourOrgPage"
                value={facebook}
                onChange={setFacebook}
              />
            </FieldGroup>

            <FieldGroup label="X / Twitter">
              <PrefixInput
                testId="input-twitter"
                prefix="x.com/"
                placeholder="yourorghandle"
                value={twitter}
                onChange={setTwitter}
              />
            </FieldGroup>

            <FieldGroup label="LinkedIn">
              <PrefixInput
                testId="input-linkedin"
                prefix="linkedin.com/company/"
                placeholder="your-org-name"
                value={linkedin}
                onChange={setLinkedin}
              />
            </FieldGroup>

            {error && (
              <p data-testid="error-message" style={{ color: RED, fontSize: 14, marginTop: 8 }}>{error}</p>
            )}

            <NavButtons
              onBack={() => setStep(2)}
              nextLabel="Submit application"
              nextTestId="button-submit-application"
              loading={loading}
              onNext={handleSubmit}
            />
          </Card>
        )}

        {/* ── Step 4: Confirmation ─────────────────────────────────────── */}
        {step === 4 && (
          <Card>
            <div style={{ textAlign: "center" }}>
              <CheckCircle2 size={64} color="#22c55e" style={{ margin: "0 auto 20px" }} />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1a1a1a", marginBottom: 12 }}>
                Application submitted!
              </h2>
              <p style={{ fontSize: 15, color: "#555", lineHeight: 1.7, maxWidth: 440, margin: "0 auto 32px" }}>
                Thank you, <strong>{contactName}</strong>. We've sent a confirmation email to <strong>{email}</strong>.
                Our team will review <strong>{orgName}</strong>'s application and get back to you within 5 business days.
              </p>

              <div style={{ background: "#f9f6f0", borderRadius: 12, padding: "24px 28px", marginBottom: 32, textAlign: "left" }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>What happens next</p>
                {[
                  "Our team reviews your application against our eligibility criteria",
                  "You receive an acceptance or decline email within 5 business days",
                  "If approved, you receive instructions to access your organisation dashboard",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: RED_DEEP, color: GOLD, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <p style={{ margin: 0, fontSize: 14, color: "#444" }}>{item}</p>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 13, color: "#999", marginBottom: 24 }}>
                Questions? Email us at{" "}
                <a href="mailto:info@rootprojx.com" style={{ color: RED }}>info@rootprojx.com</a>
              </p>

              <button
                data-testid="button-back-to-home"
                onClick={() => setLocation("/")}
                style={{
                  background: RED_DEEP, color: "#fff", border: "none", borderRadius: 10,
                  padding: "12px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer",
                }}
              >
                Return to home
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
