type BankTransferRequest = {
  _id: string;
  name: string;
  country: string | null;
  payoutMethod?: "stripe" | "wise" | "bank_transfer" | null;
  payoutManualRequested?: boolean;
  payoutManualApproved?: boolean;
};

export function BankTransferApprovals({
  organisations, loading, error, onReview, onRefresh,
}: {
  organisations: BankTransferRequest[];
  loading: boolean;
  error: string;
  onReview: (id: string) => void;
  onRefresh: () => void;
}) {
  const pending = organisations.filter(org =>
    org.payoutMethod === "bank_transfer" &&
    org.payoutManualRequested === true && org.payoutManualApproved !== true);
  return (
    <section aria-labelledby="bank-approvals-title" data-testid="section-bank-transfer-approvals"
      style={{ background: "#fff", border: "1px solid #E0D8CC", borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 id="bank-approvals-title" style={{ margin: 0, fontSize: 18, color: "#7A0000" }}>
          Bank transfer approvals{!loading && !error ? ` (${pending.length})` : ""}
        </h2>
        <button onClick={onRefresh} disabled={loading} style={{ padding: "8px 12px", border: "1px solid #E0D8CC", borderRadius: 8, background: "#fff", cursor: loading ? "wait" : "pointer" }}>
          Refresh requests
        </button>
      </div>
      <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
        Confirm the organisation’s bank-transfer arrangement off-platform before approving.
        Approval enables donations; it does not send a payout. Never enter bank account details here.
      </p>
      {loading ? <p role="status">Loading bank-transfer requests…</p>
        : error ? <p role="alert" style={{ color: "#B50000" }}>{error}</p>
        : pending.length === 0 ? <p style={{ fontSize: 14, color: "#666" }}>No bank-transfer requests awaiting approval.</p>
        : <div style={{ display: "grid", gap: 10 }}>
          {pending.map(org => (
            <div key={org._id} data-testid={`bank-transfer-request-${org._id}`}
              style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, borderTop: "1px solid #E0D8CC", paddingTop: 12 }}>
              <div style={{ flex: "1 1 180px", minWidth: 0, overflowWrap: "anywhere" }}>
                <strong>{org.name}</strong>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>{org.country || "Country not provided"} · Awaiting approval</p>
              </div>
              <button data-testid={`button-review-bank-transfer-${org._id}`} onClick={() => onReview(org._id)}
                style={{ padding: "9px 14px", border: 0, borderRadius: 8, background: "#B50000", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                Review &amp; approve
              </button>
            </div>
          ))}
        </div>}
    </section>
  );
}
