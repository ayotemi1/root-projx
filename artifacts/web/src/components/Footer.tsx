import { userErrorMessage } from "@/lib/error-feedback";
import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import * as api from "@/lib/api";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setStatus("loading");
    try {
      await api.subscribeNewsletter({ email });
      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(userErrorMessage(err, "subscribe to the newsletter"));
    }
  }

  const linkCls = "text-[#F4EFE6]/75 hover:text-[#F3BF2C] transition-colors";

  return (
    <footer className="bg-[#17100F] text-[#F4EFE6] mt-20">
      <div className="rp-page-shell py-14 grid md:grid-cols-[1.1fr_1fr] gap-8 items-end border-b border-[#F4EFE6]/15">
        <div>
          <p className="rp-label text-[#F3BF2C] mb-3">Newsletter</p>
          <h2 className="rp-display text-[44px] sm:text-[56px]">Stay connected<br />to the cause</h2>
          <p className="mt-4 text-base text-[#F4EFE6]/70 max-w-md">
            Get impact updates, new organisations, and community news — straight to your inbox.
          </p>
        </div>
        <div>
          {status === "success" ? (
            <p className="inline-flex items-center gap-2 border border-[#F3BF2C] text-[#F3BF2C] px-4 py-3 text-sm font-bold" role="status" data-testid="status-newsletter-success">
              <Check className="w-4 h-4" /> You're subscribed. Thank you.
            </p>
          ) : (
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-0">
              <label htmlFor="footer-email" className="sr-only">Email address</label>
              <input
                id="footer-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
                placeholder="Email address"
                required
                className="flex-1 h-12 px-4 bg-transparent border border-[#F4EFE6]/40 text-[#F4EFE6] placeholder:text-[#F4EFE6]/45 focus:outline-none focus:border-[#F3BF2C] text-sm"
                data-testid="input-newsletter-email"
              />
              <button
                type="submit"
                disabled={status === "loading" || !email}
                className="rp-btn rp-btn-yellow h-12 border-[#F3BF2C] whitespace-nowrap"
                data-testid="button-newsletter-subscribe"
              >
                {status === "loading" ? "Subscribing…" : <>Subscribe <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}
          {status === "error" && <p className="mt-3 text-sm text-[#F3BF2C]" role="alert">{errorMsg}</p>}
        </div>
      </div>

      <div className="rp-page-shell py-10 grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr] gap-8 text-base">
        <div className="col-span-2 sm:col-span-1">
          <img src="/logo-gold-v2.png" alt="Root ProjX" className="h-12 w-auto mb-3" />
          <p className="text-[#F4EFE6]/65 max-w-xs leading-relaxed">
            Connecting the diaspora to verified grassroots organisations in Jamaica, the UK, and beyond.
          </p>
        </div>
        <div>
          <p className="rp-label text-[#F3BF2C] mb-3">Platform</p>
          <ul className="space-y-2">
            <li><Link href="/discover" className={linkCls}>Discover organisations</Link></li>
            <li><Link href="/feed" className={linkCls}>Live feed</Link></li>
            <li><Link href="/about" className={linkCls}>About Root ProjX</Link></li>
            <li><Link href="/help" className={linkCls}>Get help directory</Link></li>
          </ul>
        </div>
        <div>
          <p className="rp-label text-[#F3BF2C] mb-3">Account</p>
          <ul className="space-y-2">
            <li><Link href="/register" className={linkCls} data-testid="footer-link-join">Join as supporter</Link></li>
            <li><Link href="/onboarding" className={linkCls} data-testid="footer-link-apply">Apply as organisation</Link></li>
            <li><Link href="/login" className={linkCls} data-testid="footer-link-login">Sign in</Link></li>
            <li><Link href="/account" className={linkCls}>My account</Link></li>
          </ul>
        </div>
      </div>

      <div className="rp-page-shell py-6 border-t border-[#F4EFE6]/15 flex flex-col sm:flex-row justify-between gap-3 rp-label !text-[12px] text-[#F4EFE6]/55">
        <span>
          &copy; {new Date().getFullYear()} Root ProjX Ltd · Secured by Stripe · ICO registered ZC152619
        </span>
        <span className="flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:text-[#F3BF2C]">Privacy</Link>
          <Link href="/terms" className="hover:text-[#F3BF2C]">Fundraising terms</Link>
          <Link href="/support" className="hover:text-[#F3BF2C]">Support</Link>
          <a href="mailto:info@rootprojx.com" className="hover:text-[#F3BF2C]">Contact</a>
        </span>
      </div>
    </footer>
  );
}
