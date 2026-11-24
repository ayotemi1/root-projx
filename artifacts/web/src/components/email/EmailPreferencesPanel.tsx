import { useEffect, useRef, useState } from "react";
import {
  useReadEmailPreferences, useSaveEmailPreferences,
  type EmailPreferences, type EmailPreferenceInput,
} from "@workspace/api-client-react";

export function errStatus(e: unknown): number | undefined {
  return (e as { status?: number } | null)?.status;
}
export function errText(e: unknown): string {
  const d = (e as { data?: { error?: unknown } } | null)?.data;
  return typeof d?.error === "string" ? d.error : "";
}

/** Reads preferences via POST only on mount; mutates only on explicit toggle. */
export function EmailPreferencesPanel({ token, accessKey, first = false }: { token?: string | null; accessKey?: string; first?: boolean }) {
  const init: RequestInit = token
    ? { credentials: "include", headers: { Authorization: `Bearer ${token}` } }
    : { credentials: "include" };
  const read = useReadEmailPreferences({ request: init });
  const save = useSaveEmailPreferences({ request: init });
  const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const readRef = useRef(read.mutate);
  readRef.current = read.mutate;
  const load = () => readRef.current({ data: accessKey ? { accessKey } : {} }, { onSuccess: setPrefs });
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [accessKey, token]);

  if (read.isError && !prefs) {
    const s = errStatus(read.error);
    const msg = s === 401 || s === 403 || s === 404 || s === 410
      ? accessKey
        ? "This preferences link has expired or isn’t valid. Open the most recent email from Root ProjX, or sign in and change these in Settings."
        : "We couldn’t confirm your account for email preferences. Sign in again and retry."
      : "We couldn’t load your email preferences.";
    return <section className={`rpa-box${first ? " first" : ""}`} data-testid="section-email-preferences">
      <h2 className="rpa-h2">Email preferences</h2>
      <p className="rpa-err" role="alert" data-testid="status-email-preferences-error">{msg}</p>
      <div className="rpa-row"><button type="button" className="rpa-btn sm" onClick={load} data-testid="button-retry-email-preferences">Try again</button></div>
    </section>;
  }
  if (!prefs) return <section className={`rpa-box${first ? " first" : ""}`} data-testid="section-email-preferences">
    <h2 className="rpa-h2">Email preferences</h2><div className="rpa-skel" role="status" aria-label="Loading email preferences" />
  </section>;

  const apply = (patch: Omit<EmailPreferenceInput, "accessKey">) => {
    const prev = prefs;
    setPrefs({ ...prefs, ...patch } as EmailPreferences);
    setStatus("idle");
    save.mutate({ data: { ...patch, ...(accessKey ? { accessKey } : {}) } }, {
      onSuccess: next => { setPrefs(next); setStatus("saved"); },
      onError: () => { setPrefs(prev); setStatus("error"); },
    });
  };
  const sw = (id: string, label: string, on: boolean, patch: (v: boolean) => Omit<EmailPreferenceInput, "accessKey">) => (
    <tr key={id}><td>{label}</td><td className="c">
      <button type="button" role="switch" aria-checked={on} aria-label={label} className="rpa-switch"
        disabled={save.isPending} data-testid={`switch-email-${id}`} onClick={() => apply(patch(!on))}>{on ? "On" : "Off"}</button>
    </td></tr>
  );

  return <section className={`rpa-box${first ? " first" : ""}`} aria-labelledby="rpa-email-prefs" data-testid="section-email-preferences">
    <h2 className="rpa-h2" id="rpa-email-prefs">Email preferences</h2>
    <table className="rpa-table">
      <thead><tr><th scope="col">Send me emails about</th><th scope="col" className="c">Email</th></tr></thead>
      <tbody>
        {sw("welcome", "Welcome and getting started", prefs.welcome, v => ({ welcome: v }))}
        {sw("campaign-goals", "Campaign goals reached", prefs.campaignGoals, v => ({ campaignGoals: v }))}
        <tr><td colSpan={2} style={{ fontSize: 12, color: "#6B625E" }}>Your account’s campaign-email switch also applies. You can change it in Settings.</td></tr>
        {prefs.isOrganisation && sw("org-gifts", "New gifts to your organisation", prefs.orgGifts, v => ({ orgGifts: v }))}
      </tbody>
    </table>
    {prefs.isOrganisation && prefs.orgGifts && (
      <div className="rpa-hint" style={{ marginTop: 14 }} data-testid="status-gift-frequency-every-gift">
        <b>Every gift</b> — An email each time someone gives.
      </div>
    )}
    <p className="rpa-hint" style={{ marginTop: 14 }}>Receipts, security and account emails are always sent.</p>
    <div aria-live="polite">
      {save.isPending && <p className="rpa-hint" role="status">Saving…</p>}
      {status === "saved" && !save.isPending && <p className="rpa-hint" data-testid="status-email-preferences-saved">Saved</p>}
      {status === "error" && <p className="rpa-err" role="alert" data-testid="status-email-preferences-save-error">
        {errStatus(save.error) === 401 || errStatus(save.error) === 403 || errStatus(save.error) === 410 ? "This link has expired. Open your latest email or sign in to change preferences." : "Couldn’t save. Try again."}
      </p>}
    </div>
  </section>;
}
