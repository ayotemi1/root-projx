import { userErrorMessage } from "@/lib/error-feedback";
import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight } from "lucide-react";
import { ONBOARDING_INTERESTS_FLAG } from "@/pages/interests";
import "./register.css";

export default function RegisterPage() {
  const { register } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);

  const prefillEmail = params.get("email") ?? "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefillEmail);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name || !email || !password) {
      setError("Name, email and password are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      sessionStorage.setItem(ONBOARDING_INTERESTS_FLAG, "1");
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        accountType: "supporter",
      });
      navigate("/onboarding/interests");
    } catch (err: unknown) {
      sessionStorage.removeItem(ONBOARDING_INTERESTS_FLAG);
      setError(userErrorMessage(err, "create your account"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rpr-page">
      <div className="rpr-wrap rp-rise">
        <div className="rpr-brand">
          <img src="/logo-stylised.png" alt="Root ProjX" className="rpr-logo" />
          <p className="rpr-tag">CONNECTING DIASPORA WITH GRASSROOTS CHANGE.</p>
        </div>

        <h1 className="rpr-title"><span>JOIN THE</span><span>MOVEMENT</span></h1>
        <p className="rpr-intro">
          Become a supporter. Follow grassroots organisations, read their updates and see your impact in real time.
        </p>

        <form onSubmit={handleSubmit} className="rpr-form">
          {error && (
            <div className="rpr-error" data-testid="error-message">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="rpr-label">YOUR NAME</label>
            <input id="name" className="rpr-input" placeholder="Ava Morgan" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
          </div>
          <div>
            <label htmlFor="email" className="rpr-label">EMAIL</label>
            <input id="email" className="rpr-input" type="email" autoComplete="email" placeholder="ava@example.com" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-email" />
          </div>
          <div>
            <label htmlFor="phone" className="rpr-label">PHONE <em>(OPTIONAL)</em></label>
            <input id="phone" className="rpr-input" type="tel" placeholder="+44 7700 000000" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-phone" />
          </div>
          <div>
            <label htmlFor="password" className="rpr-label">PASSWORD</label>
            <input id="password" className="rpr-input" type="password" autoComplete="new-password" placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-password" />
          </div>

          <button type="submit" className="rpr-submit" disabled={loading} data-testid="button-submit-register">
            {loading ? "Creating account…" : "Create account"}
            {!loading && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
          </button>
        </form>

        <p className="rpr-foot">
          Already have an account?{" "}
          <Link href="/login" data-testid="link-login">Sign in</Link>
        </p>

        <div className="rpr-org">
          <p>Representing an organisation?</p>
          <Link href="/onboarding" data-testid="link-onboarding">
            Apply to join <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
