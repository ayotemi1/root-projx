import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addOrganisationManager, getOrganisationManagers, removeOrganisationManager } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { PayoutSetup } from "@/components/payout-setup";
import * as api from "@/lib/api";

export default function OrganisationSettingsSections() {
  const { user, token } = useAuth();
  if (!user || !token || user.accountType !== "organisation") return null;
  if (token.startsWith("org-team.")) return <>
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
  const [accountId, setAccountId] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const add = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const next = await addOrganisationManager(orgId, { userId: accountId.trim() }, init);
      qc.setQueryData(key, next); setAccountId("");
    } catch { setError("Couldn’t add this account. Check the account ID and try again."); }
    finally { setBusy(false); }
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
      <p className="rpa-hint">To add someone, ask them to copy their account ID from their own Inbox. They’ll find “Manage an organisation” in their navigation once added.</p>
      {q.isLoading ? <p role="status">Loading team…</p> : q.isError ? <p role="alert">Couldn’t load your team. <button type="button" className="rpa-btn sm" onClick={() => q.refetch()}>Try again</button></p> :
        <ul style={{ margin: "16px 0", padding: 0, listStyle: "none" }}>
          <li className="rpa-row"><strong>You</strong><span className="rpa-hint">Owner</span></li>
          {q.data?.members.map(member => <li key={member.userId} className="rpa-row" style={{ padding: "12px 0", borderBottom: "1px solid #ddd5c8", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 0 }}><strong>{member.name}</strong><span className="rpa-hint" style={{ overflowWrap: "anywhere" }}>{member.userId}</span></span>
            <button type="button" className="rpa-btn sm" disabled={busy} onClick={() => remove(member.userId, member.name)} data-testid={`button-remove-manager-${member.userId}`}>Remove</button>
          </li>)}
        </ul>}
      <form onSubmit={add}>
        <label className="rpa-hint" htmlFor="org-manager-account-id">Team member account ID</label>
        <div className="rpa-row" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <input id="org-manager-account-id" className="rpa-in" style={{ flex: 1, minWidth: 130 }} value={accountId}
            onChange={e => setAccountId(e.target.value)} maxLength={128} autoComplete="off" spellCheck={false} data-testid="input-organisation-manager" />
          <button className="rpa-btn y" disabled={busy || !accountId.trim() || q.isError} data-testid="button-add-organisation-manager">{busy ? "Saving…" : "Add"}</button>
        </div>
      </form>
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
