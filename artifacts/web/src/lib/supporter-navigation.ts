/** Shared by desktop, mobile and route selection; no API or auth side effects. */
export const supporterNavigation = [
  { id: "home", label: "Home", href: "/feed" },
  { id: "discover", label: "Discover", href: "/discover" },
  { id: "create", label: "Create", href: "/create" },
  { id: "inbox", label: "Inbox", href: "/inbox" },
  { id: "notifications", label: "Notifications", href: "/notifications" },
  { id: "profile", label: "Profile", href: "/profile" },
  { id: "saved", label: "Saved", href: "/saved" },
  { id: "giving", label: "Giving History", href: "/giving-history" },
] as const;

/** Organisation configuration of the same shell. Dashboard destinations are tab query links. */
export const organisationNavigation = [
  { id: "home", label: "Home", href: "/feed" },
  { id: "discover", label: "Discover", href: "/discover" },
  { id: "create", label: "Create", href: "/dashboard?tab=posts" },
  { id: "inbox", label: "Inbox", href: "/inbox" },
  { id: "notifications", label: "Notifications", href: "/notifications" },
  { id: "profile", label: "Profile", href: "/dashboard?tab=overview" },
  { id: "campaigns", label: "Campaigns", href: "/dashboard?tab=campaigns" },
  { id: "payouts", label: "Payouts", href: "/dashboard?tab=profile" },
] as const;

export const organisationEditProfileHref = "/dashboard?tab=build";
export const organisationResumeWalkthroughHref = "/dashboard?tab=build&resume=1";

export type SupporterNavigationItem = typeof supporterNavigation[number];
export type OrganisationNavigationItem = typeof organisationNavigation[number];
export type NavigationItem = SupporterNavigationItem | OrganisationNavigationItem;
export type SupporterNavigationId = SupporterNavigationItem["id"];
export type NavigationId = NavigationItem["id"];

/** Phone bottom bar; identical for both account kinds. */
export const supporterMobileNavigation: readonly NavigationId[] = [
  "home", "discover", "create", "inbox", "profile",
];

export type NavigationAccount = { accountType?: string | null; approvalStatus?: string | null } | null | undefined;

export function isApprovedOrganisation(user: NavigationAccount) {
  return user?.accountType === "organisation" && user.approvalStatus === "approved";
}

export function navigationFor(user: NavigationAccount): readonly NavigationItem[] {
  return isApprovedOrganisation(user) ? organisationNavigation : supporterNavigation;
}

function pathname(location: string) {
  return location.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
}

function queryOf(location: string, search?: string) {
  if (search !== undefined) return new URLSearchParams(search);
  const q = location.split("#")[0]!.split("?")[1];
  return new URLSearchParams(q ?? "");
}

/** Exact public organisation detail route (not its legacy sub-pages). */
export function isOrganisationDetailPath(location: string) {
  return /^\/organisations\/[^/]+$/.test(pathname(location));
}

export function isSupporterPath(location: string) {
  const path = pathname(location);
  return isOrganisationDetailPath(path) || path === "/account" || path === "/profile/edit" || path === "/profile/archived" || path === "/settings" || path === "/settings/interests" || path === "/onboarding/interests" || path === "/onboarding/follows" || supporterNavigation.some(item => item.href === path);
}

const organisationShellPaths = ["/feed", "/discover", "/inbox", "/notifications", "/settings", "/dashboard", "/saved"];
export function isOrganisationShellPath(location: string) {
  return organisationShellPaths.includes(pathname(location)) || isOrganisationDetailPath(location) || /^\/posts\/[^/]+$/.test(pathname(location)) ||
    /^\/admin\/organisations\/[\w-]+\/manage$/.test(pathname(location));
}

/** `approvalStatus` optional for backward compatibility with older callers. */
export function shouldUseSupporterLayout(location: string, accountType?: string | null, approvalStatus?: string | null) {
  if (accountType === "organisation") return approvalStatus === "approved" && isOrganisationShellPath(location);
  return isSupporterPath(location);
}

/** Dashboard tab as the dashboard itself resolves it when explicit; null otherwise. */
export function dashboardTab(location: string, search?: string) {
  if (pathname(location) !== "/dashboard" && !/^\/admin\/organisations\/[\w-]+\/manage$/.test(pathname(location))) return null;
  return queryOf(location, search).get("tab");
}

export function isSupporterNavigationActive(item: NavigationItem, location: string, search?: string) {
  if (item.id === "create") return false;
  const path = pathname(location);
  const itemPath = pathname(item.href);
  if (itemPath === "/dashboard") {
    if (path !== "/dashboard" && !/^\/admin\/organisations\/[\w-]+\/manage$/.test(path)) return false;
    const want = queryOf(item.href).get("tab");
    const tab = dashboardTab(location, search);
    return tab === want || (want === "overview" && !tab);
  }
  return item.href === path || (item.id === "profile" && path === "/account");
}

/** Dashboard base for the current organisation session; administrators keep their managed-org route. */
export function organisationDashboardBase(token: string | null | undefined, orgId: string | null | undefined) {
  return token?.startsWith("org-admin.") && orgId ? `/admin/organisations/${orgId}/manage` : "/dashboard";
}

export function organisationDashboardHref(token: string | null | undefined, orgId: string | null | undefined, query: string) {
  return `${organisationDashboardBase(token, orgId)}?${query}`;
}

/** Campaign grouping for managers: elapsed deadlines count as ended without changing server status. */
export function campaignManagerGroup(c: { enabled?: boolean; status?: string; deadline?: string | null }, now = Date.now()): "live" | "draft" | "ended" {
  if (c.status === "completed") return "ended";
  const value = c.deadline && /^\d{4}-\d{2}-\d{2}$/.test(c.deadline) ? `${c.deadline}T23:59:59.999Z` : c.deadline;
  const end = value ? new Date(value).getTime() : NaN;
  if (c.enabled && Number.isFinite(end) && end <= now) return "ended";
  return c.enabled ? "live" : "draft";
}
