import { useState } from "react";
import { Link } from "wouter";
import * as api from "@/lib/api";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      await api.subscribeNewsletter({ email });
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center px-6"
      style={{ backgroundColor: "#CC0000" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm text-center gap-8 py-16">

        {/* Logo — hero element */}
        <img
          src="/logo-gold-v2.png"
          alt="Root ProjX"
          className="h-36 sm:h-48 w-auto object-contain"
        />

        {/* Tagline */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-light tracking-widest text-white uppercase">
            Restoration. Culture. Access.
          </h1>
          <p className="text-sm sm:text-base" style={{ color: "rgba(255,255,255,0.65)" }}>
            Support straight to the source.
          </p>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">

          {/* Newsletter */}
          {status === "done" ? (
            <p className="text-white font-medium py-3 text-sm">
              You're in. Welcome to the movement.
            </p>
          ) : (
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                required
                className="flex-1 min-w-0 px-4 py-3 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white outline-none focus:ring-2"
                style={{ "--tw-ring-color": "#F5C000" } as React.CSSProperties}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="px-5 py-3 rounded-lg text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-60 whitespace-nowrap shrink-0"
                style={{ backgroundColor: "#F5C000", color: "#111" }}
              >
                {status === "loading" ? "Joining…" : "Join the movement"}
              </button>
            </form>
          )}

          {status === "error" && (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
              {errorMsg}
            </p>
          )}

          {/* Donate */}
          <Link href="/discover">
            <button className="w-full px-5 py-3 rounded-lg text-sm font-bold border-2 border-white text-white transition-colors hover:bg-white/10">
              Donate to Root ProjX
            </button>
          </Link>
        </div>
      </div>

      {/* Bottom links */}
      <div
        className="pb-8 flex flex-col sm:flex-row items-center gap-2 sm:gap-5 text-xs text-center"
        style={{ color: "rgba(255,255,255,0.75)" }}
      >
        <span>
          Already have an account?{" "}
          <Link href="/login">
            <span className="underline cursor-pointer hover:text-white/60 transition-colors">
              Sign in
            </span>
          </Link>
        </span>
        <span className="hidden sm:block">·</span>
        <Link href="/feed">
          <span className="underline cursor-pointer hover:text-white/60 transition-colors">
            Explore the platform →
          </span>
        </Link>
      </div>
    </div>
  );
}
