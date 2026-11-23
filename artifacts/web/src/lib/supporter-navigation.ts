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

export function isSupporterPath(location: string) {
  const path = pathname(location);
  return path === "/account" || path === "/profile/edit" || path === "/settings" || path === "/settings/interests" || path === "/onboarding/interests" || path === "/onboarding/follows" || supporterNavigation.some(item => item.href === path);
}

const organisationShellPaths = ["/feed", "/discover", "/inbox", "/notifications", "/settings", "/dashboard"];
export function isOrganisationShellPath(location: string) {
  return organisationShellPaths.includes(pathname(location));
}

/** `approvalStatus` optional for backward compatibility with older callers. */
export function shouldUseSupporterLayout(location: string, accountType?: string | null, approvalStatus?: string | null) {
  if (accountType === "organisation") return approvalStatus === "approved" && isOrganisationShellPath(location);
  return isSupporterPath(location);
}

/** Dashboard tab as the dashboard itself resolves it when explicit; null otherwise. */
export function dashboardTab(location: string, search?: string) {
  if (pathname(location) !== "/dashboard") return null;
  return queryOf(location, search).get("tab");
}

export function isSupporterNavigationActive(item: NavigationItem, location: string, search?: string) {
  if (item.id === "create") return false;
  const path = pathname(location);
  const itemPath = pathname(item.href);
  if (itemPath === "/dashboard") {
    if (path !== "/dashboard") return false;
    const want = queryOf(item.href).get("tab");
    const tab = dashboardTab(location, search);
    return tab === want || (want === "overview" && !tab);
  }
  return item.href === path || (item.id === "profile" && path === "/account");
}
