import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  useGetEmailConfiguration, useSaveEmailConfiguration, useGetEmailHistory, useProcessPendingEmails,
  getGetEmailConfigurationQueryKey, getGetEmailHistoryQueryKey,
  useGetEmailJobStatus, useCreateEmailJobKey, getGetEmailJobStatusQueryKey,
} from "@workspace/api-client-react";

const st = (e: unknown) => (e as { status?: number } | null)?.status;
const msg = (e: unknown, f: string) => { const d = (e as { data?: { error?: unknown } } | null)?.data; return typeof d?.error === "string" ? d.error : f; };

function stateLabel(state: string, providerStatus?: number | null) {
  const s = state.toLowerCase();
  if (s === "delivered") return { text: "Delivered", bg: "#DCFCE7", color: "#166534" };
  if (s === "uncertain") return { text: "Uncertain: provider result unknown, check before resending", bg: "#FFEDD5", color: "#9A3412" };
  if (s === "sending") return { text: "Sending, not yet accepted", bg: "#E0E7FF", color: "#3730A3" };
  if (s === "needs_attention") return { text: `Needs attention${providerStatus ? ` (HTTP ${providerStatus})` : ""}`, bg: "#FEE2E2", color: "#991B1B" };
  if (s === "accepted" || s === "sent") return { text: "Accepted by provider, not yet confirmed delivered", bg: "#FEF9C3", color: "#92400E" };
  if (s === "failed" || s === "bounced" || s === "error" || s === "rejected") return { text: `${state}${providerStatus ? ` (HTTP ${providerStatus})` : ""}`, bg: "#FEE2E2", color: "#991B1B" };
  return { text: state, bg: "#EFE8DC", color: "#17100F" };
}

export function AdminEmailOps({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const qc = useQueryClient();
  const req = { headers: { "x-admin-token": token } };
  const cfg = useGetEmailConfiguration({ request: req, query: { queryKey: getGetEmailConfigurationQueryKey() } });
  const hist = useGetEmailHistory({ request: req, query: { queryKey: getGetEmailHistoryQueryKey() } });
  const saveCfg = useSaveEmailConfiguration({ request: req });
  const proc = useProcessPendingEmails({ request: req });
  const job = useGetEmailJobStatus({ request: req, query: { queryKey: getGetEmailJobStatusQueryKey() } });
  const createKey = useCreateEmailJobKey({ request: req });
  const [jobKey, setJobKey] = useState("");
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState("");
  const [recipient, setRecipient] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (cfg.data) setRecipient(cfg.data.adminRecipient || "info@rootprojx.com"); }, [cfg.data]);
  useEffect(() => {
    if ([cfg.error, hist.error, saveCfg.error, proc.error, job.error, createKey.error].some(e => st(e) === 401)) onUnauthorized();
  }, [cfg.error, hist.error, saveCfg.error, proc.error, job.error, createKey.error, onUnauthorized]);
  const makeKey = () => {
    if (job.data?.configured && !window.confirm("Rotate the scheduler key? The current key stops working immediately, so any existing scheduled caller will fail until you give it the new key.")) return;
    setJobKey(""); setCopied(""); setShown(false);
    createKey.mutate(undefined, { onSuccess: d => { setJobKey(d.key); qc.invalidateQueries({ queryKey: getGetEmailJobStatusQueryKey() }); } });
  };
  const copyKey = async () => {
    try { await navigator.clipboard.writeText(jobKey); setCopied("Copied."); } catch { setCopied("Copy failed. Reveal the key and copy it manually."); }
  };

  return <>
    <section aria-label="Admin mail recipient" style={{ background: "#FBF8F2", borderTop: "1.5px solid #17100F", padding: "16px 0", marginTop: 24 }}>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 6px" }}>Admin mail recipient</h2>
      <p style={{ fontSize: 13, color: "#6B5F5A", margin: "0 0 10px" }}>Where new applications and organisation responses are emailed. Only administrators can change this.</p>
      {cfg.isLoading ? <p role="status">Loading…</p> : cfg.isError ? <p role="alert" style={{ color: "#CA0813" }}>Couldn’t load the recipient. <button className="ops-btn ops-btn--sm" onClick={() => cfg.refetch()} data-testid="button-retry-email-config">Try again</button></p> :
        <form style={{ display: "flex", gap: 8, flexWrap: "wrap" }} onSubmit={e => {
          e.preventDefault(); setSaved(false);
          saveCfg.mutate({ data: { adminRecipient: recipient.trim() } }, { onSuccess: d => { qc.setQueryData(getGetEmailConfigurationQueryKey(), d); setSaved(true); } });
        }}>
          <input type="email" required maxLength={254} value={recipient} onChange={e => { setRecipient(e.target.value); setSaved(false); }}
            style={{ minHeight: 32, padding: "0 10px", fontSize: 14, minWidth: 260, border: "1px solid #17100F" }} aria-label="Admin recipient email" data-testid="input-admin-recipient" />
          <button className="ops-btn ops-btn--sm" disabled={saveCfg.isPending || !recipient.trim()} data-testid="button-save-admin-recipient">{saveCfg.isPending ? "Saving…" : "Save"}</button>
        </form>}
      {saved && <p role="status" style={{ fontSize: 13, color: "#166534" }} data-testid="status-admin-recipient-saved">Saved.</p>}
      {saveCfg.isError && <p role="alert" style={{ fontSize: 13, color: "#CA0813" }}>{msg(saveCfg.error, "Couldn’t save the recipient.")}</p>}
    </section>

    <section aria-label="Email scheduler" style={{ background: "#FBF8F2", borderTop: "1.5px solid #17100F", padding: "16px 0", marginTop: 24 }}>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 6px" }}>Email scheduler</h2>
      <p style={{ fontSize: 13, color: "#6B5F5A", margin: "0 0 10px" }}>Pending emails are sent when an external scheduler calls the endpoint below every five minutes with a POST request and the header <code>x-email-job-key</code>. This key is email-only and cannot access anything else. Creating a key does not start scheduling by itself: set it as <code>ROOTPROJX_EMAIL_JOB_KEY</code> in a separate scheduled caller that runs <code>artifacts/api-server/scripts/run-email-job.mjs</code>.</p>
      {job.isLoading ? <p role="status">Loading…</p> : job.isError ? <p role="alert" style={{ color: "#CA0813" }}>Couldn’t load scheduler status. <button className="ops-btn ops-btn--sm" onClick={() => job.refetch()} data-testid="button-retry-job-status">Try again</button></p> : job.data && <>
        <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 13, margin: "0 0 10px" }}>
          <dt style={{ fontWeight: 700 }}>Key</dt><dd style={{ margin: 0 }} data-testid="status-job-key">{job.data.configured ? "A scheduler key exists" : "No scheduler key yet"}</dd>
          <dt style={{ fontWeight: 700 }}>Endpoint</dt><dd style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", overflowWrap: "anywhere" }} data-testid="text-job-endpoint">POST {job.data.endpoint}</dd>
          <dt style={{ fontWeight: 700 }}>Last run</dt><dd style={{ margin: 0 }} data-testid="status-job-last-run">{job.data.lastRunAt ? `${new Date(job.data.lastRunAt).toLocaleString("en-GB")}, ${job.data.lastRunFailed ? "failed" : "completed"}` : "Never run by a scheduler"}</dd>
        </dl>
        {job.data.lastRunFailed && <p role="alert" style={{ fontSize: 13, color: "#CA0813" }}>The last scheduled run failed. Check the caller’s key and the delivery history below.</p>}
        <button className="ops-btn ops-btn--sm" disabled={createKey.isPending} onClick={makeKey} data-testid="button-create-job-key">{createKey.isPending ? "Creating…" : job.data.configured ? "Rotate key" : "Create key"}</button>
      </>}
      {createKey.isError && <p role="alert" style={{ fontSize: 13, color: "#CA0813" }}>{msg(createKey.error, "Couldn’t create a key. Try again.")}</p>}
      {jobKey && <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>This key is shown once. Copy it into your scheduled caller now.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type={shown ? "text" : "password"} readOnly value={jobKey} autoComplete="off" aria-label="New scheduler key"
            style={{ minHeight: 32, padding: "0 10px", fontSize: 13, minWidth: 260, flex: 1, border: "1px solid #17100F", fontFamily: "'JetBrains Mono', monospace" }} data-testid="input-job-key" />
          <button className="ops-btn ops-btn--sm" onClick={() => setShown(v => !v)} data-testid="button-toggle-job-key">{shown ? "Hide" : "Reveal"}</button>
          <button className="ops-btn ops-btn--sm ops-btn--ok" onClick={copyKey} data-testid="button-copy-job-key">Copy key</button>
          <button className="ops-btn ops-btn--sm" onClick={() => { setJobKey(""); setCopied(""); }} data-testid="button-dismiss-job-key">Done</button>
        </div>
        {copied && <p role="status" style={{ fontSize: 13 }}>{copied}</p>}
      </div>}
    </section>

    <section aria-label="Email delivery history" style={{ background: "#FBF8F2", borderTop: "1.5px solid #17100F", padding: "16px 0", marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, flex: 1 }}>Email delivery (last 100)</h2>
        <button className="ops-btn ops-btn--sm" onClick={() => hist.refetch()} disabled={hist.isFetching} data-testid="button-refresh-email-history"><RefreshCw size={13} /> Refresh</button>
        <button className="ops-btn ops-btn--sm ops-btn--ok" disabled={proc.isPending} data-testid="button-run-pending-emails"
          onClick={() => proc.mutate(undefined, { onSettled: () => qc.invalidateQueries({ queryKey: getGetEmailHistoryQueryKey() }) })}>
          {proc.isPending ? "Running…" : "Run pending work"}</button>
      </div>
      {proc.data && <p role="status" style={{ fontSize: 13 }} data-testid="status-process-result">Processed {proc.data.processed}. Failed {proc.data.failed}.{proc.data.failed > 0 ? " Check the failed rows below." : ""}</p>}
      {proc.isError && <p role="alert" style={{ fontSize: 13, color: "#CA0813" }}>{msg(proc.error, "Pending work didn’t run. Try again.")}</p>}
      <p style={{ fontSize: 12, color: "#6B5F5A" }}>Accepted means the email provider took the message. Only Delivered means it reached the inbox server.</p>
      {hist.isLoading ? <div className="ops-empty" role="status">Loading…</div> : hist.isError ? <p role="alert" style={{ color: "#CA0813" }}>Couldn’t load delivery history. <button className="ops-btn ops-btn--sm" onClick={() => hist.refetch()}>Try again</button></p> :
        !hist.data?.length ? <div className="ops-empty">No emails recorded yet.</div> :
        <div className="ops-table-wrap"><table className="ops-table" data-testid="table-email-history">
          <thead><tr><th>Recipient</th><th>Template</th><th>State</th><th>Created</th><th>Updated</th></tr></thead>
          <tbody>{hist.data.slice(0, 100).map(h => { const s = stateLabel(h.state, h.providerStatus); return <tr key={h.id} data-testid={`row-email-${h.id}`}>
            <td style={{ overflowWrap: "anywhere" }}>{h.recipient}</td><td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{h.templateId}</td>
            <td><span className="ops-chip" style={{ background: s.bg, color: s.color }}>{s.text}</span>{h.detail && <small style={{ display: "block", marginTop: 6 }}>{h.detail}</small>}</td>
            <td style={{ fontSize: 12 }}>{new Date(h.createdAt).toLocaleString("en-GB")}</td><td style={{ fontSize: 12 }}>{new Date(h.updatedAt).toLocaleString("en-GB")}</td>
          </tr>; })}</tbody>
        </table></div>}
    </section>
  </>;
}
