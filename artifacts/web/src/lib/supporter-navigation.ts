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

export type SupporterNavigationItem = typeof supporterNavigation[number];
export type SupporterNavigationId = SupporterNavigationItem["id"];

export const supporterMobileNavigation: readonly SupporterNavigationId[] = [
  "home", "discover", "create", "inbox", "profile",
];

function pathname(location: string) {
  return location.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
}

export function isSupporterPath(location: string) {
  const path = pathname(location);
  return path === "/account" || path === "/settings" || path === "/settings/interests" || path === "/onboarding/interests" || path === "/onboarding/follows" || supporterNavigation.some(item => item.href === path);
}

export function shouldUseSupporterLayout(location: string, accountType?: string | null) {
  return accountType !== "organisation" && isSupporterPath(location);
}

export function isSupporterNavigationActive(item: SupporterNavigationItem, location: string) {
  const path = pathname(location);
  return item.href === path || (item.id === "profile" && path === "/account");
}
