import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Home, Compass, PlusSquare, Inbox, Bell, User, Bookmark, Heart, Menu, X, Pencil, Settings, LogOut, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { OrganisationLogo } from "@/components/organisation-logo";
import {
  supporterNavigation, supporterMobileNavigation, isSupporterNavigationActive,
  type SupporterNavigationId,
} from "@/lib/supporter-navigation";
import { useSupporterFollowing } from "./use-supporter-following";
import { SupporterCreateMenu } from "./SupporterCreateMenu";
import { SupporterPostDraftProvider } from "./SupporterPostDraftProvider";
import "./supporter.css";

const icons: Record<SupporterNavigationId, typeof Home> = {
  home: Home, discover: Compass, create: PlusSquare, inbox: Inbox,
  notifications: Bell, profile: User, saved: Bookmark, giving: Heart,
};

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
  const { user, isAuthenticated } = useAuth();
  const { signOut, error, pending } = useSignOut();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
    const page = supporterNavigation.find(item => isSupporterNavigationActive(item, location));
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
  }, [location]);
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

  const accountBlock = isAuthenticated ? (
    <>
      <Link href="/account" className="rps-sub" onClick={() => setMenuOpen(false)} data-testid="link-edit-profile"><Pencil size={16} aria-hidden /> Edit profile</Link>
      <Link href="/settings" className="rps-sub" onClick={() => setMenuOpen(false)} data-testid="link-settings"><Settings size={16} aria-hidden /> Settings</Link>
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
    <div className="rps-shell">
      <a href="#rps-main" className="rps-skip">Skip to content</a>

      <header className="rps-mhead">
        <Link href="/" className="rps-mlogo" aria-label="Root ProjX home" data-testid="link-logo-mobile">
          <img src="/logo-gold-v2.png" alt="" />
        </Link>
        <div className="rps-mhead-actions">
          <Link href={notif.href} className="rps-icon-btn" aria-label="Notifications"
            aria-current={isSupporterNavigationActive(notif, location) ? "page" : undefined} data-testid="link-notifications-mobile">
            <Bell size={22} aria-hidden />
          </Link>
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
                  aria-current={isSupporterNavigationActive(item, location) ? "page" : undefined}
                  onClick={() => setMenuOpen(false)} data-testid={`link-menu-${item.id}`}>
                  <Icon size={20} aria-hidden /> {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="rps-mmenu-account">{accountBlock}</div>
      </nav>

      <aside className="rps-side">
        <Link href="/" className="rps-logo" aria-label="Root ProjX home" data-testid="link-logo">
          <img src="/logo-stylised.png" alt="" />
        </Link>
        <nav aria-label="Supporter">
          <ul className="rps-nav">
            {supporterNavigation.map(item => {
              const Icon = icons[item.id];
              const active = isSupporterNavigationActive(item, location);
              return (
                <li key={item.id}>
                  {item.id === "create" ? (
                    <SupporterCreateMenu className="rps-nav-item" testId="link-nav-create">
                      <Icon size={20} aria-hidden />{item.label}
                    </SupporterCreateMenu>
                  ) : (
                  <Link href={item.href} className="rps-nav-item"
                    aria-current={active ? "page" : undefined} data-testid={`link-nav-${item.id}`}>
                    {item.id === "profile" && user ? <span className="rps-avatar sm" aria-hidden>{user.avatarInitials}</span> : <Icon size={20} aria-hidden />}
                    {item.label}
                  </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="rps-side-foot">{accountBlock}</div>
      </aside>

      <main id="rps-main" className="rps-main" tabIndex={-1}>{children}</main>

      <FollowingPanel />

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
                  aria-current={isSupporterNavigationActive(item, location) ? "page" : undefined}
                  data-testid={`link-tab-${item.id}`}>
                  {item.id === "profile" && user ? <span className="rps-avatar sm" aria-hidden>{user.avatarInitials}</span> : <Icon size={20} aria-hidden />}
                  <span>{item.id === "profile" ? "Me" : item.label}</span>
                </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
    </SupporterPostDraftProvider>
  );
}
