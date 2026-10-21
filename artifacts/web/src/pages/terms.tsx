import { calculateDonationAccounting, estimateStripeFeePence } from "../../../api-server/src/lib/donation-accounting";
const money = (n: number) => `£${n.toFixed(2)}`;

/** Worked examples from the same accounting helper used at checkout and on receipts. */
export function FeeExamples() {
  const rows = [3, 10, 25].flatMap((gbp) => {
    const intendedPence = gbp * 100;
    const coverPence = estimateStripeFeePence(intendedPence, "GB");
    return [
      { key: `${gbp}-u`, label: `${money(gbp)}, fees not covered`, a: calculateDonationAccounting({ chargedPence: intendedPence, intendedPence, feeCovered: false, cardCountry: "GB" }) },
      { key: `${gbp}-c`, label: `${money(gbp)}, card fee covered`, a: calculateDonationAccounting({ chargedPence: intendedPence + coverPence, intendedPence, feeCovered: true, cardCountry: "GB" }) },
    ];
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-[#E0D8CC] rounded-lg overflow-hidden" data-testid="table-fee-examples">
        <thead>
          <tr style={{ backgroundColor: "#B50000" }}>
            <th className="text-left px-3 py-3 font-semibold text-white">Example</th>
            <th className="text-left px-3 py-3 font-semibold text-white">You pay</th>
            <th className="text-left px-3 py-3 font-semibold text-white">Platform fee (5%)</th>
            <th className="text-left px-3 py-3 font-semibold text-white">Card processing (est.)</th>
            <th className="text-left px-3 py-3 font-semibold text-white">Organisation receives (est.)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, a }, i) => (
            <tr key={key} className="border-t border-[#E0D8CC]" style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#F9F6F0" }}>
              <td className="px-3 py-3 font-medium text-foreground">{label}</td>
              <td className="px-3 py-3">{money(a.chargedGbp)}</td>
              <td className="px-3 py-3 text-muted-foreground">{money(a.platformFeeGbp)}</td>
              <td className="px-3 py-3 text-muted-foreground">{a.feeCovered ? `${money(a.feeCoverGbp)} fee cover, included in what you pay` : `${money(a.estimatedStripeFeeGbp)}, taken from the gift`}</td>
              <td className="px-3 py-3 font-semibold" style={{ color: "#B50000" }}>{money(a.toOrgGbp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

      {/* Financial promotion notice */}
      <div
        className="mb-10 px-5 py-4 rounded-lg border text-sm leading-[1.7] italic"
        style={{ borderColor: "#B50000", backgroundColor: "#FFF5F5", color: "#1a1a1a" }}
      >
        <strong className="not-italic" style={{ color: "#B50000" }}>Financial Promotion Notice:</strong>{" "}
        Root ProjX facilitates charitable giving. Any communication from Root ProjX encouraging donations
        is made in good faith and in compliance with applicable UK fundraising regulations. Root ProjX is
        not authorised or regulated by the FCA for investment purposes. Donations are gifts and do not
        constitute investments.
      </div>

      <div className="space-y-0">
        <Section title="1. About Root ProjX">
          <p>
            Root ProjX Ltd is a private limited company incorporated in England and Wales (registered address:
            51 Russell Row, Lewes, East Sussex, BN7 2EE). We operate a community giving platform that
            facilitates direct donations from diaspora supporters to verified grassroots organisations.
          </p>
          <p className="mt-3">
            Root ProjX is not a registered charity. We are a private limited company operating as a
            third-party fundraiser in accordance with the Charities Act 2011 and the Code of Fundraising
            Practice issued by the Fundraising Regulator. Organisations listed on Root ProjX are
            independently verified but are not required to be registered charities.
          </p>
        </Section>

        <Section title="2. Third-Party Fundraiser Status">
          <p className="mb-3">Root ProjX operates as a third-party fundraiser under the Charities Act 2011. This means:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>We collect donations on behalf of organisations listed on our platform</li>
            <li>We are subject to the requirements of the Charities Act 2011 regarding professional fundraising</li>
            <li>Each organisation listed on our platform has agreed to our Organisation Terms</li>
            <li>We maintain transparent records of all donations collected and fees charged</li>
          </ul>
          <p className="mt-3">
            Root ProjX does not solicit donations for its own charitable purposes. Each donation goes to the
            intended organisation after the 5% platform fee and card processing fees, which are itemised
            before you pay (see section 4).
          </p>
        </Section>

        <Section title="3. How Donations Work">
          <p className="mb-3">When you make a donation through Root ProjX:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Your payment is processed securely by Stripe, a PCI DSS Level 1 certified payment processor</li>
            <li>Root ProjX Ltd keeps a 5% platform fee, worked out on the amount you chose to give, to cover operational costs</li>
            <li>Card processing fees also apply. You can choose to cover them so they don't come out of your gift; the platform fee still applies</li>
            <li>The exact split (your donation, any fee cover, the total charged, what the organisation receives, the platform fee and card processing) is shown before you pay and on your receipt</li>
            <li>All donations are processed in GBP (British Pounds Sterling)</li>
            <li>You will receive an email confirmation of your donation</li>
          </ul>
          <p className="mt-4">
            Depending on how an approved organisation is set up, its share is paid out either through its
            connected Stripe account or, for organisations approved for bank payouts (via Wise or a manual
            transfer), it settles to Root ProjX first and is held until the organisation's next payout.
            Every payout carries a reference the organisation can match against its records.
          </p>
        </Section>

        <Section title="4. Platform Fee Disclosure">
          <p className="mb-4">
            Root ProjX charges a 5% platform fee on the amount you choose to give. Card processing is a
            separate fee. These examples use a UK card; card processing is an estimate and can vary by card.
          </p>
          <FeeExamples />
        </Section>

        <Section title="5. Organisation Verification">
          <p className="mb-3">
            Root ProjX verifies organisations before they can receive donations. Our verification process includes:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>Review of organisation registration documents, charitable status, or evidence of legitimate operation</li>
            <li>Confirmation of contact details and stated charitable purpose</li>
            <li>Stripe identity and bank account verification for payment setup</li>
          </ul>
          <p className="mt-4">
            Verification does not constitute an endorsement of an organisation's work, values, or impact.
            It confirms that the organisation is who they say they are.
          </p>
        </Section>

        <Section title="6. Refund Policy">
          <p>
            All donations made through Root ProjX are final and non-refundable. Once a donation is processed
            it cannot be reversed.
          </p>
          <p className="mt-3 mb-3">
            Root ProjX reserves the right to issue a discretionary refund only in the following exceptional circumstances:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>A technical error resulted in a duplicate or incorrect charge</li>
            <li>The donation was made fraudulently without the account holder's consent</li>
            <li>The recipient organisation's account is suspended or removed following a verification failure</li>
          </ul>
          <p className="mt-4">
            To request a discretionary refund, contact{" "}
            <a href="mailto:info@rootprojx.com" className="underline hover:opacity-80">info@rootprojx.com</a>{" "}
            within 48 hours of the transaction with your transaction reference. Approved refunds will be
            returned to the original payment method within 5–10 business days.
          </p>
        </Section>

        <Section title="7. Age Requirements">
          <ul className="list-disc list-inside space-y-2">
            <li>You must be 18 years of age or older to make a donation independently through Root ProjX</li>
            <li>Users aged 13–17 may use the platform but may only donate with the explicit consent of a parent or legal guardian</li>
          </ul>
          <p className="mt-4">
            By completing a donation you confirm that you are 18 or over, or that you have obtained the
            required parental or guardian consent.
          </p>
        </Section>

        <Section title="8. Organisation Responsibilities">
          <p className="mb-3">Organisations listed on Root ProjX agree to:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Use donations exclusively for the purposes described in their profile and campaigns</li>
            <li>Provide regular impact updates to their supporters on the platform</li>
            <li>Comply with all applicable laws in their country of operation</li>
            <li>Notify Root ProjX immediately of any change in registration status, legal standing, or operational circumstances</li>
            <li>Set up how they receive payouts: Stripe Connect, or a bank payout (via Wise or manual transfer) where approved</li>
            <li>Not misrepresent their activities, impact, or use of funds</li>
          </ul>
          <p className="mt-4">
            Root ProjX reserves the right to suspend or remove any organisation that breaches these
            obligations. In such cases, any donations processed but not yet paid out will be handled in
            accordance with applicable law and the Charities Act 2011.
          </p>
        </Section>

        <Section title="9. Gift Aid">
          <p>
            Root ProjX is not currently registered as a Gift Aid intermediary with HMRC. Donations made
            through Root ProjX are not currently eligible for Gift Aid. We intend to apply for Gift Aid
            intermediary status and will notify registered users when this becomes available.
          </p>
        </Section>

        <Section title="10. VAT">
          <p>
            Donations made by supporters to organisations are not subject to VAT. Root ProjX's 5% platform
            fee may be subject to VAT where applicable. If Root ProjX's annual taxable turnover from platform
            fees exceeds the current VAT registration threshold (£90,000 as of 2026), Root ProjX will register
            for VAT in accordance with HMRC requirements. This will not affect the amount received by
            organisations or paid by donors.
          </p>
        </Section>

        <Section title="11. Limitation of Liability">
          <p className="mb-3">Root ProjX acts as a technology platform and payment facilitator only. We are not responsible for:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>How organisations use the funds they receive</li>
            <li>The accuracy of information provided by organisations on their profiles</li>
            <li>The outcomes, impact, or delivery of any organisation's stated mission</li>
            <li>Any losses arising from the failure of an organisation to deliver on its stated purpose</li>
            <li>Any technical failures, interruptions, or errors in the Stripe payment system</li>
          </ul>
          <p className="mt-4">
            Root ProjX's total liability to any donor in connection with a donation shall not exceed the
            amount of that donation. Nothing in these terms limits Root ProjX's liability for fraud, death,
            or personal injury caused by negligence.
          </p>
        </Section>

        <Section title="12. Data &amp; Privacy">
          <p>
            Your personal data is collected and processed in accordance with our{" "}
            <a href="/privacy" className="underline hover:opacity-80">Privacy Policy</a>,
            available at{" "}
            <a href="https://www.rootprojx.com/privacy" className="underline hover:opacity-80">www.rootprojx.com/privacy</a>.
            Root ProjX is registered with the ICO (reference: ZC152619). By making a donation you confirm
            you have read and understood our Privacy Policy.
          </p>
        </Section>

        <Section title="13. Governing Law">
          <p>
            These terms are governed by the laws of England and Wales. Any disputes that cannot be resolved
            informally shall be subject to the exclusive jurisdiction of the courts of England and Wales.
          </p>
        </Section>

        <Section title="14. Changes to These Terms">
          <p>
            Root ProjX reserves the right to update these terms from time to time. Material changes will be
            notified to registered users by email. Continued use of the platform after changes take effect
            constitutes acceptance of the updated terms.
          </p>
        </Section>

        <Section title="15. Contact" last>
          <p className="mb-3">For any questions about these terms or about a donation you have made:</p>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Root ProjX Ltd</p>
            <p>51 Russell Row, Lewes, East Sussex, BN7 2EE</p>
            <p>Email: <a href="mailto:info@rootprojx.com" className="underline hover:opacity-80">info@rootprojx.com</a></p>
            <p>Website: <a href="https://www.rootprojx.com" className="underline hover:opacity-80">www.rootprojx.com</a></p>
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
