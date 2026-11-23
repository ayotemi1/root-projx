import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrganisationManagerSession, listManagedOrganisations, startOrganisationManagerSession } from "@workspace/api-client-react";
import { OrganisationAccessProvider, useAuth } from "@/context/AuthContext";

const KEY = "rootprojx_managed_organisation";
type Session = { actorId: string; token: string };
function storedSession(): Session | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return value && typeof value.actorId === "string" && typeof value.token === "string" && value.token.startsWith("org-team.") ? value : null;
  } catch { return null; }
}
type Auth = ReturnType<typeof useAuth>;
const TeamContext = createContext<{ parent: Auth; active: boolean; exit: () => void } | null>(null);
const init = (token: string | null) => ({ headers: { Authorization: `Bearer ${token}` } });

/** Explicit, tab-local organisation identity; the actual sign-in is unchanged.
 * Every API request rechecks the current grant, including after removal. */
export function OrganisationTeamAccess({ children }: { children: ReactNode }) {
  const parent = useAuth();
  const [session] = useState(storedSession);
  const active = !!session && session.actorId === parent.user?.id;
  const view = useQuery({
    queryKey: ["organisation-manager-session", active ? session?.token : null],
    queryFn: () => getOrganisationManagerSession(init(session!.token)),
    enabled: active, retry: false, refetchInterval: 30_000, refetchOnWindowFocus: "always",
  });
  const exit = () => {
    sessionStorage.removeItem(KEY);
    window.location.assign(`${import.meta.env.BASE_URL}${parent.user?.accountType === "organisation" ? "dashboard?tab=overview" : "feed"}`);
  };
  if (active && !view.data) return <div className="rpa-page" role="status">
    {view.isError ? <><p>Your organisation access has ended or is unavailable.</p><button className="rpa-btn" onClick={exit}>Return to your account</button></> : "Opening organisation account…"}
  </div>;
  const denied = view.isError && [401, 403, 404].includes((view.error as { status?: number })?.status ?? 0);
  // Keep the mounted editor/chat and its typed draft during transient outages.
  if (active && denied) return <div className="rpa-page" role="alert"><p>Your organisation access has ended or is unavailable.</p><button className="rpa-btn" onClick={exit}>Return to your account</button></div>;
  const content = active && view.data && session && parent.user ? (
    <OrganisationAccessProvider value={{
      ...parent, token: session.token,
      user: { ...parent.user, id: view.data.id, name: view.data.name, accountType: "organisation", approvalStatus: "approved",
        email: "", phone: null, avatarUrl: view.data.logo,
        avatarInitials: view.data.name.split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase() },
      refreshUser: async () => { await view.refetch(); },
      logout: async () => { sessionStorage.removeItem(KEY); await parent.logout(); },
    }}>{children}</OrganisationAccessProvider>
  ) : children;
  return <TeamContext.Provider value={{ parent, active, exit }}>{content}</TeamContext.Provider>;
}

/** Navigation only: existing Inbox-only grants never appear in this list. */
export function OrganisationSwitcher() {
  const auth = useAuth(), context = useContext(TeamContext), qc = useQueryClient();
  const parent = context?.parent ?? auth;
  const active = context?.active ?? false;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const q = useQuery({
    queryKey: ["managed-organisations", parent.token],
    queryFn: () => listManagedOrganisations(init(parent.token)),
    enabled: !!parent.token && !parent.token.startsWith("org-admin.") && !active,
    staleTime: 30_000,
  });
  const open = async (orgId: string) => {
    setError(false); setBusy(orgId);
    try {
      const result = await startOrganisationManagerSession(orgId, init(parent.token));
      sessionStorage.setItem(KEY, JSON.stringify({ actorId: parent.user!.id, token: result.token }));
      qc.clear();
      window.location.assign(`${import.meta.env.BASE_URL}dashboard?tab=overview`);
    } catch { setBusy(null); setError(true); }
  };
  if (active) return <div className="rps-panel-note"><p>Managing this organisation</p><button className="rps-sub" onClick={context!.exit} data-testid="button-exit-organisation">Return to your account</button></div>;
  if (!q.data?.organisations.length) return null;
  return <div>
    <p className="rps-panel-note">Manage an organisation</p>
    {q.data.organisations.map(org => <button key={org.id} type="button" className="rps-sub" disabled={!!busy}
      onClick={() => open(org.id)} data-testid={`button-manage-organisation-${org.id}`}>{busy === org.id ? "Opening…" : org.name}</button>)}
    {error && <p role="alert" className="rps-error">Couldn’t open this organisation. Please try again.</p>}
  </div>;
}
