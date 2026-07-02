import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { CheckCircle2, ChevronRight, ChevronLeft, ArrowRight } from "lucide-react";

const RED_DEEP = "#7A0000";
const RED = "#B50000";
const GOLD = "#F5B800";

const CATEGORIES = [
  "Education", "Health & Wellbeing", "Environment", "Community Development",
  "Arts & Culture", "Economic Empowerment", "Youth", "Sport & Recreation",
  "Housing & Homelessness", "Faith & Spirituality", "Other",
];

const COUNTRIES = [
  "Jamaica", "United Kingdom", "United States", "Canada", "Trinidad and Tobago",
  "Barbados", "Guyana", "Grenada", "St Lucia", "Antigua and Barbuda",
  "Bahamas", "Belize", "Dominica", "Haiti", "Nigeria", "Ghana",
  "Kenya", "South Africa", "Other",
];

const YEARS_OPTIONS = [
  "Less than 1 year", "1–3 years", "3–5 years", "5–10 years", "Over 10 years",
];

const TOTAL_FORM_STEPS = 6;

function ProgressBar({ step }: { step: number }) {
  const pct = Math.round(((step - 1) / TOTAL_FORM_STEPS) * 100);
  return (
    <div style={{ height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2 }}>
      <div
        style={{
          height: "100%", background: GOLD, borderRadius: 2,
          width: `${pct}%`, transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

function TopBar({ step }: { step: number }) {
  const isWelcome = step === 0;
  const isDone = step === 7;
  return (
    <div style={{ background: RED_DEEP, padding: "14px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isWelcome || isDone ? 0 : 10 }}>
          <img src="/logo-stylised.png" alt="Root ProjX" style={{ height: 36, objectFit: "contain" }} />
          {!isWelcome && !isDone && (
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              Step {step} of {TOTAL_FORM_STEPS}
            </span>
          )}
        </div>
        {!isWelcome && !isDone && <ProgressBar step={step} />}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
      padding: "40px 48px", width: "100%",
    }}>
      {children}
    </div>
  );
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: RED, textTransform: "uppercase", marginBottom: 8 }}>
      {children}
    </p>
  );
}

function StepHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1a1a1a", marginBottom: 24, lineHeight: 1.3 }}>
      {children}
    </h2>
  );
}

function FieldGroup({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>
        {label}
        {optional && <span style={{ fontWeight: 400, color: "#999", marginLeft: 4 }}>(optional)</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", fontSize: 15, border: "1.5px solid #e0d8cc",
  borderRadius: 8, outline: "none", background: "#fafaf8", boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle, minHeight: 100, resize: "vertical", lineHeight: 1.6,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: "none", cursor: "pointer",
};

function NavButtons({
  onBack, onNext, nextLabel = "Continue", nextDisabled = false, loading = false,
  hideBack = false,
}: {
  onBack?: () => void; onNext?: () => void; nextLabel?: string;
  nextDisabled?: boolean; loading?: boolean; hideBack?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32 }}>
      {!hideBack && onBack ? (
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "1.5px solid #e0d8cc", borderRadius: 8,
            padding: "9px 18px", fontSize: 14, fontWeight: 600, color: "#666",
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={16} /> Back
        </button>
      ) : <span />}
      <button
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
        {loading ? "Saving…" : nextLabel}
        {!loading && <ChevronRight size={16} />}
      </button>
    </div>
  );
}

function LegalSection({
  title, children, agreed, onAgree, agreeLabel, onBack, onNext, loading,
}: {
  title: string; children: React.ReactNode; agreed: boolean;
  onAgree: (v: boolean) => void; agreeLabel: string;
  onBack: () => void; onNext: () => void; loading?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canAgree, setCanAgree] = useState(false);

  useEffect(() => {
    setCanAgree(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [title]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 40) setCanAgree(true);
  }

  return (
    <>
      <StepHeading>{title}</StepHeading>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          maxHeight: 340, overflowY: "auto", border: "1.5px solid #e0d8cc",
          borderRadius: 10, padding: "20px 24px", background: "#fafaf8",
          fontSize: 14, lineHeight: 1.8, color: "#333",
        }}
      >
        {children}
        {!canAgree && (
          <p style={{ textAlign: "center", color: "#aaa", fontSize: 13, marginTop: 12 }}>
            ↓ Scroll to continue
          </p>
        )}
      </div>
      <label
        style={{
          display: "flex", alignItems: "flex-start", gap: 12, marginTop: 20,
          cursor: canAgree ? "pointer" : "not-allowed", opacity: canAgree ? 1 : 0.4,
        }}
      >
        <input
          type="checkbox"
          checked={agreed}
          disabled={!canAgree}
          onChange={(e) => canAgree && onAgree(e.target.checked)}
          style={{ marginTop: 2, accentColor: RED, width: 18, height: 18, flexShrink: 0 }}
        />
        <span style={{ fontSize: 14, color: "#333" }}>{agreeLabel}</span>
      </label>
      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!agreed}
        loading={loading}
        nextLabel="I agree, continue"
      />
    </>
  );
}

export default function OnboardingPage() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Form data
  const [orgName, setOrgName] = useState(params.get("org") ?? "");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState(params.get("country") ?? "");
  const [city, setCity] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [description, setDescription] = useState("");
  const [mission, setMission] = useState("");
  const [whoYouServe, setWhoYouServe] = useState("");
  const [yearsOperating, setYearsOperating] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [twitter, setTwitter] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedMou, setAgreedMou] = useState(false);
  const [mouName, setMouName] = useState(params.get("cn") ?? user?.name ?? "");
  const [mouDate] = useState(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));

  useEffect(() => {
    if (user?.name && !mouName) setMouName(user.name);
  }, [user]);

  // Redirect if org profile already exists
  useEffect(() => {
    if (user?.accountType === "organisation" && token) {
      api.getOrg(user.id).then((org) => {
        if (org?.category) navigate("/org-dashboard");
      }).catch(() => {});
    }
  }, [user, token]);

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const socialLinks: Record<string, string> = {};
      if (instagram) socialLinks["instagram"] = instagram;
      if (facebook) socialLinks["facebook"] = facebook;
      if (twitter) socialLinks["twitter"] = twitter;

      await api.createOrgProfile({
        name: orgName,
        country,
        city: city || undefined,
        category,
        description,
        mission: mission || undefined,
        whoYouServe: whoYouServe || undefined,
        yearsOperating: yearsOperating || undefined,
        registrationNumber: regNumber || undefined,
        contact: website ? { website } : undefined,
        socialLinks: Object.keys(socialLinks).length ? socialLinks : undefined,
      }, token);
      setStep(7);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  return (
    <div style={{ minHeight: "100vh", background: "#F9F6F0", display: "flex", flexDirection: "column" }}>
      <TopBar step={step} />

      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "48px 24px 80px" }}>
        <div style={{ width: "100%", maxWidth: 680 }}>

          {/* ── STEP 0: WELCOME ───────────────────────────────────────────── */}
          {step === 0 && (
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  background: RED_DEEP, borderRadius: 20, padding: "64px 48px",
                  marginBottom: 32, color: "#fff",
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: GOLD, textTransform: "uppercase", marginBottom: 16 }}>
                  Partner Onboarding
                </p>
                <h1 style={{ fontSize: 36, fontWeight: 900, margin: "0 0 24px", lineHeight: 1.2 }}>
                  Welcome to Root ProjX
                </h1>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: "rgba(255,255,255,0.85)", maxWidth: 480, margin: "0 auto 32px" }}>
                  Thank you for your interest in becoming a Root ProjX partner. We're a
                  community-powered platform connecting grassroots organisations with
                  visibility, fundraising opportunities and meaningful support.
                </p>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.75)", maxWidth: 480, margin: "0 auto 40px" }}>
                  This onboarding pack has been designed to make joining simple and
                  transparent. We'll collect some details about your organisation, then
                  ask you to review and agree to a few short documents.
                </p>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 32, fontStyle: "italic", color: GOLD, fontSize: 17 }}>
                  "Together, we can grow roots of change."
                </div>
              </div>
              <button
                onClick={next}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  background: RED, color: "#fff", border: "none", borderRadius: 10,
                  padding: "15px 40px", fontSize: 16, fontWeight: 700, cursor: "pointer",
                }}
              >
                Begin <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* ── STEP 1: ORGANISATION IDENTITY ─────────────────────────────── */}
          {step === 1 && (
            <Card>
              <StepLabel>Section 1 of 3 — Organisation Details</StepLabel>
              <StepHeading>Tell us about your organisation</StepHeading>

              <FieldGroup label="Organisation name">
                <input
                  style={inputStyle} value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Trench Town Futures"
                />
              </FieldGroup>

              <FieldGroup label="Category — what type of work do you do?">
                <select style={selectStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Select a category…</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </FieldGroup>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FieldGroup label="Country of operation">
                  <select style={selectStyle} value={country} onChange={(e) => setCountry(e.target.value)}>
                    <option value="">Select country…</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FieldGroup>
                <FieldGroup label="City / Town" optional>
                  <input
                    style={inputStyle} value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Kingston"
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="Charity / registration number" optional>
                <input
                  style={inputStyle} value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="e.g. 1234567"
                />
              </FieldGroup>

              <NavButtons
                hideBack
                onNext={next}
                nextDisabled={!orgName.trim() || !category || !country}
              />
            </Card>
          )}

          {/* ── STEP 2: YOUR WORK ─────────────────────────────────────────── */}
          {step === 2 && (
            <Card>
              <StepLabel>Section 2 of 3 — Your Work</StepLabel>
              <StepHeading>Tell us about the work you do</StepHeading>

              <FieldGroup label="Describe your organisation's work">
                <textarea
                  style={textareaStyle} value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe what your organisation does and the community you serve…"
                />
              </FieldGroup>

              <FieldGroup label="Mission statement" optional>
                <textarea
                  style={{ ...textareaStyle, minHeight: 80 }} value={mission}
                  onChange={(e) => setMission(e.target.value)}
                  placeholder="e.g. To empower young people in West Kingston through education and mentorship."
                />
              </FieldGroup>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FieldGroup label="Who do you primarily serve?" optional>
                  <input
                    style={inputStyle} value={whoYouServe}
                    onChange={(e) => setWhoYouServe(e.target.value)}
                    placeholder="e.g. Young people aged 14–25"
                  />
                </FieldGroup>
                <FieldGroup label="How long have you been operating?" optional>
                  <select style={selectStyle} value={yearsOperating} onChange={(e) => setYearsOperating(e.target.value)}>
                    <option value="">Select…</option>
                    {YEARS_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </FieldGroup>
              </div>

              <NavButtons
                onBack={back} onNext={next}
                nextDisabled={!description.trim()}
              />
            </Card>
          )}

          {/* ── STEP 3: CONTACT & LINKS ───────────────────────────────────── */}
          {step === 3 && (
            <Card>
              <StepLabel>Section 3 of 3 — Contact & Online Presence</StepLabel>
              <StepHeading>How can supporters find you?</StepHeading>

              <FieldGroup label="Website" optional>
                <input
                  style={inputStyle} value={website} type="url"
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourorg.org"
                />
              </FieldGroup>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FieldGroup label="Instagram" optional>
                  <input
                    style={inputStyle} value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="@yourhandle"
                  />
                </FieldGroup>
                <FieldGroup label="Facebook" optional>
                  <input
                    style={inputStyle} value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    placeholder="facebook.com/yourpage"
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="X / Twitter" optional>
                <input
                  style={inputStyle} value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="@yourhandle"
                />
              </FieldGroup>

              <NavButtons onBack={back} onNext={next} />
            </Card>
          )}

          {/* ── STEP 4: TERMS & CONDITIONS ───────────────────────────────── */}
          {step === 4 && (
            <Card>
              <StepLabel>Legal — Step 1 of 3</StepLabel>
              <LegalSection
                title="Terms & Conditions"
                agreed={agreedTerms}
                onAgree={setAgreedTerms}
                agreeLabel="I have read and agree to the Root ProjX Terms & Conditions."
                onBack={back}
                onNext={next}
              >
                <p>These Terms & Conditions govern your organisation's use of the Root ProjX platform.</p>
                <br />
                <p><strong>1. Eligibility</strong><br />Organisations must have a genuine community purpose and provide accurate registration information.</p>
                <br />
                <p><strong>2. Accuracy of Information</strong><br />All information supplied must be true and kept up to date.</p>
                <br />
                <p><strong>3. Campaigns</strong><br />Campaigns must accurately describe how donations will be used. Root ProjX may request clarification or supporting evidence.</p>
                <br />
                <p><strong>4. Donations & Fees</strong><br />A 5% platform fee is deducted before funds are transferred to the organisation.</p>
                <br />
                <p><strong>5. Campaign Updates</strong><br />Organisations agree to provide reasonable updates on funded campaigns so donors can see the impact created.</p>
                <br />
                <p><strong>6. Suspension</strong><br />Root ProjX reserves the right to pause or remove campaigns that contain misleading information or breach these terms.</p>
                <br />
                <p><strong>7. Intellectual Property</strong><br />Organisations retain ownership of their content while granting Root ProjX permission to display submitted material to promote campaigns and the platform.</p>
                <br />
                <p><strong>8. Acceptance</strong><br />Submitting a registration confirms acceptance of these Terms & Conditions.</p>
              </LegalSection>
            </Card>
          )}

          {/* ── STEP 5: PRIVACY POLICY ───────────────────────────────────── */}
          {step === 5 && (
            <Card>
              <StepLabel>Legal — Step 2 of 3</StepLabel>
              <LegalSection
                title="Privacy Policy"
                agreed={agreedPrivacy}
                onAgree={setAgreedPrivacy}
                agreeLabel="I have read and understand the Root ProjX Privacy Policy."
                onBack={back}
                onNext={next}
              >
                <p>Root ProjX respects your privacy and is committed to protecting your information.</p>
                <br />
                <p><strong>Information we collect</strong><br />Organisation details, contact information, campaign information, uploaded media and supporting documents.</p>
                <br />
                <p><strong>Why we collect it</strong><br />For verification, communication, platform administration and safeguarding purposes.</p>
                <br />
                <p><strong>How information is stored</strong><br />In secure systems with access limited to authorised personnel only.</p>
                <br />
                <p><strong>Information sharing</strong><br />Your information is never sold. Public campaign information may be displayed on the platform where relevant to promote your work.</p>
                <br />
                <p><strong>Your rights</strong><br />You may request access, correction or deletion of your data where legally applicable.</p>
                <br />
                <p><strong>Contact us</strong><br />Email: info@rootprojx.com<br />Website: www.rootprojx.com</p>
              </LegalSection>
            </Card>
          )}

          {/* ── STEP 6: MOU ──────────────────────────────────────────────── */}
          {step === 6 && (
            <Card>
              <StepLabel>Legal — Step 3 of 3</StepLabel>
              <StepHeading>Memorandum of Understanding</StepHeading>
              <div
                style={{
                  maxHeight: 260, overflowY: "auto", border: "1.5px solid #e0d8cc",
                  borderRadius: 10, padding: "20px 24px", background: "#fafaf8",
                  fontSize: 14, lineHeight: 1.8, color: "#333", marginBottom: 24,
                }}
              >
                <p>This Memorandum of Understanding sets out the shared intentions between Root ProjX and the Partner Organisation. It reflects a commitment to collaboration, transparency and community impact.</p>
                <br />
                <p><strong>Root ProjX will:</strong></p>
                <ul style={{ paddingLeft: 20 }}>
                  <li>Provide access to the platform.</li>
                  <li>Promote approved campaigns where appropriate.</li>
                  <li>Communicate openly and professionally.</li>
                  <li>Support partners throughout the fundraising journey where possible.</li>
                </ul>
                <br />
                <p><strong>Partner Organisation will:</strong></p>
                <ul style={{ paddingLeft: 20 }}>
                  <li>Provide accurate information.</li>
                  <li>Use funds for the stated campaign purposes.</li>
                  <li>Keep supporters informed through campaign updates.</li>
                  <li>Notify Root ProjX of any significant organisational changes.</li>
                </ul>
                <br />
                <p><em>This MoU reflects the spirit of partnership and does not replace any legal obligations required under applicable law.</em></p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <FieldGroup label="Your full name">
                  <input
                    style={inputStyle} value={mouName}
                    onChange={(e) => setMouName(e.target.value)}
                    placeholder="Full name"
                  />
                </FieldGroup>
                <FieldGroup label="Date">
                  <input style={{ ...inputStyle, background: "#f0ece4", color: "#666" }} value={mouDate} readOnly />
                </FieldGroup>
              </div>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                <input
                  type="checkbox" checked={agreedMou}
                  onChange={(e) => setAgreedMou(e.target.checked)}
                  style={{ marginTop: 2, accentColor: RED, width: 18, height: 18, flexShrink: 0 }}
                />
                <span style={{ fontSize: 14, color: "#333" }}>
                  I agree to the terms of this Memorandum of Understanding on behalf of my organisation.
                </span>
              </label>

              {submitError && (
                <p style={{ color: RED, fontSize: 14, marginTop: 16, background: "#fff0f0", padding: "10px 14px", borderRadius: 8 }}>
                  {submitError}
                </p>
              )}

              <NavButtons
                onBack={back}
                onNext={handleSubmit}
                nextDisabled={!agreedMou || !mouName.trim()}
                loading={submitting}
                nextLabel="Submit & complete"
              />
            </Card>
          )}

          {/* ── STEP 7: COMPLETE ─────────────────────────────────────────── */}
          {step === 7 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ background: RED_DEEP, borderRadius: 20, padding: "64px 48px", color: "#fff" }}>
                <CheckCircle2 size={64} style={{ color: GOLD, margin: "0 auto 24px" }} />
                <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 16px" }}>
                  You're all set!
                </h1>
                <p style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(255,255,255,0.85)", maxWidth: 460, margin: "0 auto 16px" }}>
                  Welcome to the Root ProjX family. Your organisation profile has been created
                  and is pending verification.
                </p>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", maxWidth: 440, margin: "0 auto 40px" }}>
                  Our team will review your application and be in touch. In the meantime,
                  you can set up your profile, create campaigns and start sharing your story.
                </p>
                <button
                  onClick={() => navigate("/org-dashboard")}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 10,
                    background: GOLD, color: RED_DEEP, border: "none", borderRadius: 10,
                    padding: "15px 40px", fontSize: 16, fontWeight: 800, cursor: "pointer",
                  }}
                >
                  Go to your dashboard <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
