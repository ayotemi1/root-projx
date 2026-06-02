export default function TermsPage() {
  return (
    <div className="max-w-[800px] mx-auto px-6 py-16">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#B50000" }}>
          Fundraising Terms
        </p>
        <h1 className="text-4xl font-extrabold text-foreground mb-3">How Giving Works on Root ProjX</h1>
        <p className="text-muted-foreground text-sm">Last updated: June 2026</p>
      </div>

      <div className="space-y-0">
        <Section title="1. About Root ProjX">
          <p>
            Root ProjX Ltd (registered in England and Wales, registered address: 51 Russell Row, Lewes,
            BN7 2EE) operates a community giving platform that facilitates direct donations from supporters
            to verified grassroots organisations.
          </p>
          <p className="mt-3">
            Root ProjX is not a registered charity. We are a private limited company operating a fundraising
            platform. Organisations listed on Root ProjX are independently verified but are not required to
            be registered charities. Donors should review each organisation's profile before donating.
          </p>
        </Section>

        <Section title="2. How Donations Work">
          <p className="mb-3">When you make a donation through Root ProjX:</p>
          <ul className="list-disc list-inside space-y-2 text-[#1a1a1a]">
            <li>Your payment is processed securely by Stripe, a PCI DSS Level 1 certified payment processor</li>
            <li>95% of your donation is transferred directly to the organisation's connected bank account</li>
            <li>5% is retained by Root ProjX Ltd as a platform fee to cover operational costs and sustain the platform</li>
            <li>The platform fee is clearly displayed before you complete your donation</li>
            <li>Donations are processed in GBP (British Pounds Sterling)</li>
          </ul>
          <p className="mt-4">
            Root ProjX acts as a payment facilitator, not as a fundraising agent or trustee. We do not hold
            donor funds. All funds flow directly to organisations through Stripe Connect.
          </p>
        </Section>

        <Section title="3. Platform Fee Disclosure">
          <p className="mb-4">
            Root ProjX charges a 5% platform fee on all donations. This fee is deducted automatically at
            the point of payment. For example:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-[#E0D8CC] rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[#F2EDE4]">
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Donation</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">To Organisation</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Platform Fee</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[#E0D8CC]">
                  <td className="px-4 py-3">£10.00</td>
                  <td className="px-4 py-3 font-medium" style={{ color: "#B50000" }}>£9.50</td>
                  <td className="px-4 py-3 text-muted-foreground">£0.50</td>
                </tr>
                <tr className="border-t border-[#E0D8CC] bg-[#F9F6F0]">
                  <td className="px-4 py-3">£25.00</td>
                  <td className="px-4 py-3 font-medium" style={{ color: "#B50000" }}>£23.75</td>
                  <td className="px-4 py-3 text-muted-foreground">£1.25</td>
                </tr>
                <tr className="border-t border-[#E0D8CC]">
                  <td className="px-4 py-3">£100.00</td>
                  <td className="px-4 py-3 font-medium" style={{ color: "#B50000" }}>£95.00</td>
                  <td className="px-4 py-3 text-muted-foreground">£5.00</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            This fee structure is in addition to Stripe's standard payment processing fees, which are borne
            by Root ProjX and not passed on to donors or organisations.
          </p>
        </Section>

        <Section title="4. Organisation Verification">
          <p className="mb-3">
            Root ProjX verifies organisations before they can receive donations. Our verification process includes:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[#1a1a1a]">
            <li>Review of organisation registration documents or evidence of operation</li>
            <li>Confirmation of contact details and legitimate purpose</li>
            <li>Stripe identity verification for bank account setup</li>
          </ul>
          <p className="mt-4">
            Verification does not constitute an endorsement of an organisation's work, values, or impact.
            Donors are encouraged to review organisation profiles, updates, and impact reports before donating.
          </p>
        </Section>

        <Section title="5. Refund Policy">
          <p>
            All donations made through Root ProjX are final and non-refundable. Once a donation is processed,
            it cannot be reversed.
          </p>
          <p className="mt-3 mb-3">
            Root ProjX reserves the right to issue a discretionary refund in the following exceptional
            circumstances only:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[#1a1a1a]">
            <li>A technical error resulted in a duplicate or incorrect charge</li>
            <li>The donation was made fraudulently without the account holder's consent</li>
            <li>The recipient organisation's account is suspended or removed following a verification failure</li>
          </ul>
          <p className="mt-4">
            To request a discretionary refund, contact{" "}
            <a href="mailto:info@rootprojx.com" className="underline hover:opacity-80">info@rootprojx.com</a>{" "}
            within 48 hours of the transaction. Approved refunds will be returned to the original payment
            method within 5–10 business days.
          </p>
        </Section>

        <Section title="6. Age Requirements">
          <ul className="list-disc list-inside space-y-2 text-[#1a1a1a]">
            <li>You must be 18 years of age or older to make a donation independently through Root ProjX</li>
            <li>Users aged 13–17 may use the platform but may only donate with the explicit consent of a parent or legal guardian</li>
          </ul>
          <p className="mt-4">
            By completing a donation you confirm that you are 18 or over, or that you have obtained parental
            or guardian consent.
          </p>
        </Section>

        <Section title="7. Gift Aid">
          <p>
            Root ProjX is not currently registered as a Gift Aid intermediary with HMRC. Donations made
            through Root ProjX are not currently eligible for Gift Aid. We intend to apply for Gift Aid
            intermediary status in due course and will notify donors when this becomes available.
          </p>
        </Section>

        <Section title="8. Organisation Responsibilities">
          <p className="mb-3">Organisations listed on Root ProjX agree to:</p>
          <ul className="list-disc list-inside space-y-2 text-[#1a1a1a]">
            <li>Use donations exclusively for the purposes described in their profile and campaigns</li>
            <li>Provide regular impact updates to their supporters on the platform</li>
            <li>Comply with all applicable laws in their country of operation</li>
            <li>Notify Root ProjX immediately of any change in status, registration, or operational circumstances</li>
            <li>Complete Stripe Connect onboarding to receive payouts</li>
          </ul>
          <p className="mt-4">
            Root ProjX reserves the right to suspend or remove any organisation that breaches these
            responsibilities. In such cases, any unprocessed funds will be handled in accordance with
            applicable law.
          </p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p className="mb-3">
            Root ProjX acts as a technology platform and payment facilitator only. We are not responsible for:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[#1a1a1a]">
            <li>How organisations use the funds they receive</li>
            <li>The accuracy of information provided by organisations on their profiles</li>
            <li>The outcomes or impact of any organisation's work</li>
            <li>Any losses arising from the failure of an organisation to deliver on its stated mission</li>
          </ul>
          <p className="mt-4">
            Root ProjX's total liability to any donor shall not exceed the amount of the donation made.
          </p>
        </Section>

        <Section title="10. Data &amp; Privacy">
          <p>
            Your personal data is collected and processed in accordance with our{" "}
            <a href="/privacy" className="underline hover:opacity-80">Privacy Policy</a>.
            By making a donation you consent to the processing of your personal data as described therein.
          </p>
        </Section>

        <Section title="11. Governing Law">
          <p>
            These terms are governed by the laws of England and Wales. Any disputes shall be subject to
            the exclusive jurisdiction of the courts of England and Wales.
          </p>
        </Section>

        <Section title="12. Contact" last>
          <p>For any questions about these terms or about a donation you have made, contact us at:</p>
          <div className="mt-3 space-y-1">
            <p className="font-semibold text-foreground">Root ProjX Ltd</p>
            <p>51 Russell Row, Lewes, BN7 2EE</p>
            <p>
              Email:{" "}
              <a href="mailto:info@rootprojx.com" className="underline hover:opacity-80">info@rootprojx.com</a>
            </p>
            <p>
              Website:{" "}
              <a href="https://www.rootprojx.com" className="underline hover:opacity-80">www.rootprojx.com</a>
            </p>
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
