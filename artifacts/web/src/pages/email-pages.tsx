import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAcceptEmailTeamInvitation, useGetOwnEmailApplication, useRespondToEmailApplication,
  getGetOwnEmailApplicationQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { EmailPreferencesPanel, errStatus, errText } from "@/components/email/EmailPreferencesPanel";
import "./account-pages.css";

const INVITE_KEY = "rp_team_invitation_key";

function hashKey(): string {
  const m = /(?:^|[#&])key=([^&]+)/.exec(window.location.hash);
  return m ? decodeURIComponent(m[1]!) : "";
}

export function EmailPreferencesPage() {
  const { token, isAuthenticated } = useAuth();
  const [key] = useState(hashKey);
  const useKey = !!key;
  if (!useKey && !isAuthenticated) return <div className="rpa-page" data-testid="page-email-preferences">
    <h1 className="rpa-h1">Email preferences</h1>
    <section className="rpa-box first"><p className="rpa-hint">Open the preferences link in any Root ProjX email, or sign in to change these in Settings.</p>
      <div className="rpa-row" style={{ marginTop: 12 }}><Link href="/login" className="rpa-btn sm" data-testid="link-email-preferences-login">Sign in</Link></div></section>
  </div>;
  return <div className="rpa-page" data-testid="page-email-preferences">
    <h1 className="rpa-h1">Email preferences</h1>
    <EmailPreferencesPanel first token={useKey ? null : token} accessKey={useKey ? key : undefined} />
  </div>;
}

export function TeamInvitationPage() {
  const { token, isAuthenticated, user } = useAuth();
  const [key] = useState(() => {
    const k = hashKey();
    if (k) sessionStorage.setItem(INVITE_KEY, k);
    return k || sessionStorage.getItem(INVITE_KEY) || "";
  });
  const accept = useAcceptEmailTeamInvitation({ request: { credentials: "include", headers: { Authorization: `Bearer ${token}` } } });
  const [done, setDone] = useState(false);
  const teamToken = !!token && (token.startsWith("org-team.") || token.startsWith("org-admin."));

  let body;
  if (!key) body = <p className="rpa-err" role="alert" data-testid="status-invitation-missing">This invitation link is incomplete. Reopen the invitation email and use its button.</p>;
  else if (done) body = <><p data-testid="status-invitation-accepted">Invitation accepted. You can now manage this organisation.</p>
    <div className="rpa-row" style={{ marginTop: 12 }}><Link href="/inbox" className="rpa-btn y sm" data-testid="link-invitation-continue">Continue</Link></div></>;
  else if (!isAuthenticated || teamToken) body = <>
    <p className="rpa-hint">Sign in with the account this invitation was sent to. After signing in, come back to this page, or reopen the invitation email.</p>
    <div className="rpa-row" style={{ marginTop: 12 }}><Link href="/login" className="rpa-btn y sm" data-testid="link-invitation-login">Sign in</Link></div></>;
  else {
    const s = errStatus(accept.error);
    body = <>
      <p className="rpa-hint">You’re signed in{user?.email ? <> as <b data-testid="text-invitation-account">{user.email}</b></> : null}. Accepting lets you manage this organisation’s profile, posts and campaigns.</p>
      <div className="rpa-row" style={{ marginTop: 12 }}>
        <button type="button" className="rpa-btn y sm" disabled={accept.isPending} data-testid="button-accept-invitation"
          onClick={() => accept.mutate({ data: { accessKey: key } }, { onSuccess: () => { sessionStorage.removeItem(INVITE_KEY); setDone(true); } })}>
          {accept.isPending ? "Accepting…" : "Accept invitation"}</button>
      </div>
      {accept.isError && <p className="rpa-err" role="alert" data-testid="status-invitation-error">
        {s === 409 && errText(accept.error) ? errText(accept.error) : s === 403 ? "This invitation was sent to a different account. Sign out and sign in with the invited email address."
          : s === 404 || s === 410 ? "This invitation has expired or was already used. Ask the organisation owner to send a new one."
          : errText(accept.error) || "We couldn’t accept the invitation. Try again."}</p>}
    </>;
  }
  return <div className="rpa-page" data-testid="page-team-invitation">
    <h1 className="rpa-h1">Team invitation</h1>
    <section className="rpa-box first">{body}</section>
  </div>;
}

export function ApplicationPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const init: RequestInit = { credentials: "include", headers: { Authorization: `Bearer ${token}` } };
  const q = useGetOwnEmailApplication({ request: init, query: { queryKey: [...getGetOwnEmailApplicationQueryKey(), token], enabled: !!token } });
  const respond = useRespondToEmailApplication({ request: init });
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  if (q.isLoading) return <div className="rpa-page" data-testid="page-application"><h1 className="rpa-h1">Your application</h1><div className="rpa-skel" /></div>;
  if (q.isError || !q.data) return <div className="rpa-page" data-testid="page-application"><h1 className="rpa-h1">Your application</h1>
    <section className="rpa-box first"><p className="rpa-err" role="alert">{errStatus(q.error) === 404 ? "We couldn’t find an application for this account." : "We couldn’t load your application."}</p>
      <div className="rpa-row"><button type="button" className="rpa-btn sm" onClick={() => q.refetch()} data-testid="button-retry-application">Try again</button></div></section></div>;
  const a = q.data;
  const waiting = a.status === "waiting";
  const label = waiting ? "We need more information" : a.status === "pending" ? "Under review" : a.status === "approved" ? "Approved" : a.status === "declined" ? "Not approved" : a.status;
  return <div className="rpa-page" data-testid="page-application">
    <h1 className="rpa-h1">Your application</h1>
    <section className="rpa-box first">
      <h2 className="rpa-h2" data-testid="text-application-org">{a.orgName}</h2>
      <p className="rpa-mut" data-testid="status-application">Status: {label}</p>
      {a.infoRequest && <><h3 className="rpa-h2" style={{ marginTop: 16 }}>Request from Root ProjX</h3>
        <p style={{ whiteSpace: "pre-wrap" }} data-testid="text-application-info-request">{a.infoRequest}</p></>}
      {a.response && <><h3 className="rpa-h2" style={{ marginTop: 16 }}>Your response</h3>
        <p style={{ whiteSpace: "pre-wrap" }} data-testid="text-application-response">{a.response}</p></>}
      {waiting && !sent && <form style={{ marginTop: 16 }} onSubmit={e => {
        e.preventDefault();
        respond.mutate({ data: { response: text.trim() } }, { onSuccess: next => {
          qc.setQueryData([...getGetOwnEmailApplicationQueryKey(), token], next); setSent(true); setText("");
        } });
      }}>
        <label className="rpa-hint" htmlFor="application-response">Your response</label>
        <textarea id="application-response" className="rpa-in" rows={6} maxLength={10000} style={{ width: "100%", marginTop: 8 }}
          value={text} onChange={e => setText(e.target.value)} data-testid="input-application-response" />
        <div className="rpa-row" style={{ marginTop: 10 }}>
          <button className="rpa-btn y sm" disabled={respond.isPending || !text.trim()} data-testid="button-submit-application-response">{respond.isPending ? "Sending…" : "Send response"}</button>
        </div>
        {respond.isError && <p className="rpa-err" role="alert">{errText(respond.error) || "Couldn’t send your response. Try again."}</p>}
      </form>}
      {sent && <p className="rpa-hint" role="status" data-testid="status-application-response-sent">Response sent. We’ll email you when the review is complete.</p>}
    </section>
  </div>;
}
