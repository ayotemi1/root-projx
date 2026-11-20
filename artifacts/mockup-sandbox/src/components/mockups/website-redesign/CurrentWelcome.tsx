import "./_group.css";
import { MockupLink as Link } from "@/lib/mockup-link";

export function CurrentWelcome() {
  return (
    <div
      className="min-h-screen flex flex-col items-center px-6"
      style={{ backgroundColor: "#CC0000" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm text-center gap-8 py-16">

        {/* Logo */}
        <img
          src="/images/logo-gold-v2.png"
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

        {/* Enter */}
        <Link href="/discover" className="w-full">
          <button
            className="w-full py-4 rounded-xl text-lg font-extrabold tracking-wide transition-opacity hover:opacity-90 active:scale-95"
            style={{ backgroundColor: "#F5C000", color: "#111" }}
            data-testid="button-enter"
          >
            Enter
          </button>
        </Link>

      </div>

      {/* Bottom join links */}
      <div className="pb-14 w-full max-w-sm flex flex-col items-stretch gap-4">
        <div className="bg-white/10 rounded-2xl p-5 border border-white/20 text-left">
          <h3 className="text-white font-bold mb-1">For Supporters</h3>
          <p className="text-white/70 text-sm mb-4">Create an account to discover, follow, and fund grassroots work immediately.</p>
          <Link href="/register" className="w-full">
            <button
              className="w-full py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all hover:bg-white hover:text-black border border-white text-white"
              data-testid="link-register-supporter"
            >
              Join as a supporter
            </button>
          </Link>
        </div>

        <div className="bg-black/20 rounded-2xl p-5 border border-black/10 text-left">
          <h3 className="text-white font-bold mb-1">For Organisations</h3>
          <p className="text-white/70 text-sm mb-4">Apply to list your organisation, receive funds, and share your impact.</p>
          <Link href="/onboarding" className="w-full">
            <button
              className="w-full py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all bg-black/40 hover:bg-black/60 text-white"
              data-testid="link-apply-organisation"
            >
              Submit an application
            </button>
          </Link>
        </div>

        <div className="mt-4 text-center">
          <Link href="/login">
            <span
              className="text-sm cursor-pointer transition-colors"
              style={{ color: "rgba(255,255,255,0.7)" }}
              data-testid="link-login"
            >
              Already have an account? <span className="text-white font-semibold underline underline-offset-2 hover:text-[#F5C000]">Sign in</span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
