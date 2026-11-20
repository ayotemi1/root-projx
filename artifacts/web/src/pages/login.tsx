import { userErrorMessage } from "@/lib/error-feedback";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Email and password are required."); return; }
    setLoading(true);
    setError("");
    try {
      const loggedInUser = await login(email.trim().toLowerCase(), password);
      if (loggedInUser.accountType === "organisation") {
        navigate("/dashboard");
      } else {
        navigate("/feed");
      }
    } catch (err: unknown) {
      setError(userErrorMessage(err, "sign in"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] flex flex-col items-center px-5 py-14 sm:py-16">
      <div className="text-center rp-rise">
        <img src="/logo-stylised.png" alt="Root ProjX" className="h-20 sm:h-24 w-auto object-contain mx-auto" />
        <p className="rp-label !text-[10px] sm:!text-[11px] mt-5 text-[#17100F]/80">Connecting diaspora with grassroots change.</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-[328px] mt-10 rp-rise" style={{ animationDelay: ".08s" }} noValidate>
        <h1 className="rp-display text-[52px] sm:text-[60px] text-[#17100F]">Sign in</h1>

        {error && (
          <div className="mt-5 border-l-4 border-[#CA0813] bg-[#CA0813]/8 text-[#8E050D] px-3 py-2 text-sm" role="alert" data-testid="text-login-error">
            {error}
          </div>
        )}

        <label htmlFor="email" className="rp-label block mt-6 mb-2 text-[#17100F]">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rp-field placeholder:text-[#17100F]/45"
          data-testid="input-email"
        />

        <div className="flex items-center justify-between mt-5 mb-2">
          <label htmlFor="password" className="rp-label text-[#17100F]">Password</label>
          <Link href="/forgot-password" className="text-[11px] font-bold text-[#CA0813] underline underline-offset-2" data-testid="link-forgot-password">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rp-field pr-12"
            data-testid="input-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center text-[#17100F]/75 hover:text-[#17100F]"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            data-testid="button-toggle-password"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <button type="submit" disabled={loading} className="rp-btn rp-btn-yellow w-full mt-6 h-12 border-[#F3BF2C]" data-testid="button-sign-in">
          {loading ? "Signing in…" : <>Sign in <ArrowRight className="w-4 h-4" /></>}
        </button>

        <p className="text-center text-[13px] mt-8 text-[#17100F]/80">
          Don't have an account?{" "}
          <Link href="/register" className="rp-link-u text-[#17100F]" data-testid="link-register">Create one</Link>
        </p>
      </form>
    </div>
  );
}
