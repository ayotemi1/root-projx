import { userErrorMessage } from "@/lib/error-feedback";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Lock, RefreshCw, Send, Wallet, X } from "lucide-react";
import type { PayoutOrgSummary, PayoutSettlementResult } from "@workspace/api-client-react";
import {
  adminPayoutsKey, getAdminPayouts, gbp, markPayoutSent, METHOD_LABEL, payoutDate,
  PAYOUT_POLICY_TEXT, PayoutApiError, runPayouts,
} from "@/lib/payouts-api";

const RED_DEEP = "#7A0000";
const RED = "#B50000";
const BORDER = "#E0D8CC";

const btn = (disabled: boolean, primary = false): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700,
  border: primary ? "none" : `1.5px solid ${BORDER}`, background: primary ? RED : "#fff", color: primary ? "#fff" : RED_DEEP,
  cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
});

const RESULT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  sent: { bg: "#DCFCE7", color: "#166534", label: "Sent" },
  failed: { bg: "#FEE2E2", color: "#991B1B", label: "Failed" },
  not_due: { bg: "#F2EDE4", color: "#555", label: "Not due" },
  needs_manual_settlement: { bg: "#FEF9C3", color: "#92400E", label: "Needs manual settlement" },
  locked: { bg: "#E0E7FF", color: "#3730A3", label: "Locked (reconciliation)" },
  queued: { bg: "#FEF9C3", color: "#92400E", label: "Queued" },
};

function Pill({ status }: { status: string }) {
  const s = RESULT_STYLE[status] ?? { bg: "#F2EDE4", color: "#555", label: status };
  return <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{s.label}</span>;
}

function Modal({ title, onClose, children, busy }: { title: string; onClose: () => void; children: React.ReactNode; busy: boolean }) {
  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(20,10,5,0.55)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "min(480px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <button aria-label="Close" disabled={busy} onClick={onClose} style={{ border: 0, background: "transparent", cursor: busy ? "not-allowed" : "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AdminPayouts({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const qc = useQueryClient();
  const [markOrg, setMarkOrg] = useState<PayoutOrgSummary | null>(null);
  const [reference, setReference] = useState("");
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [markError, setMarkError] = useState("");
  const [notice, setNotice] = useState("");
  const [showRun, setShowRun] = useState(false);
  const [runAck, setRunAck] = useState(false);
  const [runResults, setRunResults] = useState<PayoutSettlementResult[] | null>(null);
  const [runError, setRunError] = useState("");

  const handleAuth = (e: unknown) => { if (e instanceof PayoutApiError && e.status === 401) onUnauthorized(); };

  const q = useQuery({
    queryKey: adminPayoutsKey,
    queryFn: async () => {
      try { return await getAdminPayouts(token); } catch (e) { handleAuth(e); throw e; }
    },
    enabled: !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const markMut = useMutation({
    mutationFn: (v: { orgId: string; reference: string }) => markPayoutSent(token, v),
    onSuccess: (r) => {
      setMarkOrg(null);
      setNotice(`Marked ${gbp(r.amountGbp)} as sent for ${r.orgName}.`);
      qc.invalidateQueries({ queryKey: adminPayoutsKey });
    },
    onError: (e: Error) => {
      handleAuth(e);
      if (e instanceof PayoutApiError && e.status === 409) {
        const st = (e.body as { status?: string } | null)?.status;
        setMarkError(st === "locked"
          ? "This organisation is locked for reconciliation: a previous settlement may not have finished recording. Nothing was marked as sent. Reconcile it with the provider records before trying again."
          : st === "not_due" ? "No eligible balance to settle. Nothing was marked as sent." : e.message);
      } else setMarkError(e.message || "Could not mark as sent.");
      qc.invalidateQueries({ queryKey: adminPayoutsKey });
    },
  });

  const runMut = useMutation({
    mutationFn: () => runPayouts(token),
    onSuccess: (r) => {
      setShowRun(false);
      setRunResults(r.results);
      qc.invalidateQueries({ queryKey: adminPayoutsKey });
    },
    onError: (e: Error) => {
      handleAuth(e);
      setRunError(e.message || "Payout run failed.");
      qc.invalidateQueries({ queryKey: adminPayoutsKey });
    },
  });

  const data = q.data;
  const busy = markMut.isPending || runMut.isPending;
  const anyEligible = !!data?.organisations.some((o) => o.eligibleTotalGbp > 0 && !o.settlementLocked);
  const history = [...(data?.payouts ?? [])].sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt));

  function openMark(o: PayoutOrgSummary) {
    setMarkOrg(o); setReference(""); setConfirmPaid(false); setMarkError(""); setNotice("");
  }

  const TH: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: "12px 14px", borderTop: "1px solid #f0ece4", fontSize: 13, color: "#444", verticalAlign: "top" };

  return (
    <div data-testid="section-admin-payouts">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}>Payouts</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888", maxWidth: 560 }}>{PAYOUT_POLICY_TEXT}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => q.refetch()} disabled={q.isFetching} style={btn(q.isFetching)} data-testid="button-refresh-payouts">
            <RefreshCw size={13} /> {q.isFetching ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={() => { setRunAck(false); setRunError(""); setShowRun(true); }}
            disabled={busy || !data || !anyEligible}
            title={!anyEligible ? "No unlocked organisation has an eligible balance" : undefined}
            style={btn(busy || !data || !anyEligible, true)}
            data-testid="button-run-payouts"
          >
            <Send size={13} /> Run payouts
          </button>
        </div>
      </div>

      {notice && <p role="status" style={{ background: "#DCFCE7", color: "#166534", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{notice}</p>}

      {q.isLoading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ height: 56, borderRadius: 12, background: "#e9e2d6" }} />)}
        </div>
      ) : q.isError || !data ? (
        <div role="alert" style={{ background: "#FEE2E2", color: "#991B1B", padding: 14, borderRadius: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <AlertTriangle size={16} /> <span style={{ flex: 1 }}>{userErrorMessage(q.error, "load payout records")}</span>
          <button onClick={() => q.refetch()} style={btn(false)}>Retry</button>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
              <p style={{ margin: 0, fontSize: 12, color: "#888", fontWeight: 700, textTransform: "uppercase" }}>Total queued</p>
              <p data-testid="text-total-queued" style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 800, color: RED_DEEP }}>{gbp(data.totalQueuedGbp)}</p>
            </div>
            <div style={{ background: data.failureCount > 0 ? "#FEE2E2" : "#fff", borderRadius: 12, padding: 16, border: `1px solid ${data.failureCount > 0 ? "#FCA5A5" : BORDER}` }}>
              <p style={{ margin: 0, fontSize: 12, color: "#888", fontWeight: 700, textTransform: "uppercase" }}>Failures</p>
              <p data-testid="text-failure-count" style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 800, color: data.failureCount > 0 ? RED : "#1a1a1a" }}>{data.failureCount}</p>
            </div>
          </div>

          {runResults && (
            <div data-testid="section-run-results" style={{ background: "#fff", borderRadius: 12, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>Last run results</h2>
                <button onClick={() => setRunResults(null)} aria-label="Dismiss results" style={{ border: 0, background: "transparent", cursor: "pointer" }}><X size={16} /></button>
              </div>
              {runResults.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: "#888" }}>No organisations were processed.</p> : (
                <>
                  {runResults.some((r) => r.status === "needs_manual_settlement") && (
                    <div style={{ background: "#FEF9C3", color: "#92400E", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                      <strong>Needs manual settlement:</strong>{" "}
                      {runResults.filter((r) => r.status === "needs_manual_settlement").map((r) => `${r.orgName} (${gbp(r.amountGbp)})`).join(", ")}. Pay these off-platform, then use Mark as sent.
                    </div>
                  )}
                  {runResults.some((r) => r.status === "locked") && (
                    <div style={{ background: "#E0E7FF", color: "#3730A3", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                      <strong>Locked for reconciliation (skipped):</strong>{" "}
                      {runResults.filter((r) => r.status === "locked").map((r) => r.orgName).join(", ")}. A previous settlement may not have finished recording. Check provider records and reconcile before any further payout; do not retry blindly.
                    </div>
                  )}
                  <div style={{ display: "grid", gap: 8 }}>
                    {runResults.map((r) => (
                      <div key={r.orgId} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #f0ece4" }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{r.orgName}</span>
                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 13 }}>{gbp(r.amountGbp)}</span>
                          <Pill status={r.status} />
                        </span>
                        {(r.wiseTransferId != null || r.error) && (
                          <span style={{ width: "100%", fontSize: 12, color: r.error ? RED : "#666" }}>
                            {r.error ? r.error : `Wise transfer ${r.wiseTransferId}`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Organisations</h2>
          {data.organisations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 16px", background: "#fff", borderRadius: 12, marginBottom: 20 }}>
              <Wallet size={32} color="#ccc" style={{ margin: "0 auto 8px" }} />
              <p style={{ color: "#888", fontSize: 14, margin: 0 }}>Nothing queued. {gbp(0)} awaiting payout.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
              {data.organisations.map((o) => {
                const disabled = busy || o.settlementLocked || o.eligibleTotalGbp <= 0;
                return (
                  <div key={o.orgId} data-testid={`row-payout-org-${o.orgId}`} style={{ background: "#fff", borderRadius: 12, padding: 14, border: `1px solid ${BORDER}`, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{o.orgName}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: o.method === "none" ? RED : "#888" }}>{METHOD_LABEL[o.method] ?? o.method}</p>
                    </div>
                    <div style={{ flex: "1 1 220px", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
                      <span><span style={{ color: "#888" }}>Queued </span><strong>{gbp(o.queuedTotalGbp)}</strong></span>
                      <span><span style={{ color: "#888" }}>Eligible </span><strong>{gbp(o.eligibleTotalGbp)}</strong></span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {o.settlementLocked
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Lock size={12} color="#3730A3" /><Pill status="locked" /></span>
                        : o.due ? <span style={{ background: "#DCFCE7", color: "#166534", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>Due</span>
                        : <Pill status="not_due" />}
                      <button onClick={() => openMark(o)} disabled={disabled} style={btn(disabled)} data-testid={`button-mark-sent-${o.orgId}`}
                        title={o.settlementLocked ? "Locked for reconciliation" : o.eligibleTotalGbp <= 0 ? "No eligible balance (donations under 7 days old are excluded)" : undefined}>
                        Mark as sent
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Payout history</h2>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 16px", background: "#fff", borderRadius: 12, color: "#888", fontSize: 14 }}>No payout records yet.</div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 12, overflowX: "auto", border: `1px solid ${BORDER}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                <thead><tr style={{ background: "#f9f6f0" }}>
                  <th style={TH}>Date</th><th style={TH}>Organisation</th><th style={TH}>Amount</th><th style={TH}>Method</th><th style={TH}>Status</th><th style={TH}>Reference / transfer</th>
                </tr></thead>
                <tbody>
                  {history.map((p) => {
                    const failed = p.status === "failed";
                    return (
                      <tr key={p._id} data-testid={`row-payout-${p._id}`} style={{ background: failed ? "#FEF2F2" : undefined }}>
                        <td style={TD}>{payoutDate(p.sentAt ?? p.createdAt)}</td>
                        <td style={{ ...TD, fontWeight: 700 }}>{p.orgName}</td>
                        <td style={TD}>{gbp(p.amountGbp)}</td>
                        <td style={TD}>{METHOD_LABEL[p.method] ?? p.method}</td>
                        <td style={TD}><Pill status={p.status} /></td>
                        <td style={{ ...TD, color: failed ? RED : "#444", wordBreak: "break-word" }}>
                          {failed && p.error ? p.error : p.reference ?? (p.wiseTransferId != null ? `Wise ${p.wiseTransferId}` : "—")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {markOrg && (
        <Modal title="Mark as sent" busy={markMut.isPending} onClose={() => setMarkOrg(null)}>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#444" }}>
            Record that <strong>{markOrg.orgName}</strong> has been paid <strong>{gbp(markOrg.eligibleTotalGbp)}</strong> off-platform.
            Payouts younger than 7 days are excluded and stay queued.
          </p>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700, color: "#444" }}>
            Transfer reference
            <input value={reference} maxLength={120} onChange={(e) => { setReference(e.target.value); setMarkError(""); }} disabled={markMut.isPending}
              data-testid="input-payout-reference" style={{ padding: "10px 12px", border: "1.5px solid #ddd5ca", borderRadius: 8, fontSize: 14 }} />
          </label>
          <p style={{ fontSize: 12, color: "#888", margin: "6px 0 12px" }}>Enter the bank or Wise transfer reference only. Never enter account numbers or sort codes.</p>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "#444", marginBottom: 12 }}>
            <input type="checkbox" checked={confirmPaid} onChange={(e) => setConfirmPaid(e.target.checked)} disabled={markMut.isPending} data-testid="checkbox-confirm-paid" style={{ marginTop: 3 }} />
            I confirm {gbp(markOrg.eligibleTotalGbp)} has already been paid to {markOrg.orgName}.
          </label>
          {markError && <p role="alert" style={{ color: RED, background: "#FEE2E2", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}>{markError}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setMarkOrg(null)} disabled={markMut.isPending} style={btn(markMut.isPending)}>Cancel</button>
            <button
              onClick={() => markMut.mutate({ orgId: markOrg.orgId, reference: reference.trim() })}
              disabled={markMut.isPending || !confirmPaid || !reference.trim()}
              style={btn(markMut.isPending || !confirmPaid || !reference.trim(), true)}
              data-testid="button-confirm-mark-sent"
            >
              {markMut.isPending ? "Saving…" : "Mark as sent"}
            </button>
          </div>
        </Modal>
      )}

      {showRun && data && (
        <Modal title="Run payouts" busy={runMut.isPending} onClose={() => setShowRun(false)}>
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 13, display: "flex", gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} /> This sends real funds via Wise to every due organisation. It cannot be undone.
          </div>
          <p style={{ fontSize: 13, color: "#444", margin: "0 0 12px" }}>
            {data.organisations.filter((o) => o.due && !o.settlementLocked).length} organisation(s) currently due. Manual-method organisations will be listed for off-platform settlement; locked organisations are skipped.
          </p>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "#444", marginBottom: 12 }}>
            <input type="checkbox" checked={runAck} onChange={(e) => setRunAck(e.target.checked)} disabled={runMut.isPending} data-testid="checkbox-confirm-run" style={{ marginTop: 3 }} />
            I understand this moves real money.
          </label>
          {runError && <p role="alert" style={{ color: RED, background: "#FEE2E2", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}>{runError}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowRun(false)} disabled={runMut.isPending} style={btn(runMut.isPending)}>Cancel</button>
            <button onClick={() => { setRunError(""); runMut.mutate(); }} disabled={runMut.isPending || !runAck} style={btn(runMut.isPending || !runAck, true)} data-testid="button-confirm-run">
              {runMut.isPending ? "Running…" : "Run payouts now"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
