import { appFetch as fetch, userErrorMessage } from "@/lib/error-feedback";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { COUNTRIES } from "@/lib/countries";
import "./onboarding.css";

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

// 1 = org details, 2 = sectors, 3 = socials, 4 = complete
const TOTAL_STEPS = 3;
const STEP_NAMES = ["", "Your organisation", "Your work", "Online presence"];

function StepHeader({ step }: { step: number }) {
  return (
    <>
      <div className="rpo-step" data-testid="text-step-indicator">
        <span>Step {step} of {TOTAL_STEPS}</span>
        <span>{STEP_NAMES[step]}</span>
      </div>
      <div className="rpo-bar" aria-hidden="true">
        <i style={{ width: `${Math.round((step / TOTAL_STEPS) * 100)}%` }} />
      </div>
    </>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rpo-field">
      <label className="rpo-label" htmlFor={id}>{label}</label>
      {hint && <small className="rpo-hint" id={`${id}-hint`}>{hint}</small>}
      {children}
    </div>
  );
}

function PrefixInput({
  id, prefix, placeholder, value, onChange, testId,
}: {
  id: string; prefix: string; placeholder: string; value: string; onChange: (v: string) => void; testId?: string;
}) {
  return (
    <div className="rpo-pre">
      <span aria-hidden="true">{prefix}</span>
      <input
        id={id}
        data-testid={testId}
        className="rpo-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [orgName, setOrgName] = useState("");
  const [country, setCountry] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [sectors, setSectors] = useState<string[]>([]);

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
          country,
          contactName,
          email: email.trim().toLowerCase(),
          password,
          sectors,
          website: website.trim() || undefined,
          socialLinks,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(userErrorMessage({ message: data.error, status: res.status }, "submit your organisation application"));
        setLoading(false);
        return;
      }
      setStep(4);
    } catch (error) {
      setError(userErrorMessage(error, "confirm your organisation application was submitted"));
    } finally {
      setLoading(false);
    }
  }

  const step1Disabled = !orgName.trim() || !country || !contactName.trim() || !email.trim() || !email.includes("@") || password.length < 6 || password !== confirmPassword;
  const mismatch = !!confirmPassword && password !== confirmPassword;

  return (
    <div className="rpo">
      <header className="rpo-top">
        <img src="/logo-gold-v2.png" alt="Root ProjX" />
      </header>

      <main className="rpo-main">
        {step === 1 && (
          <section className="rpo-box" key="s1">
            <StepHeader step={1} />
            <h1>Apply as an organisation</h1>
            <p className="rpo-intro">Tell us about your organisation. We review every application and reply within 5 working days.</p>

            <Field id="org-name" label="Organisation name">
              <input id="org-name" data-testid="input-org-name" className="rpo-input" type="text"
                placeholder="e.g. Kingston Youth Foundation" value={orgName}
                onChange={(e) => setOrgName(e.target.value)} autoFocus />
            </Field>

            <Field id="country" label="Country" hint="Where your organisation is based">
              <select id="country" aria-describedby="country-hint" data-testid="select-country" className="rpo-input"
                style={{ cursor: "pointer" }} value={country} onChange={(e) => setCountry(e.target.value)} required>
                <option value="" disabled>Select a country</option>
                {COUNTRIES.map(({ value }) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </Field>

            <Field id="contact-name" label="Your name" hint="The main point of contact">
              <input id="contact-name" aria-describedby="contact-name-hint" data-testid="input-contact-name" className="rpo-input"
                type="text" placeholder="e.g. Maria Campbell" value={contactName}
                onChange={(e) => setContactName(e.target.value)} />
            </Field>

            <Field id="email" label="Email address">
              <input id="email" data-testid="input-email" className="rpo-input" type="email"
                placeholder="e.g. hello@yourorg.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>

            <Field id="password" label="Create a password" hint="At least 6 characters">
              <input id="password" aria-describedby="password-hint" data-testid="input-password" className="rpo-input"
                type="password" autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} />
            </Field>

            <Field id="confirm-password" label="Confirm password">
              <input id="confirm-password" data-testid="input-confirm-password" className="rpo-input" type="password"
                autoComplete="new-password" value={confirmPassword} aria-invalid={mismatch || undefined}
                onChange={(e) => setConfirmPassword(e.target.value)} />
            </Field>

            {mismatch && (
              <p data-testid="error-password-match" className="rpo-err" role="alert">Passwords do not match.</p>
            )}
            {error && <p data-testid="error-message" className="rpo-err" role="alert">{error}</p>}

            <div className="rpo-acts">
              <span className="rpo-small">
                Already applied? <Link href="/login" data-testid="link-sign-in">Sign in</Link>
              </span>
              <button type="button" className="rpo-btn" data-testid="button-next-step1"
                disabled={step1Disabled} onClick={() => { setError(""); setStep(2); }}>
                Next
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="rpo-box" key="s2">
            <StepHeader step={2} />
            <h1>What sectors do you work in?</h1>
            <p className="rpo-intro">Choose all that apply.</p>

            <div className="rpo-chips" role="group" aria-label="Sectors">
              {SECTORS.map((s) => {
                const selected = sectors.includes(s);
                return (
                  <button type="button" key={s} className="rpo-chip" aria-pressed={selected}
                    data-testid={`button-sector-${s.replace(/[^a-z0-9]/gi, '').toLowerCase()}`}
                    onClick={() => toggleSector(s)}>
                    {s}
                  </button>
                );
              })}
            </div>

            {error && <p data-testid="error-message" className="rpo-err" role="alert">{error}</p>}

            <div className="rpo-acts">
              <button type="button" className="rpo-back" data-testid="button-back" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="rpo-btn" data-testid="button-next-step2"
                disabled={sectors.length === 0} onClick={() => { setError(""); setStep(3); }}>
                Next
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="rpo-box" key="s3">
            <StepHeader step={3} />
            <h1>Online presence</h1>
            <p className="rpo-intro">Your website and social pages help us verify you. All optional.</p>

            <Field id="website" label="Website" hint="Your organisation's main website, if you have one">
              <input id="website" aria-describedby="website-hint" data-testid="input-website" className="rpo-input"
                type="url" placeholder="https://yourorg.com" value={website}
                onChange={(e) => setWebsite(e.target.value)} autoFocus />
            </Field>

            <Field id="instagram" label="Instagram">
              <PrefixInput id="instagram" testId="input-instagram" prefix="instagram.com/" placeholder="yourorghandle" value={instagram} onChange={setInstagram} />
            </Field>
            <Field id="facebook" label="Facebook">
              <PrefixInput id="facebook" testId="input-facebook" prefix="facebook.com/" placeholder="YourOrgPage" value={facebook} onChange={setFacebook} />
            </Field>
            <Field id="twitter" label="X / Twitter">
              <PrefixInput id="twitter" testId="input-twitter" prefix="x.com/" placeholder="yourorghandle" value={twitter} onChange={setTwitter} />
            </Field>
            <Field id="linkedin" label="LinkedIn">
              <PrefixInput id="linkedin" testId="input-linkedin" prefix="linkedin.com/company/" placeholder="your-org-name" value={linkedin} onChange={setLinkedin} />
            </Field>

            {error && <p data-testid="error-message" className="rpo-err" role="alert">{error}</p>}

            <div className="rpo-acts">
              <button type="button" className="rpo-back" data-testid="button-back" onClick={() => setStep(2)}>Back</button>
              <button type="button" className="rpo-btn" data-testid="button-submit-application"
                disabled={loading} onClick={handleSubmit}>
                {loading ? "Submitting…" : "Submit application"}
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="rpo-box rpo-done" key="s4">
            <div className="rpo-tk" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </div>
            <h1>Application submitted</h1>
            <p className="rpo-lead" data-testid="text-confirmation">
              Thank you, <b>{contactName}</b>. Your account is ready and we’ve sent a confirmation email to <b>{email}</b>.
              {" "}We’ll review <b>{orgName}</b>’s application and get back to you within 5 working days.
            </p>
            <div className="rpo-nx">
              <div className="rpo-nh">What happens next</div>
              <ol>
                {[
                  "Our team reviews your application against our eligibility criteria",
                  "You receive an approval or decline email within 5 working days",
                  "You can sign in now, but organisation tools stay locked until approval",
                ].map((item, i) => (
                  <li key={i}><span>{i + 1}</span>{item}</li>
                ))}
              </ol>
            </div>
            <p className="rpo-small">
              Questions? Email us at{" "}
              <a href="mailto:info@rootprojx.com" style={{ color: "var(--red)", fontWeight: 700 }}>info@rootprojx.com</a>
            </p>
            <button type="button" className="rpo-btn" data-testid="button-back-to-home" onClick={() => setLocation("/")}>
              Return to home
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
