import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrganisationManagers, removeOrganisationManager, useListEmailTeamInvitations, useInviteEmailTeamMember, getListEmailTeamInvitationsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { PayoutSetup } from "@/components/payout-setup";
import * as api from "@/lib/api";

export default function OrganisationSettingsSections() {
  const { user, token } = useAuth();
  if (!user || !token || user.accountType !== "organisation") return null;
  if (token.startsWith("org-team.") || token.startsWith("org-admin.")) return <>
    <section className="rpa-box"><h2 className="rpa-h2">Team</h2><p className="rpa-hint">Only the organisation owner can add or remove account managers.</p></section>
    <section className="rpa-box"><h2 className="rpa-h2">Payout details</h2><p className="rpa-hint">Only the organisation owner can view or change payout details.</p></section>
  </>;
  return <OwnerSections orgId={user.id} token={token} />;
}
function OwnerSections({ orgId, token }: { orgId: string; token: string }) {
  const qc = useQueryClient();
  const key = ["organisation-managers", orgId, token];
  const init = { headers: { Authorization: `Bearer ${token}` } };
  const q = useQuery({ queryKey: key, queryFn: () => getOrganisationManagers(orgId, init) });
  const org = useQuery({ queryKey: ["org", orgId], queryFn: () => api.getOrganisation(orgId, token) });
  const [email, setEmail] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const invKey = [...getListEmailTeamInvitationsQueryKey(), token];
  const invites = useListEmailTeamInvitations({ request: { ...init, credentials: "include" }, query: { queryKey: invKey } });
  const invite = useInviteEmailTeamMember({ request: { ...init, credentials: "include" } });
  const add = (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setNotice("");
    const to = email.trim();
    invite.mutate({ data: { email: to } }, {
      onSuccess: () => { setEmail(""); setNotice(`Invitation queued for ${to}. It stays valid until it expires or is accepted.`); qc.invalidateQueries({ queryKey: invKey }); },
      onError: (e) => { const d = (e as { data?: { error?: unknown } }).data; setError(typeof d?.error === "string" ? d.error : "Couldn’t send this invitation. Check the email address and try again."); },
    });
  };
  const remove = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name}'s account-manager access? They will no longer be able to manage your profile, posts or campaigns. Any separate Inbox-only access stays as it was.`)) return;
    setError(""); setBusy(true);
    try { qc.setQueryData(key, await removeOrganisationManager(orgId, userId, init)); }
    catch { setError("Couldn’t remove this account. Please try again."); }
    finally { setBusy(false); }
  };
  return <>
    <section className="rpa-box" aria-labelledby="org-settings-team" data-testid="section-organisation-team">
      <h2 className="rpa-h2" id="org-settings-team">Team</h2>
      <p className="rpa-hint">Managers can edit your profile, posts and campaigns, and read and reply to your Inbox. Only you can manage the team or access payout details.</p>
      <p className="rpa-hint">To add someone, invite them by email. They’ll sign in with that address and accept the invitation.</p>
      {q.isLoading ? <p role="status">Loading team…</p> : q.isError ? <p role="alert">Couldn’t load your team. <button type="button" className="rpa-btn sm" onClick={() => q.refetch()}>Try again</button></p> :
        <ul style={{ margin: "16px 0", padding: 0, listStyle: "none" }}>
          <li className="rpa-row"><strong>You</strong><span className="rpa-hint">Owner</span></li>
          {q.data?.members.map(member => <li key={member.userId} className="rpa-row" style={{ padding: "12px 0", borderBottom: "1px solid #ddd5c8", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 0 }}><strong>{member.name}</strong><span className="rpa-hint" style={{ overflowWrap: "anywhere" }}>{member.userId}</span></span>
            <button type="button" className="rpa-btn sm" disabled={busy} onClick={() => remove(member.userId, member.name)} data-testid={`button-remove-manager-${member.userId}`}>Remove</button>
          </li>)}
        </ul>}
      {invites.isError ? <p role="alert">Couldn’t load invitations. <button type="button" className="rpa-btn sm" onClick={() => invites.refetch()} data-testid="button-retry-invitations">Try again</button></p>
        : (invites.data?.length ?? 0) > 0 && <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none" }} data-testid="list-team-invitations">
          {invites.data!.map(i => <li key={i.id} className="rpa-row" style={{ padding: "8px 0", borderBottom: "1px solid #ddd5c8", flexWrap: "wrap" }} data-testid={`row-invitation-${i.id}`}>
            <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{i.email}</span>
            <span className="rpa-hint">{i.status === "pending" ? `Invited, expires ${new Date(i.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : i.status}</span>
          </li>)}
        </ul>}
      <form onSubmit={add}>
        <label className="rpa-hint" htmlFor="org-manager-email">Team member email</label>
        <div className="rpa-row" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <input id="org-manager-email" type="email" className="rpa-in" style={{ flex: 1, minWidth: 130 }} value={email}
            onChange={e => setEmail(e.target.value)} maxLength={254} autoComplete="off" spellCheck={false} data-testid="input-organisation-manager-email" />
          <button className="rpa-btn y" disabled={invite.isPending || !/^\S+@\S+\.\S+$/.test(email.trim())} data-testid="button-invite-organisation-manager">{invite.isPending ? "Sending…" : "Send invitation"}</button>
        </div>
      </form>
      {notice && <p className="rpa-hint" role="status" data-testid="status-invitation-sent">{notice}</p>}
      {error && <p className="rpa-err" role="alert">{error}</p>}
      <p className="rpa-hint" style={{ marginTop: 14 }}>Existing Inbox-only members keep their limited access. Manage those permissions in Inbox.</p>
    </section>
    <section className="rpa-box" aria-labelledby="org-settings-payout" data-testid="section-organisation-payout-details">
      <h2 className="rpa-h2" id="org-settings-payout">Payout details</h2>
      <p className="rpa-hint">The account your organisation’s payouts go to. This uses your existing secure payout setup.</p>
      {org.isLoading ? <p role="status">Loading payout setup…</p> : org.isError ? <p role="alert">Couldn’t load payout setup. <button className="rpa-btn sm" onClick={() => org.refetch()}>Try again</button></p> :
        <PayoutSetup orgId={orgId} token={token} totalRaised={org.data?.totalRaised ?? 0} connectComplete={false} />}
    </section>
  </>;
}
