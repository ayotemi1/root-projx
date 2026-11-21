import { Link } from "wouter";
import { Pencil, Compass } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { OrganisationLogo } from "@/components/organisation-logo";
import { useSupporterFollowing } from "./use-supporter-following";
import { SupporterCreateMenu } from "./SupporterCreateMenu";
import "./supporter.css";

export function SupporterHomeIntro() {
  const { user } = useAuth();
  const follows = useSupporterFollowing();
  const orgs = follows.data ?? [];

  return (
    <section className="rps-intro" aria-labelledby="rps-home-heading">
      <h1 id="rps-home-heading" className="rps-home-title">Home</h1>

      {!follows.enabled ? (
        <div className="rps-strip-note" data-testid="text-guest-following">
          <p>Follow organisations to see their work here.</p>
          <div className="rps-row">
            <Link href="/login" className="rps-chip" data-testid="link-intro-signin">Sign in</Link>
            <Link href="/discover" className="rps-chip rps-chip-ghost" data-testid="link-intro-discover">
              <Compass size={15} aria-hidden /> Discover
            </Link>
          </div>
        </div>
      ) : follows.isLoading ? (
        <ul className="rps-strip" aria-label="Loading followed organisations" aria-busy="true">
          {[0, 1, 2].map(i => (
            <li key={i} className="rps-story"><span className="rps-skel-ring" /><span className="rps-skel-line" /></li>
          ))}
        </ul>
      ) : follows.isError ? (
        <div className="rps-strip-note" role="alert">
          <p>We couldn't load the organisations you follow.</p>
          <button type="button" className="rps-chip" onClick={() => follows.refetch()} data-testid="button-retry-follows-intro">Retry</button>
        </div>
      ) : orgs.length === 0 ? (
        <div className="rps-strip-note" data-testid="text-no-follows">
          <p>You're not following any organisations yet.</p>
          <Link href="/discover" className="rps-chip" data-testid="link-intro-find">Find organisations</Link>
        </div>
      ) : (
        <ul className="rps-strip" aria-label="Organisations you follow">
          {orgs.map(o => (
            <li key={o._id} className="rps-story">
              <Link href={`/organisations/${o._id}`} className="rps-story-link" data-testid={`link-story-org-${o._id}`}>
                <span className="rps-ring"><OrganisationLogo name={o.name} logo={o.logo} /></span>
                <span className="rps-story-name">{o.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <SupporterCreateMenu className="rps-composer" testId="link-composer-create">
        {user && <span className="rps-avatar" aria-hidden>{user.avatarInitials}</span>}
        <span className="rps-composer-q">What's caught your attention?</span>
        <span className="rps-composer-btn"><Pencil size={15} aria-hidden /> Create</span>
      </SupporterCreateMenu>
    </section>
  );
}
