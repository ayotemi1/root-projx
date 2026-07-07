import { useState } from "react";
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
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <footer className="border-t border-border bg-card mt-16">
      {/* Newsletter band */}
      <div className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-6 py-12 text-center">
          <h2 className="text-2xl font-bold mb-2">Stay connected to the cause</h2>
          <p className="text-primary-foreground/80 mb-6 text-sm">
            Get impact updates, new organisations, and community news — straight to your inbox.
          </p>

          {status === "success" ? (
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-6 py-3 rounded-full font-semibold text-sm">
              <span>✓</span> You're subscribed! Thank you.
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
                placeholder="Your email address"
                required
                className="flex-1 px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-white/40 text-sm"
              />
              <button
                type="submit"
                disabled={status === "loading" || !email}
                className="px-6 py-3 bg-accent text-accent-foreground font-bold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
              >
                {status === "loading" ? "Subscribing…" : "Subscribe →"}
              </button>
            </form>
          )}

          {status === "error" && (
            <p className="mt-3 text-sm text-red-200">{errorMsg}</p>
          )}
        </div>
      </div>

      {/* Footer links */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <p className="font-extrabold text-lg text-primary mb-2">Root ProjX</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Connecting the diaspora to verified grassroots organisations in Jamaica, the UK, and beyond.
            </p>
          </div>

          {/* Platform */}
          <div>
            <p className="font-bold text-sm text-foreground mb-3 uppercase tracking-wide">Platform</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/discover" className="hover:text-primary transition-colors">Discover Organisations</a></li>
              <li><a href="/" className="hover:text-primary transition-colors">Home Feed</a></li>
              <li><a href="/about" className="hover:text-primary transition-colors">About Root ProjX</a></li>
              <li><a href="/help" className="hover:text-primary transition-colors">Get Help Directory</a></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <p className="font-bold text-sm text-foreground mb-3 uppercase tracking-wide">Account</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/register" className="hover:text-primary transition-colors">Join Root ProjX</a></li>
              <li><a href="/login" className="hover:text-primary transition-colors">Sign In</a></li>
              <li><a href="/account" className="hover:text-primary transition-colors">My Account</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            &copy; {new Date().getFullYear()} Root ProjX Ltd. All rights reserved.
            &nbsp;·&nbsp; Secured by Stripe &nbsp;·&nbsp; Powered by Firebase
            &nbsp;·&nbsp; <span className="opacity-70">ICO Registered: ZC152619</span>
          </span>
          <span className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-primary transition-colors">Fundraising Terms</a>
            <a href="/support" className="hover:text-primary transition-colors">Support</a>
            <a href="mailto:info@rootprojx.com" className="hover:text-primary transition-colors">Contact</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
