export default function PrivacyPage() {
  return (
    <div className="max-w-[800px] mx-auto px-6 py-16">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#B50000" }}>
          Privacy Policy
        </p>
        <h1 className="text-4xl font-extrabold text-foreground mb-3">Your Privacy Matters</h1>
        <p className="text-muted-foreground text-sm mb-1">Last updated: June 2026</p>
        <p className="text-sm font-medium" style={{ color: "#B50000" }}>ICO Registration Reference: ZC152619</p>
      </div>

      <div className="space-y-0">
        <Section title="1. Who We Are">
          <p>
            Root ProjX Ltd is a private limited company incorporated in England and Wales. We operate
            the Root ProjX platform — a community giving platform connecting diaspora supporters to
            verified grassroots organisations worldwide.
          </p>
          <div className="mt-4 space-y-1 text-[#1a1a1a]">
            <p><strong>Registered address:</strong> 51 Russell Row, Lewes, East Sussex, BN7 2EE, United Kingdom</p>
            <p><strong>Email:</strong> <a href="mailto:info@rootprojx.com" className="underline hover:opacity-80">info@rootprojx.com</a></p>
            <p><strong>Website:</strong> <a href="https://www.rootprojx.com" className="underline hover:opacity-80">www.rootprojx.com</a></p>
          </div>
          <p className="mt-4">
            Root ProjX Ltd is the data controller for all personal data collected through the platform.
            We are registered with the Information Commissioner's Office (ICO) under the UK GDPR and
            Data Protection Act 2018.
          </p>
          <div className="mt-3 space-y-1 text-[#1a1a1a]">
            <p><strong>ICO Registration Reference:</strong> ZC152619</p>
            <p><strong>Date registered:</strong> 20 May 2026</p>
            <p><strong>Registration expires:</strong> 19 May 2027</p>
          </div>
        </Section>

        <Section title="2. What Data We Collect">
          <div className="space-y-5">
            <div>
              <p className="font-semibold text-foreground mb-2">2.1 Account Registration</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Full name</li>
                <li>Email address</li>
                <li>Phone number (optional)</li>
                <li>Password (encrypted — never stored in plain text)</li>
                <li>Account type (Supporter or Organisation)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">2.2 Organisation Accounts</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Organisation name and contact person name</li>
                <li>Country of operation</li>
                <li>Registration or charity number (optional)</li>
                <li>Bank account details (collected and stored by Stripe only — never by Root ProjX)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">2.3 Donations</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Donation amount and recipient organisation</li>
                <li>Payment method details (collected and stored by Stripe only — never by Root ProjX)</li>
                <li>Timestamp and transaction reference</li>
                <li>Donor email address (for confirmation receipts)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">2.4 Usage Data</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Pages and screens visited</li>
                <li>Organisations followed or viewed</li>
                <li>Search queries entered</li>
                <li>Device type, operating system, and browser</li>
                <li>IP address and approximate location</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">2.5 Communications</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Newsletter subscriptions (email address only)</li>
                <li>Support enquiries and messages sent to us</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section title="3. How We Use Your Data">
          <ul className="list-disc list-inside space-y-2">
            <li>To create and manage your account</li>
            <li>To process donations and send confirmation receipts</li>
            <li>To connect supporters with verified grassroots organisations</li>
            <li>To send platform updates, impact reports, and newsletters (opt-in only)</li>
            <li>To improve the platform and user experience</li>
            <li>To comply with our legal and regulatory obligations including the Charities Act 2011 and UK GDPR</li>
            <li>To detect and prevent fraud or misuse of the platform</li>
          </ul>
          <p className="mt-4 font-medium">
            We do not sell your personal data to third parties. We do not use your data for advertising purposes.
          </p>
        </Section>

        <Section title="4. Legal Basis for Processing">
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Contract:</strong> processing necessary to provide the Root ProjX service to you</li>
            <li><strong>Legitimate interests:</strong> improving the platform, preventing fraud, security monitoring</li>
            <li><strong>Consent:</strong> email newsletters and optional marketing communications</li>
            <li><strong>Legal obligation:</strong> compliance with UK law, financial regulations, and the Charities Act 2011</li>
          </ul>
        </Section>

        <Section title="5. Data Storage &amp; Security">
          <p>
            Your data is stored on Google Firebase, hosted on Google Cloud's European servers (EU/UK region).
            Google Cloud is compliant with UK GDPR and ISO 27001 security standards. Root ProjX maintains a
            Data Processing Agreement with Google LLC in accordance with UK GDPR Article 28.
          </p>
          <p className="mt-3">
            Payment data is handled exclusively by Stripe, Inc. — a PCI DSS Level 1 certified payment processor.
            Root ProjX maintains a Data Processing Agreement with Stripe. We never store card numbers, bank
            account details, or payment credentials.
          </p>
          <p className="mt-3">
            Email communications are handled by Brevo (formerly Sendinblue). Root ProjX maintains a Data
            Processing Agreement with Brevo in accordance with UK GDPR.
          </p>
          <p className="mt-3">
            We implement appropriate technical and organisational measures to protect your personal data
            including encrypted data transmission (HTTPS/TLS), encrypted password storage, and access
            controls limiting who can access personal data.
          </p>
        </Section>

        <Section title="6. Data Retention">
          <ul className="list-disc list-inside space-y-2">
            <li>Account data: retained for the duration of your account, plus 2 years after closure</li>
            <li>Donation records: retained for 7 years in compliance with UK financial regulations</li>
            <li>Usage data: retained for 12 months then anonymised</li>
            <li>Newsletter subscriptions: retained until you unsubscribe</li>
            <li>Support communications: retained for 2 years</li>
          </ul>
        </Section>

        <Section title="7. Your Rights Under UK GDPR">
          <p className="mb-3">You have the following rights regarding your personal data:</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Right to access:</strong> request a copy of the personal data we hold about you</li>
            <li><strong>Right to rectification:</strong> request correction of inaccurate or incomplete data</li>
            <li><strong>Right to erasure:</strong> request deletion of your data (subject to legal retention requirements)</li>
            <li><strong>Right to restrict processing:</strong> request we limit how we use your data</li>
            <li><strong>Right to data portability:</strong> request your data in a structured, portable format</li>
            <li><strong>Right to object:</strong> object to processing based on legitimate interests</li>
            <li><strong>Right to withdraw consent:</strong> withdraw consent for marketing at any time</li>
          </ul>
          <p className="mt-4">
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:info@rootprojx.com" className="underline hover:opacity-80">info@rootprojx.com</a>.
            We will respond within 30 days. There is no charge for exercising your rights.
          </p>
        </Section>

        <Section title="8. Age Policy">
          <ul className="list-disc list-inside space-y-2">
            <li>The Root ProjX platform is accessible to users aged 13 and over</li>
            <li>Users must be 18 or over to make donations independently</li>
            <li>Users aged 13–17 may donate only with the explicit consent of a parent or legal guardian</li>
            <li>We do not knowingly collect personal data from children under 13</li>
          </ul>
          <p className="mt-4">
            If you believe a child under 13 has created an account, please contact us at{" "}
            <a href="mailto:info@rootprojx.com" className="underline hover:opacity-80">info@rootprojx.com</a>{" "}
            and we will delete the account promptly.
          </p>
        </Section>

        <Section title="9. Cookies &amp; Tracking">
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-foreground mb-2">9.1 What Cookies We Use</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Essential cookies:</strong> required for authentication, session management, and security. Cannot be disabled.</li>
                <li><strong>Analytics cookies:</strong> used to understand how users interact with the platform. These are anonymised and aggregated.</li>
                <li><strong>Preference cookies:</strong> used to remember your settings and preferences.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">9.2 Managing Cookies</p>
              <p>
                You can control and delete cookies through your browser settings. Disabling essential cookies
                may prevent you from using certain features of the platform. For more information on managing
                cookies visit{" "}
                <a href="https://www.aboutcookies.org" className="underline hover:opacity-80">www.aboutcookies.org</a>.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">9.3 Third Party Cookies</p>
              <p>
                Some third party services we use (including Google Firebase and Stripe) may set their own
                cookies. These are governed by the respective third party's cookie policies.
              </p>
            </div>
          </div>
        </Section>

        <Section title="10. Third Party Data Processors">
          <p className="mb-3">
            Root ProjX uses the following third party services which process personal data on our behalf.
            We maintain Data Processing Agreements with each:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>Stripe, Inc. — payment processing — <a href="https://stripe.com/privacy" className="underline hover:opacity-80">stripe.com/privacy</a></li>
            <li>Google Firebase (Google LLC) — data storage and authentication — <a href="https://firebase.google.com/support/privacy" className="underline hover:opacity-80">firebase.google.com/support/privacy</a></li>
            <li>Brevo SAS — email communications — <a href="https://brevo.com/legal/privacypolicy" className="underline hover:opacity-80">brevo.com/legal/privacypolicy</a></li>
            <li>Apple Inc. — iOS app distribution via App Store</li>
            <li>Google LLC — Android app distribution via Google Play Store</li>
          </ul>
          <p className="mt-3">
            Each processor is contractually bound to process data only on our instructions and in accordance
            with UK GDPR. We do not authorise any processor to use your data for their own purposes.
          </p>
        </Section>

        <Section title="11. International Data Transfers">
          <p>
            Some of our third party processors (including Stripe) are based in the United States. Where data
            is transferred outside the UK, we ensure appropriate safeguards are in place including Standard
            Contractual Clauses (SCCs) approved under UK GDPR or equivalent adequacy decisions.
          </p>
        </Section>

        <Section title="12. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our practices or legal
            requirements. We will notify registered users of any material changes by email at least 14 days
            before they take effect. The latest version will always be available at{" "}
            <a href="https://www.rootprojx.com/privacy" className="underline hover:opacity-80">www.rootprojx.com/privacy</a>.
          </p>
        </Section>

        <Section title="13. Contact &amp; Complaints" last>
          <p className="mb-3">For any privacy-related queries or to exercise your data rights, contact us at:</p>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Root ProjX Ltd</p>
            <p>51 Russell Row, Lewes, East Sussex, BN7 2EE</p>
            <p>Email: <a href="mailto:info@rootprojx.com" className="underline hover:opacity-80">info@rootprojx.com</a></p>
          </div>
          <p className="mt-4 mb-2">
            If you are unhappy with how we have handled your personal data, you have the right to lodge a
            complaint with the Information Commissioner's Office (ICO):
          </p>
          <div className="space-y-1">
            <p>Website: <a href="https://ico.org.uk" className="underline hover:opacity-80">ico.org.uk</a></p>
            <p>Telephone: <strong>0303 123 1113</strong></p>
            <p>Post: ICO, Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF</p>
          </div>
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
