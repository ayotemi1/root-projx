import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

function Path({ eyebrow, title, body, href, cta, testId }: {
  eyebrow: string; title: string; body: string; href: string; cta: string; testId: string;
}) {
  return (
    <div className="text-left">
      <p className="rp-label !text-[10px] text-white/80">{eyebrow}</p>
      <h2 className="mt-3 font-mono text-[15px] sm:text-[17px] font-medium uppercase tracking-[.1em] leading-snug text-white" style={{ fontFamily: "var(--app-font-mono)", fontStretch: "100%", fontVariationSettings: "normal" }}>
        {title}
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-white/90 max-w-[300px]">{body}</p>
      <Link href={href} className="mt-6 inline-flex items-center gap-2 text-white text-[14px] font-bold group" data-testid={testId}>
        <span className="rp-link-u">{cta}</span>
        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-[#CA0813] text-white flex flex-col items-center px-6">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[640px] text-center pt-16 pb-12">
        <img src="/logo-gold-v2.png" alt="Root ProjX" className="rp-rise h-32 sm:h-40 w-auto object-contain" />
        <h1 className="rp-rise rp-display mt-14 text-[48px] sm:text-[72px] leading-[.92]" style={{ animationDelay: ".08s" }}>
          Restoration.<br />Culture. Access.
        </h1>
        <p className="rp-rise mt-4 text-[15px] text-white/90" style={{ animationDelay: ".14s" }}>Support straight to the source.</p>
        <Link
          href="/feed"
          className="rp-rise rp-btn rp-btn-yellow mt-10 w-full max-w-[300px] h-[46px] border-[#F3BF2C]"
          style={{ animationDelay: ".2s" }}
          data-testid="button-enter"
        >
          Enter <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="w-full max-w-[640px] grid sm:grid-cols-2 gap-10 sm:gap-16 pb-16">
        <Path
          eyebrow="For supporters"
          title="Discover, follow and fund grassroots work."
          body="Create an account and give straight to verified organisations, starting in Jamaica."
          href="/register"
          cta="Join as a supporter"
          testId="link-register-supporter"
        />
        <Path
          eyebrow="For organisations"
          title="Receive funds and share your impact."
          body="Apply to list your organisation. Once verified, you can run campaigns and post updates."
          href="/onboarding"
          cta="Submit an application"
          testId="link-apply-organisation"
        />
      </div>

      <p className="pb-10 text-[13px] text-white/90">
        Already have an account?{" "}
        <Link href="/login" className="font-bold underline underline-offset-2 hover:text-[#F3BF2C]" data-testid="link-login">Sign in</Link>
      </p>
    </div>
  );
}
