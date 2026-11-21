import { useState } from "react";
import { Link, Redirect, useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, MapPin, Plus, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { Org } from "@/lib/api";
import { OrganisationLogo } from "@/components/organisation-logo";
import { useSupporterFollowing } from "@/components/supporter/use-supporter-following";
import { selectOnboardingSuggestions, onboardingDestination } from "@/lib/onboarding-suggestions";
import { userErrorMessage } from "@/lib/error-feedback";
import "./onboarding-follows.css";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 2 });

function place(o: Org) {
  return [o.city, o.country].filter(Boolean).join(", ");
}

function FollowCard({ org, following, token }: { org: Org; following: boolean; token: string }) {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const dest = onboardingDestination(org);
  const sector = org.categories?.[0] || org.category;
  const blurb = org.shortDescription || org.description;

  const toggle = async () => {
    setError(""); setPending(true);
    try {
      if (following) await api.unfollowOrg(org._id, token);
      else await api.followOrg(org._id, token);
      qc.setQueryData<Org[]>(["follows", "my", token], old => {
        const list = old ?? [];
        return following ? list.filter(o => o._id !== org._id) : list.some(o => o._id === org._id) ? list : [...list, org];
      });
      qc.invalidateQueries({ queryKey: ["feed", "mine", token] });
      qc.invalidateQueries({ queryKey: ["organisations"] });
    } catch (e) {
      setError(userErrorMessage(e, following ? "unfollow this organisation" : "follow this organisation"));
    } finally { setPending(false); }
  };

  return (
    <article className="rpf-card" data-testid={`card-org-${org._id}`}>
      <div className="rpf-meta">
        {place(org) && <span className="rpf-loc"><MapPin size={12} aria-hidden /> {place(org)}</span>}
        {org.verified && <span className="rpf-verified" data-testid={`status-verified-${org._id}`}><ShieldCheck size={13} aria-hidden /> Verified</span>}
      </div>
      <div className="rpf-head">
        <OrganisationLogo name={org.name} logo={org.logo} />
        <h2 className="rpf-name" data-testid={`text-org-name-${org._id}`}>{org.name}</h2>
      </div>
      {sector && <span className="rpf-sector">{sector}</span>}
      {blurb && <p className="rpf-desc">{blurb}</p>}
      <p className="rpf-stats">
        {Number.isFinite(org.followerCount) && <span data-testid={`text-followers-${org._id}`}><strong>{org.followerCount}</strong> {org.followerCount === 1 ? "follower" : "followers"}</span>}
        {org.totalRaised > 0 && <span data-testid={`text-raised-${org._id}`}><strong>{gbp.format(org.totalRaised)}</strong> raised</span>}
      </p>
      <div className="rpf-btns">
        <Link href={dest.href} className="rp-btn rp-btn-yellow rpf-btn" data-testid={`link-${dest.label.toLowerCase()}-${org._id}`}>
          {dest.label} <ArrowRight size={14} aria-hidden />
        </Link>
        <button type="button" className="rp-btn rpf-btn rpf-follow" aria-pressed={following} disabled={pending}
          onClick={toggle} data-testid={`button-follow-${org._id}`}
          aria-label={following ? `Unfollow ${org.name}` : `Follow ${org.name}`}>
          {pending ? (following ? "Unfollowing…" : "Following…") : following
            ? <><Check size={14} aria-hidden /> Following</>
            : <><Plus size={14} aria-hidden /> Follow</>}
        </button>
      </div>
      {error && <p className="rpf-err" role="alert" data-testid={`error-follow-${org._id}`}>{error}</p>}
    </article>
  );
}

export default function OnboardingFollowsPage() {
  const { token, isAuthenticated, user } = useAuth();
  const search = useSearch();
  const [, navigate] = useLocation();
  const skipped = new URLSearchParams(search).get("interests") === "skipped";
  const isSupporter = !!token && user?.accountType === "supporter";

  const orgsQ = useQuery({ queryKey: ["organisations", "onboarding"], queryFn: () => api.getOrganisations(), enabled: isSupporter });
  const interestsQ = useQuery({
    queryKey: ["interests", token], queryFn: () => api.getSupporterInterests(token as string),
    enabled: isSupporter && !skipped,
    staleTime: 0, refetchOnMount: "always",
  });
  const follows = useSupporterFollowing();

  if (!isAuthenticated || !token) return <Redirect to="/login" />;
  if (user?.accountType !== "supporter") return <Redirect to="/dashboard" />;

  const loading = orgsQ.isLoading || follows.isLoading || (!skipped && interestsQ.isLoading);
  const failed = orgsQ.isError || follows.isError || (!skipped && interestsQ.isError);
  const retry = () => {
    if (orgsQ.isError) orgsQ.refetch();
    if (follows.isError) follows.refetch();
    if (!skipped && interestsQ.isError) interestsQ.refetch();
  };
  const interests = skipped ? [] : interestsQ.data?.interests ?? [];
  const suggestions = !loading && !failed ? selectOnboardingSuggestions(orgsQ.data ?? [], interests) : [];
  const followed = new Set((follows.data ?? []).map(o => o._id));
  const exit = () => navigate("/feed");

  return (
    <section className="rpf-page rp-rise" data-testid="page-onboarding-follows">
      <p className="rpi-kicker">Optional · Step 2 of 2</p>
      <h1 className="rpf-title">Follow a few organisations</h1>
      <p className="rpf-lede">Their public updates will appear on your Home feed.</p>

      {loading ? (
        <div className="rpf-grid" aria-busy="true" aria-label="Loading organisations">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="rpf-card rpf-skel"><span /><span /><span /></div>)}
        </div>
      ) : failed ? (
        <div className="rpi-error" role="alert" data-testid="error-follows-page">
          <p>We couldn't load organisations right now.</p>
          <button type="button" className="rp-btn rp-btn-ghost rpi-btn" onClick={retry} data-testid="button-retry-follows">Retry</button>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="rpf-empty" data-testid="status-no-suggestions">
          <p>No organisations to suggest yet. You can browse everyone on Discover whenever you like.</p>
          <Link href="/discover" className="rp-link-u" data-testid="link-discover-empty">Go to Discover</Link>
        </div>
      ) : (
        <div className="rpf-grid">
          {suggestions.map(o => <FollowCard key={o._id} org={o} following={followed.has(o._id)} token={token} />)}
        </div>
      )}

      <div className="rpf-actions">
        <button type="button" className="rp-btn rp-btn-yellow rpf-btn" onClick={exit} data-testid="button-go-home">
          Go to Home <ArrowRight size={14} aria-hidden />
        </button>
        <button type="button" className="rp-link-u rpi-skip" onClick={exit} data-testid="link-skip-follows">Skip for now</button>
      </div>
    </section>
  );
}
