export default function PrivacyPage() {
  return (
    <div className="max-w-[800px] mx-auto px-6 py-16">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#B50000" }}>
          Privacy Policy
        </p>
        <h1 className="text-4xl font-extrabold text-foreground mb-3">Your Privacy Matters</h1>
        <p className="text-muted-foreground text-sm">Last updated: June 2026</p>
      </div>

      <div className="space-y-0">
        <Section title="1. Who We Are">
          <p>
            Root ProjX Ltd is a private limited company incorporated in England and Wales. We operate
            the Root ProjX platform — a community giving platform connecting diaspora supporters to
            verified grassroots organisations worldwide.
          </p>
          <p className="mt-3">
            <strong>Registered address:</strong> 51 Russell Row, Lewes, BN7 2EE, United Kingdom<br />
            <strong>Contact:</strong> <a href="mailto:info@rootprojx.com" className="underline hover:opacity-80">info@rootprojx.com</a> | <a href="https://www.rootprojx.com" className="underline hover:opacity-80">www.rootprojx.com</a>
          </p>
          <p className="mt-3">
            Root ProjX Ltd is the data controller for all personal data collected through the platform.
            We are registered with the Information Commissioner's Office (ICO) in accordance with UK GDPR.
          </p>
        </Section>

        <Section title="2. What Data We Collect">
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-foreground mb-1">2.1 Account Registration</p>
              <ul className="list-disc list-inside space-y-1 text-[#1a1a1a]">
                <li>Full name</li>
                <li>Email address</li>
                <li>Phone number (optional)</li>
                <li>Password (encrypted — we never store passwords in plain text)</li>
                <li>Account type (Supporter or Organisation)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">2.2 Organisation Accounts</p>
              <ul className="list-disc list-inside space-y-1 text-[#1a1a1a]">
                <li>Organisation name</li>
                <li>Contact person name</li>
                <li>Country of operation</li>
                <li>Registration number (optional)</li>
                <li>Bank account details (collected and stored by Stripe — not by Root ProjX)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">2.3 Donations</p>
              <ul className="list-disc list-inside space-y-1 text-[#1a1a1a]">
                <li>Donation amount</li>
                <li>Organisation donated to</li>
                <li>Payment method details (collected and stored by Stripe — not by Root ProjX)</li>
                <li>Timestamp of donation</li>
                <li>Donor email (for confirmation)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">2.4 Usage Data</p>
              <ul className="list-disc list-inside space-y-1 text-[#1a1a1a]">
                <li>Pages and screens visited</li>
                <li>Organisations followed or viewed</li>
                <li>Search queries</li>
                <li>Device type, operating system, browser</li>
                <li>IP address</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">2.5 Communications</p>
              <ul className="list-disc list-inside space-y-1 text-[#1a1a1a]">
                <li>Newsletter subscriptions (email address only)</li>
                <li>Support enquiries and messages sent to us</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section title="3. How We Use Your Data">
          <ul className="list-disc list-inside space-y-2 text-[#1a1a1a]">
            <li>To create and manage your account</li>
            <li>To process donations and send confirmation receipts</li>
            <li>To connect supporters with grassroots organisations</li>
            <li>To send platform updates, impact reports, and newsletters (only if you opt in)</li>
            <li>To improve the platform and user experience</li>
            <li>To comply with our legal and regulatory obligations</li>
            <li>To detect and prevent fraud or misuse of the platform</li>
          </ul>
          <p className="mt-4 font-medium">
            We do not sell your personal data to third parties. We do not use your data for advertising purposes.
          </p>
        </Section>

        <Section title="4. Legal Basis for Processing">
          <ul className="list-disc list-inside space-y-2 text-[#1a1a1a]">
            <li><strong>Contract:</strong> processing necessary to provide the Root ProjX service to you</li>
            <li><strong>Legitimate interests:</strong> improving the platform, preventing fraud, analytics</li>
            <li><strong>Consent:</strong> email newsletters and marketing communications</li>
            <li><strong>Legal obligation:</strong> compliance with UK law and financial regulations</li>
          </ul>
        </Section>

        <Section title="5. Data Storage &amp; Security">
          <p>
            Your data is stored on Google Firebase, hosted on Google Cloud's European servers (EU/UK region).
            Google Cloud is compliant with UK GDPR and ISO 27001 security standards.
          </p>
          <p className="mt-3">
            Payment data is handled exclusively by Stripe, Inc. — a PCI DSS Level 1 certified payment processor.
            Root ProjX never stores card numbers, bank account details, or payment credentials.
          </p>
          <p className="mt-3">
            We implement appropriate technical and organisational measures to protect your personal data
            against unauthorised access, loss, or disclosure.
          </p>
        </Section>

        <Section title="6. Data Retention">
          <ul className="list-disc list-inside space-y-2 text-[#1a1a1a]">
            <li>Account data: retained for as long as your account is active, plus 2 years after closure</li>
            <li>Donation records: retained for 7 years in compliance with UK financial regulations</li>
            <li>Usage data: retained for 12 months then anonymised</li>
            <li>Newsletter subscriptions: retained until you unsubscribe</li>
          </ul>
        </Section>

        <Section title="7. Your Rights">
          <p className="mb-3">Under UK GDPR you have the following rights:</p>
          <ul className="list-disc list-inside space-y-2 text-[#1a1a1a]">
            <li><strong>Right to access:</strong> request a copy of the personal data we hold about you</li>
            <li><strong>Right to rectification:</strong> request correction of inaccurate data</li>
            <li><strong>Right to erasure:</strong> request deletion of your data (subject to legal retention requirements)</li>
            <li><strong>Right to restrict processing:</strong> request we limit how we use your data</li>
            <li><strong>Right to data portability:</strong> request your data in a portable format</li>
            <li><strong>Right to object:</strong> object to processing based on legitimate interests</li>
            <li><strong>Right to withdraw consent:</strong> withdraw consent for marketing at any time</li>
          </ul>
          <p className="mt-4">
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:info@rootprojx.com" className="underline hover:opacity-80">info@rootprojx.com</a>.
            We will respond within 30 days.
          </p>
        </Section>

        <Section title="8. Age Policy">
          <ul className="list-disc list-inside space-y-2 text-[#1a1a1a]">
            <li>The Root ProjX platform is accessible to users aged 13 and over</li>
            <li>Users must be 18 or over to make donations independently</li>
            <li>Users aged 13–17 may donate only with the consent of a parent or legal guardian</li>
            <li>We do not knowingly collect personal data from children under 13</li>
          </ul>
          <p className="mt-4">
            If you believe a child under 13 has created an account, please contact us at{" "}
            <a href="mailto:info@rootprojx.com" className="underline hover:opacity-80">info@rootprojx.com</a>{" "}
            and we will delete the account immediately.
          </p>
        </Section>

        <Section title="9. Cookies">
          <p>
            We use essential cookies to operate the platform (authentication, session management). We may
            use analytics cookies to understand how the platform is used. You can control cookies through
            your browser settings.
          </p>
        </Section>

        <Section title="10. Third Party Services">
          <p className="mb-3">Root ProjX uses the following third party services which may process your data:</p>
          <ul className="list-disc list-inside space-y-2 text-[#1a1a1a]">
            <li>Stripe — payment processing (stripe.com/privacy)</li>
            <li>Google Firebase — data storage and authentication (firebase.google.com/support/privacy)</li>
            <li>Brevo — email communications (brevo.com/legal/privacypolicy)</li>
            <li>Apple App Store / Google Play Store — app distribution</li>
          </ul>
          <p className="mt-3">Each third party is responsible for their own data practices under their respective privacy policies.</p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify registered users of material
            changes by email. The latest version will always be available at{" "}
            <a href="https://www.rootprojx.com/privacy" className="underline hover:opacity-80">www.rootprojx.com/privacy</a>.
          </p>
        </Section>

        <Section title="12. Contact &amp; Complaints" last>
          <p>
            For any privacy-related queries contact us at{" "}
            <a href="mailto:info@rootprojx.com" className="underline hover:opacity-80">info@rootprojx.com</a>.
          </p>
          <p className="mt-3">
            If you are unhappy with how we handle your data, you have the right to lodge a complaint with the
            Information Commissioner's Office (ICO) at{" "}
            <a href="https://ico.org.uk" className="underline hover:opacity-80">ico.org.uk</a>{" "}
            or by calling <strong>0303 123 1113</strong>.
          </p>
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
      <h2
        className="text-lg font-bold mb-4"
        style={{ color: "#B50000" }}
      >
        {title}
      </h2>
      <div className="text-[#1a1a1a] text-base leading-[1.7]">{children}</div>
    </div>
  );
}
