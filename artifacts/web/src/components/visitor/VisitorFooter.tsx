import { Link } from "wouter";
import { NewsletterForm } from "./NewsletterForm";

export function VisitorFooter() {
  const l = "text-[#F4EFE6]/75 hover:text-[#F3BF2C] transition-colors";
  return (
    <footer className="bg-[#17100F] text-[#F4EFE6] mt-20" data-testid="footer-visitor">
      <div className="max-w-[1240px] mx-auto px-5 md:px-8 py-14 grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-10">
        <div>
          <p className="rp-label !text-[12px] text-[#F3BF2C]">Newsletter</p>
          <h2 className="rp-display text-[clamp(40px,6vw,72px)] text-[#F4EFE6] mt-2">Stay connected</h2>
          <p className="mt-3 mb-5 text-[15px] text-[#cfc6bd]">Stories from the ground and new organisations, once a month.</p>
          <NewsletterForm dark id="footer-newsletter" />
        </div>
        <div className="grid grid-cols-2 gap-6">
        <nav aria-label="Explore">
          <p className="rp-label !text-[12px] text-[#F3BF2C] mb-4">Explore</p>
          <ul className="space-y-2.5 text-[15px]">
            <li><Link href="/feed" className={l}>Live feed</Link></li>
            <li><Link href="/discover" className={l}>Discover</Link></li>
            <li><Link href="/help" className={l}>Get help</Link></li>
            <li><Link href="/shop" className={l}>Shop</Link></li>
          </ul>
        </nav>
        <nav aria-label="Root ProjX">
          <p className="rp-label !text-[12px] text-[#F3BF2C] mb-4">Root ProjX</p>
          <ul className="space-y-2.5 text-[15px]">
            <li><Link href="/about" className={l}>About</Link></li>
            <li><Link href="/onboarding" className={l}>Apply as an organisation</Link></li>
            <li><Link href="/register" className={l}>Join the movement</Link></li>
            <li><Link href="/login" className={l}>Sign in</Link></li>
          </ul>
        </nav>
        </div>
      </div>
      <div className="max-w-[1240px] mx-auto px-5 md:px-8 py-6 border-t border-[#F4EFE6]/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <img src="/logo-gold-v2.png" alt="Root ProjX" className="h-10 w-auto self-start" />
        <p className="rp-label !text-[11px] !tracking-[.08em] text-[#F4EFE6]/55">© 2026 Root ProjX Ltd · Registered in England and Wales, No. 17160024</p>
        <span className="rp-label !text-[11px] flex gap-4 text-[#F4EFE6]/55">
          <Link href="/privacy" className="hover:text-[#F3BF2C]">Privacy</Link>
          <Link href="/terms" className="hover:text-[#F3BF2C]">Terms</Link>
        </span>
      </div>
    </footer>
  );
}
