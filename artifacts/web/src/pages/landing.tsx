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

      {/* Bottom links */}
      <div
        className="pb-16 flex flex-row items-center gap-5 text-sm text-center"
        style={{ color: "rgba(255,255,255,0.75)" }}
      >
        <Link href="/login">
          <span className="underline cursor-pointer hover:text-white/60 transition-colors">
            Sign in
          </span>
        </Link>
        <span className="opacity-40">·</span>
        <Link href="/register">
          <span className="underline cursor-pointer hover:text-white/60 transition-colors">
            Join
          </span>
        </Link>
      </div>
    </div>
  );
}
