import { appFetch as fetch, userErrorMessage } from "@/lib/error-feedback";
import { useEffect, useState, type ReactNode } from "react";
import { Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrganisationAccessProvider } from "@/context/AuthContext";
import { isOrganisationShellPath } from "@/lib/supporter-navigation";

export function AdminOrganisationAccess({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const active = sessionStorage.getItem("admin_managed_org");
  if (location === "/dashboard" && active && localStorage.getItem("admin_token")) {
    return <Redirect to={`/admin/organisations/${active}/manage${window.location.search}`} />;
  }
  const manage = location.match(/^\/admin\/organisations\/([\w-]+)\/manage$/);
  const preview = location.match(/^\/campaign\/preview\/([\w-]+)\//) ||
    (new URLSearchParams(window.location.search).get("preview") === "1"
      ? location.match(/^\/organisations\/([\w-]+)$/) : null);
  // Carry the selected organisation through the shared navigation, never into
  // unrelated public, supporter or admin pages.
  const id = manage?.[1] ?? (preview && active === preview[1] ? preview[1] : null) ??
    (active && localStorage.getItem("admin_token") && isOrganisationShellPath(location) ? active : null);
  if (!id) return <>{children}</>;
  return <AccessSession key={id} orgId={id}>{children}</AccessSession>;
}

function AccessSession({ orgId, children }: { orgId: string; children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const [access, setAccess] = useState<{ token: string; name: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const admin = localStorage.getItem("admin_token");
    if (!admin) { setError("Sign in as an administrator to access this organisation."); return; }
    fetch(`${import.meta.env.BASE_URL}api/admin/organisations/${orgId}/access`, {
      method: "POST", headers: { "x-admin-token": admin }, signal: controller.signal,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open organisation dashboard");
      sessionStorage.setItem("admin_managed_org", orgId);
      setAccess(data);
    }).catch((err) => { if (err.name !== "AbortError") setError(userErrorMessage(err, "open this organisation’s dashboard")); });
    return () => { controller.abort(); client.clear(); };
  }, [orgId, client]);
  const back = `${import.meta.env.BASE_URL}admin`;
  if (error) return <div className="p-8 space-y-4"><p role="alert">{error}</p><a href={back}>Return to admin</a></div>;
  if (!access) return <p className="p-8">Opening organisation dashboard…</p>;
  const unavailable = async (): Promise<never> => { throw new Error("Use the normal sign-in page to change accounts."); };
  return <QueryClientProvider client={client}>
    <OrganisationAccessProvider value={{
      user: { id: orgId, name: access.name, email: "", phone: null, accountType: "organisation", approvalStatus: "approved", avatarInitials: "", createdAt: null },
      token: access.token, isLoading: false, isAuthenticated: true,
      login: unavailable, register: unavailable, refreshUser: async () => {},
      logout: async () => { sessionStorage.removeItem("admin_managed_org"); window.location.assign(back); },
    }}>
      <div className="rps-admin-access">
      <div className="rps-admin-banner bg-accent text-accent-foreground px-4 py-3 flex flex-wrap justify-between gap-3" role="status">
        <strong>Admin access — managing {access.name}</strong>
        <a href={back} onClick={() => sessionStorage.removeItem("admin_managed_org")} className="underline font-bold">Return to admin</a>
      </div>
      {children}
      </div>
    </OrganisationAccessProvider>
  </QueryClientProvider>;
}
