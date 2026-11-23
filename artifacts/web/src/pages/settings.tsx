import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Lock } from "lucide-react";
import {
  getSupporterAccount, saveSupporterAccountSettings,
  type SupporterAccount, type SupporterAccountSettingsInput,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { accountKey, authInit } from "./account-shared";
import OrganisationSettingsSections from "@/components/organisation/OrganisationSettingsSections";
import "./account-pages.css";

type Category = keyof SupporterAccount["notifications"];
type Channel = "inApp" | "email";
const ROWS: { key: Category; label: string }[] = [
  { key: "updates", label: "Updates from organisations you follow" },
  { key: "comments", label: "Replies and comments" },
  { key: "messages", label: "New messages" },
  { key: "campaigns", label: "Campaigns you gave to" },
  { key: "receipts", label: "Receipts" },
];
const ORG_ROWS: { key: Category; label: string }[] = [
  { key: "updates", label: "New followers" },
  { key: "comments", label: "Likes and comments on your posts" },
  { key: "messages", label: "New messages" },
  { key: "campaigns", label: "Campaign milestones" },
  { key: "receipts", label: "New donations" },
];

/** Overlay of in-flight values; field id -> value. */
type Overlay = Record<string, string | boolean>;
const fieldOf = (p: SupporterAccountSettingsInput) =>
  p.visibility ? ["visibility", p.visibility] as const
  : p.messagePolicy ? ["messagePolicy", p.messagePolicy] as const
  : [`n.${p.notification!.category}.${p.notification!.channel}`, p.notification!.enabled] as const;

export default function SettingsPage() {
  const { token, user } = useAuth();
  const isOrg = user?.accountType === "organisation";
  const adminAccess = !!token?.startsWith("org-admin.");
  const rows = isOrg ? ORG_ROWS : ROWS;
  const qc = useQueryClient();
  const key = accountKey(token);
  const q = useQuery({ queryKey: key, queryFn: ({ signal }) => getSupporterAccount(authInit(token, signal)), enabled: !!token && !adminAccess });
  const [overlay, setOverlay] = useState<Overlay>({});
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const chain = useRef<Promise<void>>(Promise.resolve());
  const inflight = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; window.clearTimeout(timer.current); }; }, []);

  const save = (patch: SupporterAccountSettingsInput) => {
    const [field, value] = fieldOf(patch);
    setOverlay(o => ({ ...o, [field]: value }));
    setStatus("idle");
    inflight.current += 1;
    const tokenAtStart = token;
    chain.current = chain.current.then(async () => {
      try {
        const next = await saveSupporterAccountSettings(patch, authInit(tokenAtStart));
        qc.setQueryData(accountKey(tokenAtStart), next);
        inflight.current -= 1;
        setOverlay(o => { if (o[field] !== value) return o; const { [field]: _drop, ...rest } = o; return rest; });
        if (inflight.current === 0 && mounted.current) {
          setStatus(s => (s === "error" ? s : "saved"));
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setStatus("idle"), 2200);
        }
      } catch {
        inflight.current -= 1;
        setOverlay(o => { if (o[field] !== value) return o; const { [field]: _drop, ...rest } = o; return rest; });
        window.clearTimeout(timer.current);
        setStatus("error");
      }
    });
  };

  if (adminAccess) return <div className="rpa-page" data-testid="page-settings">
    <h1 className="rpa-h1">Settings</h1>
    <section className="rpa-box first"><p className="rpa-hint">Notification preferences and account controls are managed by the organisation owner. Admin access is limited to content management.</p></section>
    <OrganisationSettingsSections />
  </div>;
  if (q.isLoading || !token) {
    return <div className="rpa-page" data-testid="page-settings"><h1 className="rpa-h1">Settings</h1>{[0, 1, 2].map(i => <div key={i} className="rpa-skel" />)}</div>;
  }
  if (q.isError || !q.data) {
    return (
      <div className="rpa-page" data-testid="page-settings">
        <h1 className="rpa-h1">Settings</h1>
        <section className="rpa-box first"><p className="rpa-err" role="alert">Something went wrong, please try again</p>
          <div className="rpa-row"><button type="button" className="rpa-btn sm" onClick={() => q.refetch()} data-testid="button-retry-settings">Try again</button></div></section>
      </div>
    );
  }
  const acc = q.data;
  const visibility = (overlay.visibility as string | undefined) ?? acc.visibility;
  const messagePolicy = (overlay.messagePolicy as string | undefined) ?? acc.messagePolicy;
  const notif = (c: Category, ch: Channel) => {
    if (c === "receipts" && ch === "email") return true;
    const o = overlay[`n.${c}.${ch}`];
    return typeof o === "boolean" ? o : acc.notifications[c][ch];
  };

  const radio = (name: string, value: string, current: string, title: ReactNode, sub: string, onPick: () => void) => (
    <label className="rpa-radio">
      <input type="radio" name={name} value={value} checked={current === value} onChange={onPick} data-testid={`radio-${name}-${value}`} />
      <span><b>{title}</b><span className="rpa-hint">{sub}</span></span>
    </label>
  );

  return (
    <div className="rpa-page" data-testid="page-settings">
      <h1 className="rpa-h1">Settings</h1>

      {!isOrg && <>
      <section className="rpa-box first" aria-labelledby="rpa-vis">
        <h2 className="rpa-h2" id="rpa-vis">Profile visibility</h2>
        <div role="radiogroup" aria-labelledby="rpa-vis" className="rpa-radios">
          {radio("visibility", "public", visibility, <><Globe size={15} aria-hidden /> Public</>, "Anyone with the link can see your profile and public posts. Your posts may be recommended on Home.", () => save({ visibility: "public" }))}
          {radio("visibility", "private", visibility, <><Lock size={15} aria-hidden /> Private</>, "Your profile and posts are hidden from others, Home and public links. You can still see and manage them.", () => save({ visibility: "private" }))}
        </div>
      </section>

      <section className="rpa-box" aria-labelledby="rpa-msg">
        <h2 className="rpa-h2" id="rpa-msg">Messages</h2>
        <div role="radiogroup" aria-labelledby="rpa-msg" className="rpa-radios">
          {radio("messages", "followed", messagePolicy, "Organisations I follow", "Organisations you follow can message you. You can always message any organisation.", () => save({ messagePolicy: "followed" }))}
          {radio("messages", "replies", messagePolicy, "Only replies", "Organisations can only reply to messages you start.", () => save({ messagePolicy: "replies" }))}
        </div>
      </section>
      </>}

      <section className={`rpa-box${isOrg ? " first" : ""}`} aria-labelledby="rpa-notif">
        <h2 className="rpa-h2" id="rpa-notif">Notifications</h2>
        <table className="rpa-table">
          <thead><tr><th scope="col">Notify me about</th><th scope="col" className="c">In app</th><th scope="col" className="c">Email</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key}>
                <td>{r.label}</td>
                {(["inApp", "email"] as Channel[]).map(ch => {
                  const on = notif(r.key, ch);
                  const locked = r.key === "receipts" && ch === "email";
                  return (
                    <td key={ch} className="c">
                      <button type="button" role="switch" aria-checked={on} aria-disabled={locked || undefined}
                        aria-label={`${r.label} ${ch === "inApp" ? "in app" : "by email"}`}
                        className="rpa-switch" data-testid={`switch-${r.key}-${ch}`}
                        onClick={() => { if (!locked) save({ notification: { category: r.key, channel: ch, enabled: !on } }); }}>
                        {on ? "On" : "Off"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rpa-hint" style={{ marginTop: 14 }}>{isOrg ? "Donation and security emails are always sent." : "Receipts and security emails are always sent."}</p>
      </section>

      {isOrg ? <OrganisationSettingsSections /> : (
      <section className="rpa-box">
        <h2 className="rpa-h2">Interests</h2>
        <p className="rpa-hint">Used to suggest organisations on Discover.</p>
        <div className="rpa-row" style={{ marginTop: 12 }}><Link href="/settings/interests" className="rpa-btn sm" data-testid="link-edit-interests">Edit interests</Link></div>
      </section>
      )}

      <section className="rpa-box">
        <h2 className="rpa-h2">Account</h2>
        {acc.email ? <p className="rpa-mut" data-testid="text-account-email">Email: {acc.email}</p> :
          <p className="rpa-hint">You’re managing this organisation. Account sign-in details stay with its owner.</p>}
        <p className="rpa-hint">{isOrg ? "Messages and donation details are always private." : "Saved items, giving history, receipts and messages are always private."}</p>
      </section>

      <div aria-live="polite">
        {status === "saved" && <p className="rpa-saved" data-testid="status-saved">Saved</p>}
      </div>
      <div aria-live="assertive">
        {status === "error" && <p className="rpa-saved" style={{ background: "var(--rp-red)" }} data-testid="status-save-error">Couldn’t save. Try again.</p>}
      </div>
    </div>
  );
}
