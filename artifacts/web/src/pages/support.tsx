export default function SupportPage() {
  return (
    <div className="max-w-[800px] mx-auto px-6 py-16">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#B50000" }}>
          Support
        </p>
        <h1 className="text-4xl font-extrabold text-foreground mb-3">We're here to help</h1>
        <p className="text-muted-foreground text-base leading-relaxed max-w-xl">
          Whether you're a supporter, a grassroots organisation, or just exploring — get in touch and
          we'll get back to you as soon as we can.
        </p>
      </div>

      <div className="space-y-0">
        <Section title="Contact Us">
          <p className="mb-4">
            Email is the best way to reach us. We aim to respond within <strong>2 business days</strong>.
          </p>
          <a
            href="mailto:info@rootprojx.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white text-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#B50000" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            info@rootprojx.com
          </a>
        </Section>

        <Section title="Common Questions">
          <div className="space-y-6">
            <Faq q="How do I donate to an organisation?">
              Browse or search for an organisation on the{" "}
              <a href="/discover" className="underline hover:opacity-80">Discover</a> page, open their
              profile, and click <strong>Donate</strong>. You can give a one-time amount or set up a
              monthly contribution — no account required for one-time donations.
            </Faq>
            <Faq q="How do I register my organisation on Root ProjX?">
              Click <strong>Join as an organisation</strong> on the home screen and complete the
              onboarding form. Once submitted, our team reviews your application and we'll be in touch
              within 5 business days.
            </Faq>
            <Faq q="Where does my donation go?">
              Your donation supports the organisation after the 5% Root ProjX platform fee and
              card processing fees. You can cover the card processing fees so more reaches the
              organisation; the platform fee still applies. The breakdown is shown before checkout.
            </Faq>
            <Faq q="Can I get a receipt for my donation?">
              Yes — a confirmation email is sent automatically to the address you provide at checkout.
              If you didn't receive it, check your spam folder or email us and we'll resend it.
            </Faq>
            <Faq q="How do I cancel a recurring donation?">
              Sign in to your account, go to <strong>My Account → Donations</strong>, and cancel from
              there. If you have trouble, email us and we'll cancel it manually within 24 hours.
            </Faq>
            <Faq q="I have a complaint or safeguarding concern.">
              Please email <a href="mailto:info@rootprojx.com" className="underline hover:opacity-80">info@rootprojx.com</a>{" "}
              with as much detail as possible. We take all concerns seriously and will respond within
              1 business day.
            </Faq>
          </div>
        </Section>

        <Section title="Useful Links" last>
          <ul className="space-y-2 text-base">
            <li>
              <a href="/privacy" className="underline hover:opacity-80">Privacy Policy</a>
              {" "}— how we handle your personal data
            </li>
            <li>
              <a href="/terms" className="underline hover:opacity-80">Fundraising Terms</a>
              {" "}— our partner organisation terms
            </li>
            <li>
              <a href="/discover" className="underline hover:opacity-80">Discover Organisations</a>
              {" "}— find a cause to support
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  last = false,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`py-8 ${!last ? "border-b border-[#E0D8CC]" : ""}`}>
      <h2 className="text-lg font-bold mb-4" style={{ color: "#B50000" }}>
        {title}
      </h2>
      <div className="text-[#1a1a1a] text-base leading-[1.7]">{children}</div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-foreground mb-1">{q}</p>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}
