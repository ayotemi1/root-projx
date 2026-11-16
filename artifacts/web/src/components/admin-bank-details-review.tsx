import { appFetch as fetch, userErrorMessage } from "@/lib/error-feedback";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";

const RED_DEEP = "#7A0000";
const RED = "#B50000";

type Details = Record<string, string | null | undefined>;
interface ReviewResponse {
  hasDetails: boolean;
  revision: string | null;
  submittedAt: string | null;
  approved: boolean;
  details: Details | null;
}

const LABELS: Array<[string, string]> = [
  ["accountHolder", "Account holder"], ["bankName", "Bank"], ["bankCountry", "Bank country"], ["currency", "Currency"],
  ["accountNumber", "Account number"], ["iban", "IBAN"], ["routingCode", "Sort code / routing"], ["swiftBic", "SWIFT / BIC"],
  ["branchName", "Branch"], ["bankAddress", "Bank address"], ["beneficiaryAddress", "Beneficiary address"],
];
const MONO = new Set(["accountNumber", "iban", "routingCode", "swiftBic", "bankCountry", "currency"]);

const btn = (primary: boolean, disabled: boolean): React.CSSProperties => ({
  padding: "10px 16px", borderRadius: 8, fontWeight: 800, fontSize: 13,
  border: primary ? 0 : "1px solid #d8d0c5", background: primary ? "#16a34a" : "#fff", color: primary ? "#fff" : RED_DEEP,
  cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 6,
});

export function AdminBankDetailsReview({ orgId, orgName, contactEmail, token, onUnauthorized, onApproved, onBusyChange }: {
  orgId: string; orgName: string; contactEmail?: string; token: string;
  onUnauthorized: () => void; onApproved: () => void; onBusyChange?: (busy: boolean) => void;
}) {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const alive = useRef(true);
  const busyRef = useRef(onBusyChange);
  busyRef.current = onBusyChange;

  useEffect(() => {
    alive.current = true;
    void load("", false, false);
    return () => { alive.current = false; setData(null); };
  }, []);
  useEffect(() => { busyRef.current?.(loading || approving); }, [loading, approving]);

  async function load(note = "", afterApproval = false, reveal = true) {
    if (loading || (approving && !afterApproval)) return;
    setLoading(true); setError(note); setVerified(false); setData(null);
    try {
      const res = await fetch(`/api/admin/organisations/${orgId}/bank-details${reveal ? "" : "/status"}`, { headers: { "x-admin-token": token }, cache: "no-store" });
      if (res.status === 401) { onUnauthorized(); return; }
      const body = await res.json().catch(() => ({})) as ReviewResponse & { error?: string };
      if (!alive.current) return;
      if (!res.ok) { setError(userErrorMessage({ message: body.error, status: res.status }, "load the bank details for review")); return; }
      setData({ hasDetails: !!body.hasDetails, revision: body.revision ?? null, submittedAt: body.submittedAt ?? null, approved: !!body.approved, details: body.details ?? null });
    } catch (error) {
      if (alive.current) setError(userErrorMessage(error, "load the bank details for review"));
    } finally {
      if (alive.current) setLoading(false);
    }
  }

  async function approve() {
    if (!data?.details || !data.revision || !verified || approving) return;
    setApproving(true); setError("");
    try {
      const res = await fetch(`/api/admin/organisations/${orgId}/bank-details/approve`, {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ revision: data.revision }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const body = await res.json().catch(() => ({})) as { approved?: boolean; error?: string };
      if (!alive.current) return;
      if (res.status === 409 || res.status === 503) {
        setApproving(false);
        await load(res.status === 409
          ? "Approval was not confirmed. Details may have changed or secure review may be unavailable. Reveal the latest details and verify again."
          : "Bank details service unavailable. Approval was not confirmed. Reloaded for review.", true, false);
        return;
      }
      if (!res.ok || body.approved !== true) { setError(userErrorMessage({ message: body.error, status: res.status }, "confirm bank-details approval") + " Reload the latest details before approving again."); return; }
      setData(null);
      onApproved();
    } catch {
      if (alive.current) setError("We couldn’t confirm bank-details approval. Check your connection, reload the latest details and verify their status before approving again. If it continues, contact Root ProjX.");
    } finally {
      if (alive.current) setApproving(false);
    }
  }

  const d = data?.details;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="section-admin-bank-review">
      <div style={{ background: "#FEF9C3", color: "#92400E", borderRadius: 8, padding: "10px 12px", fontSize: 12, lineHeight: 1.5, display: "flex", gap: 8 }}>
        <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Private banking data. Do not copy, screenshot or share. Details are cleared when this window closes. Approving sends no money.</span>
      </div>

      {!data && (
        <button data-testid="button-bank-status-retry" onClick={() => load("", false, false)} disabled={loading} style={{ ...btn(false, loading), alignSelf: "flex-start" }}>
          {loading ? "Loading status…" : "Retry status"}
        </button>
      )}

      {error && <p role="alert" style={{ margin: 0, color: RED, fontSize: 13 }} data-testid="error-admin-bank-review">{error}</p>}

      {data && !data.hasDetails && (
        <div data-testid="text-admin-bank-none" style={{ background: "#f9f6f0", borderRadius: 8, padding: 12, fontSize: 13, color: "#444", lineHeight: 1.5 }}>
          <strong>No bank details on file.</strong> {orgName} must add them in their dashboard under Payouts (How you get paid, Bank transfer) before this can be approved.
        </div>
      )}

      {data?.hasDetails && !d && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13 }}>Bank details on file · {data.approved ? "Approved" : "Awaiting review"}</p>
          <dl style={{ margin: 0, fontSize: 13 }} data-testid="list-masked-bank-details">
            {LABELS.map(([key, label]) => (
              <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 38%) 1fr", padding: "6px 0", gap: 10 }}>
                <dt>{label}</dt><dd style={{ margin: 0 }}>••••••</dd>
              </div>
            ))}
          </dl>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Values remain encrypted until you reveal this record. Each reveal is recorded in the access audit.</p>
          <button data-testid="button-reveal-bank-details" onClick={() => load()} disabled={loading || approving} style={{ ...btn(false, loading || approving), alignSelf: "flex-start" }}>
            <Eye size={14} /> Reveal
          </button>
        </div>
      )}

      {data && d && (
        <>
          <div style={{ fontSize: 12, color: "#666" }}>
            Status: <strong style={{ color: data.approved ? "#166534" : "#92400E" }}>{data.approved ? "Approved" : "Awaiting review"}</strong>
            {data.submittedAt && <> · submitted {new Date(data.submittedAt).toLocaleString("en-GB")}</>}
          </div>
          <dl style={{ margin: 0, border: "1px solid #eee7dd", borderRadius: 8, overflow: "hidden", userSelect: "text" }} data-testid="list-admin-bank-details">
            {LABELS.filter(([k]) => d[k]).map(([k, label], i) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 38%) 1fr", gap: 10, padding: "8px 12px", background: i % 2 ? "#fff" : "#fbf8f3", fontSize: 13 }}>
                <dt style={{ color: "#888", fontWeight: 600 }}>{label}</dt>
                <dd style={{ margin: 0, color: "#1a1a1a", fontWeight: 600, wordBreak: "break-word", fontFamily: MONO.has(k) ? "Menlo, monospace" : undefined }}>{d[k]}</dd>
              </div>
            ))}
          </dl>
          <button onClick={() => { setData(previous => previous ? { ...previous, details: null } : null); setVerified(false); setError(""); }} disabled={approving} style={{ ...btn(false, approving), alignSelf: "flex-start", padding: "6px 10px", fontSize: 12 }} data-testid="button-hide-bank-details">
            <EyeOff size={13} /> Hide details
          </button>
          {!data.approved ? (
            <>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "#444", lineHeight: 1.45 }}>
                <input type="checkbox" checked={verified} disabled={approving} onChange={(e) => setVerified(e.target.checked)} data-testid="checkbox-bank-verified" style={{ marginTop: 3 }} />
                <span>I independently verified these exact details with {orgName} through a known contact{contactEmail ? ` (e.g. ${contactEmail})` : ""}, not via a reply to an unverified message.</span>
              </label>
              <button data-testid="button-approve-bank-details" onClick={approve} disabled={!verified || approving || loading} style={{ ...btn(true, !verified || approving || loading), alignSelf: "flex-end" }}>
                {approving ? "Approving…" : "Approve bank details"}
              </button>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "#166534" }}>These details are already approved.</p>
          )}
        </>
      )}
    </div>
  );
}
