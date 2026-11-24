import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  Home, Compass, PlusSquare, Inbox, Bell, User, Bookmark, Heart, Menu, X, Pencil, Settings, LogOut, ArrowRight, MapPin, Landmark, Archive, Compass as CompassIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { OrganisationLogo } from "@/components/organisation-logo";
import {
  supporterMobileNavigation, isSupporterNavigationActive, navigationFor, isApprovedOrganisation,
  organisationEditProfileHref, organisationResumeWalkthroughHref, dashboardTab,
  type NavigationId,
} from "@/lib/supporter-navigation";
import { useSupporterFollowing } from "./use-supporter-following";
import { SupporterCreateMenu } from "./SupporterCreateMenu";
import { SupporterPostDraftProvider } from "./SupporterPostDraftProvider";
import { TextPostProvider } from "./TextPostProvider";
import { NotificationsInbox, UnreadBadge } from "./NotificationsInbox";
import { useSupporterNotifications } from "./use-supporter-notifications";
import { InboxBadge } from "@/components/inbox/InboxBadge";
import { SupporterAvatar } from "./SupporterAvatar";
import { OrganisationSwitcher } from "@/components/organisation/OrganisationTeamAccess";
import "./supporter.css";
import "@/pages/account-pages.css";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const icons: Record<NavigationId, typeof Home> = {
  home: Home, discover: Compass, create: PlusSquare, inbox: Inbox,
  notifications: Bell, profile: User, saved: Bookmark, giving: Heart,
  campaigns: MapPin, payouts: Landmark,
};

/** Pages (e.g. the organisation Profile tab) can open the phone overflow menu. */
export const OPEN_SHELL_MENU_EVENT = "rps:open-menu";

function useSignOut() {
  const { logout } = useAuth();
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const signOut = async () => {
    setError(null); setPending(true);
    try { await logout(); navigate("/"); }
    catch (e) { setError(e instanceof Error ? e.message : "Sign out failed. Please try again."); }
    finally { setPending(false); }
  };
  return { signOut, error, pending };
}

function FollowingPanel() {
  const follows = useSupporterFollowing();
  const orgs = follows.data ?? [];
  return (
    <aside className="rps-right" aria-labelledby="rps-following-h">
      <h2 id="rps-following-h" className="rps-mono-h">Following</h2>
      {!follows.enabled ? (
        <div className="rps-panel-note">
          <p>Sign in to see the organisations you follow.</p>
          <Link href="/login" className="rp-link-u" data-testid="link-panel-signin">Sign in</Link>
        </div>
      ) : follows.isLoading ? (
        <div className="rps-panel-note" aria-busy="true"><span className="rps-skel-line wide" /><span className="rps-skel-line" /></div>
      ) : follows.isError ? (
        <div className="rps-panel-note" role="alert">
          <p>Couldn't load followed organisations.</p>
          <button type="button" className="rps-chip" onClick={() => follows.refetch()} data-testid="button-retry-follows-panel">Retry</button>
        </div>
      ) : orgs.length === 0 ? (
        <p className="rps-panel-note">You're not following anyone yet.</p>
      ) : (
        <ul className="rps-follow-list">
          {orgs.map(o => (
            <li key={o._id}>
              <Link href={`/organisations/${o._id}`} className="rps-follow-row" data-testid={`link-follow-org-${o._id}`}>
                <OrganisationLogo name={o.name} logo={o.logo} />
                <span className="rps-follow-name">{o.name}</span>
                <ArrowRight size={16} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/discover" className="rp-link-u rps-find" data-testid="link-find-orgs">Find organisations</Link>
    </aside>
  );
}

export default function SupporterLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const search = useSearch();
  const accountPage = /^\/(settings|profile\/edit)\/?(?:[?#]|$)/.test(location);
  const profilePage = location === "/profile" || location === "/saved" || /^\/(?:supporters|organisations)\/[^/?#]+\/?$/.test(location);
  const { user, isAuthenticated } = useAuth();
  const isOrg = isApprovedOrganisation(user);
  const supporterNavigation = navigationFor(user);
  const isActive = (item: typeof supporterNavigation[number]) => isSupporterNavigationActive(item, location, search);
  const { signOut, error, pending } = useSignOut();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const notifications = useSupporterNotifications();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelBtn = useRef<HTMLButtonElement>(null);
  const closePanel = () => { setPanelOpen(false); panelBtn.current?.focus(); };
  useEffect(() => { setPanelOpen(false); }, [location, notifications.token]);
  useEffect(() => {
    if (!panelOpen) return;
    document.getElementById("rpn-panel-title")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setPanelOpen(false); panelBtn.current?.focus(); } };
    const onOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!document.getElementById("rpn-drawer")?.contains(target) && !panelBtn.current?.contains(target)) {
        setPanelOpen(false);
        if (!(target instanceof Element) || !target.closest("a,button,input,select,textarea,[tabindex],[role=button],[role=link]")) {
          requestAnimationFrame(() => panelBtn.current?.focus());
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [panelOpen]);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
    const page = supporterNavigation.find(item => isSupporterNavigationActive(item, location, window.location.search));
    const title = `${page?.label ?? "Supporter"} | Root ProjX`;
    const description = `Your ${page?.label.toLowerCase() ?? "supporter"} space on Root ProjX, connecting diaspora with grassroots change.`;
    const priorTitle = document.title;
    document.title = title;
    const restore = [
      ["name", "description", description],
      ["property", "og:title", title],
      ["property", "og:description", description],
      ["property", "og:type", "website"],
    ].map(([attribute, name, content]) => {
      const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
      const tag = existing ?? document.createElement("meta");
      const before = tag.getAttribute("content");
      tag.setAttribute(attribute!, name!);
      tag.content = content!;
      if (!existing) document.head.appendChild(tag);
      return () => { if (!existing) tag.remove(); else if (before === null) tag.removeAttribute("content"); else tag.content = before; };
    });
    return () => { document.title = priorTitle; restore.forEach(reset => reset()); };
  }, [location, search, supporterNavigation]);
  useEffect(() => {
    const open = () => setMenuOpen(true);
    window.addEventListener(OPEN_SHELL_MENU_EVENT, open);
    return () => window.removeEventListener(OPEN_SHELL_MENU_EVENT, open);
  }, []);
  useEffect(() => { setMenuOpen(false); }, [search]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenuOpen(false); menuBtn.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const mobileItems = supporterMobileNavigation
    .map(id => supporterNavigation.find(i => i.id === id)!)
    .filter(Boolean);
  const overflow = supporterNavigation.filter(i => !supporterMobileNavigation.includes(i.id));
  const notif = supporterNavigation.find(i => i.id === "notifications")!;
  const inboxNav = supporterNavigation.find(i => i.id === "inbox")!;

  const editActive = dashboardTab(location, search) === "build";
  const accountBlock = (desktop = false) => isAuthenticated && isOrg ? (
    <>
      <Link href="/saved" className="rps-sub" aria-current={location === "/saved" ? "page" : undefined} onClick={() => setMenuOpen(false)} data-testid="link-organisation-saved"><Bookmark size={16} aria-hidden /> Saved</Link>
      <Link href={organisationEditProfileHref} className="rps-sub" aria-current={editActive ? "page" : undefined} onClick={() => setMenuOpen(false)} data-tour-id={desktop ? "dashboard-tab-build-profile" : undefined} data-testid="link-edit-profile"><Pencil size={16} aria-hidden /> Edit profile</Link>
      <Link href="/settings" className="rps-sub" aria-current={/^\/settings(\/|$|[?#])/.test(location) ? "page" : undefined} onClick={() => setMenuOpen(false)} data-testid="link-settings"><Settings size={16} aria-hidden /> Settings</Link>
      <button type="button" className="rps-sub" onClick={signOut} disabled={pending} data-testid="button-sign-out">
        <LogOut size={16} aria-hidden /> {pending ? "Signing out…" : "Sign out"}
      </button>
      <Link href={organisationResumeWalkthroughHref} className="rps-sub" onClick={() => setMenuOpen(false)} data-testid="link-resume-walkthrough"><CompassIcon size={16} aria-hidden /> Resume walkthrough</Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="rps-sub" data-testid={desktop ? "button-replay-menu" : "button-replay-menu-mobile"}><CompassIcon size={16} aria-hidden /> Show me around</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem asChild><Link href="/dashboard?tab=build&walkthrough=profile" onClick={() => setMenuOpen(false)} data-testid="menu-replay-profile">Profile walkthrough</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/dashboard?tab=campaigns&walkthrough=campaign" onClick={() => setMenuOpen(false)} data-testid="menu-replay-campaign">Campaign walkthrough</Link></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <p className="rps-error" role="alert">{error}</p>}
    </>
  ) : isAuthenticated ? (
    <>
      <Link href="/profile/archived" className="rps-sub" aria-current={location === "/profile/archived" ? "page" : undefined} onClick={() => setMenuOpen(false)} data-testid="link-archived"><Archive size={16} aria-hidden /> Archived</Link>
      <Link href="/profile/edit" className="rps-sub" aria-current={location.split(/[?#]/)[0]!.replace(/\/+$/, "") === "/profile/edit" ? "page" : undefined} onClick={() => setMenuOpen(false)} data-testid="link-edit-profile"><Pencil size={16} aria-hidden /> Edit profile</Link>
      <Link href="/settings" className="rps-sub" aria-current={/^\/settings(\/|$|[?#])/.test(location) ? "page" : undefined} onClick={() => setMenuOpen(false)} data-testid="link-settings"><Settings size={16} aria-hidden /> Settings</Link>
      <button type="button" className="rps-sub" onClick={signOut} disabled={pending} data-testid="button-sign-out">
        <LogOut size={16} aria-hidden /> {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && <p className="rps-error" role="alert">{error}</p>}
    </>
  ) : (
    <div className="rps-guest">
      <Link href="/login" className="rp-btn rp-btn-ghost" data-testid="link-sign-in">Sign in</Link>
      <Link href="/register" className="rp-btn rp-btn-yellow" data-testid="link-join">Join</Link>
    </div>
  );

  return (
    <SupporterPostDraftProvider>
    <TextPostProvider>
    <div className={`rps-shell${isOrg ? " rps-org" : ""}${profilePage ? " rps-profile" : ""}${accountPage ? " rps-account" : ""}`}>
      <a href="#rps-main" className="rps-skip">Skip to content</a>

      <header className="rps-mhead">
        <Link href="/" className="rps-mlogo" aria-label="Root ProjX home" data-testid="link-logo-mobile">
          <img src="/logo-gold-v2.png" alt="" />
        </Link>
        <div className="rps-mhead-actions">
          <Link href={notif.href} className="rps-icon-btn" aria-label="Notifications"
            aria-current={isActive(notif) ? "page" : undefined} data-testid="link-notifications-mobile">
            <Bell size={22} aria-hidden />
            <UnreadBadge testId="badge-notifications-mobile" />
          </Link>
          {isAuthenticated && (
            <Link href={inboxNav.href} className="rps-icon-btn" aria-label="Inbox"
              aria-current={isActive(inboxNav) ? "page" : undefined} data-testid="link-inbox-mobile">
              <Inbox size={22} aria-hidden />
              <InboxBadge testId="badge-inbox-mobile" />
            </Link>
          )}
          <button ref={menuBtn} type="button" className="rps-icon-btn" aria-expanded={menuOpen}
            aria-controls="rps-mmenu" aria-label={menuOpen ? "Close menu" : "More destinations"}
            onClick={() => setMenuOpen(o => !o)} data-testid="button-mobile-menu">
            {menuOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
      </header>

      {menuOpen && <div className="rps-scrim" onClick={() => setMenuOpen(false)} aria-hidden />}
      <nav id="rps-mmenu" className="rps-mmenu" hidden={!menuOpen} aria-label="More">
        <ul>
          {overflow.map(item => {
            const Icon = icons[item.id];
            return (
              <li key={item.id}>
                <Link href={item.href} className="rps-nav-item"
                  aria-current={isActive(item) ? "page" : undefined}
                  onClick={() => setMenuOpen(false)} data-testid={`link-menu-${item.id}`}>
                  <Icon size={20} aria-hidden /> {item.label}
                  {item.id === "notifications" && <UnreadBadge testId="badge-notifications-menu" />}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="rps-mmenu-account">{accountBlock()}<OrganisationSwitcher /></div>
      </nav>

      <aside className="rps-side">
        <Link href="/" className="rps-logo" aria-label="Root ProjX home" data-testid="link-logo">
          <img src="/logo-stylised.png" alt="" />
        </Link>
        <nav aria-label={isOrg ? "Organisation" : "Supporter"}>
          <ul className="rps-nav">
            {supporterNavigation.map(item => {
              const Icon = icons[item.id];
              const active = isActive(item);
              return (
                <li key={item.id}>
                  {item.id === "create" ? (
                    <SupporterCreateMenu className="rps-nav-item" testId="link-nav-create">
                      <Icon size={20} aria-hidden />{item.label}
                    </SupporterCreateMenu>
                  ) : item.id === "notifications" && notifications.enabled ? (
                    <button ref={panelBtn} type="button" className="rps-nav-item rpn-trigger" aria-expanded={panelOpen} aria-controls="rpn-drawer"
                      aria-current={active ? "page" : undefined}
                      onClick={() => setPanelOpen(o => !o)} data-testid="button-nav-notifications">
                      <Icon size={20} aria-hidden />{item.label}
                      <UnreadBadge testId="badge-notifications-sidebar" />
                    </button>
                  ) : (
                  <Link href={item.href} className="rps-nav-item"
                    aria-current={active ? "page" : undefined} data-testid={`link-nav-${item.id}`}>
                    {item.id === "profile" && user ? <SupporterAvatar avatarUrl={user.avatarUrl} initials={user.avatarInitials} size={22} /> : <Icon size={20} aria-hidden />}
                    {item.label}
                    {item.id === "inbox" && <InboxBadge testId="badge-inbox-sidebar" />}
                  </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="rps-side-foot">{accountBlock(true)}<OrganisationSwitcher /></div>
      </aside>

      {panelOpen && notifications.enabled && (
        <>
          <div className="rpn-drawer-scrim" onClick={closePanel} aria-hidden data-testid="scrim-notifications" />
          <div id="rpn-drawer" className="rpn-drawer" role="dialog" aria-modal="false" aria-labelledby="rpn-panel-title">
            <NotificationsInbox variant="panel" titleId="rpn-panel-title" onClose={closePanel} onNavigate={() => setPanelOpen(false)} />
          </div>
        </>
      )}

      <main id="rps-main" className="rps-main" tabIndex={-1}>{children}</main>

      {!profilePage && !accountPage && !isOrg && <FollowingPanel />}

      <nav className="rps-bottom" aria-label="Primary">
        <ul>
          {mobileItems.map(item => {
            const Icon = icons[item.id];
            return (
              <li key={item.id}>
                {item.id === "create" ? (
                  <SupporterCreateMenu className="rps-tab" testId="link-tab-create" variant="sheet">
                    <Icon size={20} aria-hidden /><span>{item.label}</span>
                  </SupporterCreateMenu>
                ) : (
                <Link href={item.href} className="rps-tab"
                  aria-current={isActive(item) ? "page" : undefined}
                  data-testid={`link-tab-${item.id}`}>
                  {item.id === "profile" && user ? <SupporterAvatar avatarUrl={user.avatarUrl} initials={user.avatarInitials} size={22} /> : <Icon size={20} aria-hidden />}
                  <span>{item.id === "profile" && !isOrg ? "Me" : item.label}</span>
                  {item.id === "inbox" && <InboxBadge testId="badge-inbox-tab" className="rpn-badge rpm-tab-badge" />}
                </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
    </TextPostProvider>
    </SupporterPostDraftProvider>
  );
}
