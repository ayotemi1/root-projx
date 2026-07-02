import { Link } from "wouter";

export default function LandingPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center px-6"
      style={{ backgroundColor: "#CC0000" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm text-center gap-8 py-16">

        {/* Logo */}
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

        {/* Enter — goes straight to Discover, no signup gate */}
        <Link href="/discover" className="w-full">
          <button
            className="w-full py-4 rounded-xl text-lg font-extrabold tracking-wide transition-opacity hover:opacity-90 active:scale-95"
            style={{ backgroundColor: "#F5C000", color: "#111" }}
          >
            Enter
          </button>
        </Link>

      </div>

      {/* Bottom join links */}
      <div className="pb-14 w-full max-w-sm flex flex-col items-center gap-3">
        <Link href="/onboarding" className="w-full">
          <button
            className="w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-opacity hover:opacity-90 active:scale-95 border-2"
            style={{ borderColor: "rgba(255,255,255,0.55)", color: "#fff", background: "transparent" }}
          >
            Join as an organisation
          </button>
        </Link>
        <Link href="/register" className="w-full">
          <button
            className="w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-opacity hover:opacity-90 active:scale-95 border-2"
            style={{ borderColor: "rgba(255,255,255,0.55)", color: "#fff", background: "transparent" }}
          >
            Join as supporter
          </button>
        </Link>
        <Link href="/login">
          <span className="text-xs cursor-pointer transition-colors" style={{ color: "rgba(255,255,255,0.45)" }}>
            Already have an account? <span className="underline">Sign in</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
