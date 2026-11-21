import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronDown, LayoutGrid, MapPin, Plus, Search, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { Org } from "@/lib/api";
import { COUNTRIES } from "@/lib/countries";
import { SECTORS, orgSectors } from "@/lib/sectors";
import { onboardingDestination } from "@/lib/onboarding-suggestions";
import { userErrorMessage } from "@/lib/error-feedback";
import {
  filterDiscoverOrgs, recommendDiscoverOrgs, mappedOrgPosition, discoverRaisedLabel, type DiscoverFilters,
} from "@/lib/discover-supporter";
import { OrganisationLogo } from "@/components/organisation-logo";
import { useSupporterFollowing } from "./use-supporter-following";
import { SupporterOrgMap, type MappedOrg } from "./SupporterOrgMap";
import "./supporter-discover.css";

type FollowState = { known: boolean; following: boolean };

function DiscoverCard({ org, follow, section }: { org: Org; follow: FollowState; section: "rec" | "all" }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [error, setError] = useState("");
  const dest = onboardingDestination(org);
  const place = [org.city, org.country].filter(Boolean).join(", ");
  const sector = orgSectors(org)[0];
  const blurb = org.shortDescription?.trim() || org.description;
  const raised = discoverRaisedLabel(org);
  const profile = `/organisations/${encodeURIComponent(org._id)}`;
  const tid = `${section}-${org._id}`;

  const open = () => navigate(profile);
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  };
  const stop = (e: MouseEvent) => e.stopPropagation();

  const mutationKey = ["discover-follow", org._id, token];
  const pending = useIsMutating({ mutationKey }) > 0;
  const followMutation = useMutation({
    mutationKey,
    mutationFn: async (was: boolean) => {
      if (!token) throw new Error("Sign in again before changing the organisations you follow.");
      if (was) await api.unfollowOrg(org._id, token);
      else await api.followOrg(org._id, token);
    },
    onSuccess: (_, was) => {
      qc.setQueryData<Org[]>(["follows", "my", token], old => {
        const list = old ?? [];
        return was ? list.filter(o => o._id !== org._id) : list.some(o => o._id === org._id) ? list : [...list, org];
      });
      qc.invalidateQueries({ queryKey: ["feed", "mine", token] });
      qc.invalidateQueries({ queryKey: ["organisations"] });
    },
    onError: (e, was) => {
      setError(userErrorMessage(e, was ? "unfollow this organisation" : "follow this organisation"));
    },
  });
  const toggle = () => {
    if (!token || !follow.known || pending) return;
    setError("");
    followMutation.mutate(follow.following);
  };

  return (
    <article className="rpd-card" role="link" tabIndex={0} aria-label={`${org.name} profile`}
      onClick={open} onKeyDown={onKey} data-testid={`card-${tid}`}>
      <div className="rpd-meta">
        <span className="rpd-loc"><MapPin size={12} aria-hidden /> {place || "Location not listed"}</span>
        {org.verified === true && <span className="rpd-verified" data-testid={`status-verified-${tid}`}><ShieldCheck size={13} aria-hidden /> Verified</span>}
      </div>
      <div className="rpd-head">
        <OrganisationLogo name={org.name} logo={org.logo} />
        <h3 className="rpd-name" data-testid={`text-org-name-${tid}`}>{org.name}</h3>
      </div>
      {sector && <span className="rpd-sector">{sector}</span>}
      {blurb && <p className="rpd-desc">{blurb}</p>}
      {(Number.isFinite(org.followerCount) || raised) && (
        <p className="rpd-stats">
          {Number.isFinite(org.followerCount) && <span data-testid={`text-followers-${tid}`}><strong>{org.followerCount}</strong> {org.followerCount === 1 ? "follower" : "followers"}</span>}
          {raised && <span data-testid={`text-raised-${tid}`}><strong>{raised}</strong> raised</span>}
        </p>
      )}
      <div className="rpd-btns" onClick={stop} onKeyDown={e => e.stopPropagation()}>
        <Link href={dest.href} className="rp-btn rp-btn-yellow rpd-btn" data-testid={`link-${dest.label.toLowerCase()}-${tid}`}>
          {dest.label} <ArrowRight size={14} aria-hidden />
        </Link>
        <button type="button" className="rp-btn rpd-btn rpd-follow" aria-pressed={follow.following}
          disabled={pending || !follow.known} onClick={toggle} data-testid={`button-follow-${tid}`}
          aria-label={follow.following ? `Unfollow ${org.name}` : `Follow ${org.name}`}>
          {!follow.known ? "Checking…" : pending ? (follow.following ? "Unfollowing…" : "Following…") : follow.following
            ? <><Check size={14} aria-hidden /> Following</>
            : <><Plus size={14} aria-hidden /> Follow</>}
        </button>
      </div>
      {error && <p className="rpd-err" role="alert" onClick={stop} data-testid={`error-follow-${tid}`}>{error}</p>}
    </article>
  );
}

function SkeletonGrid({ n = 3 }: { n?: number }) {
  return (
    <div className="rpd-grid" aria-busy="true" aria-label="Loading organisations">
      {Array.from({ length: n }, (_, i) => <div key={i} className="rpd-card rpd-skel"><span /><span /><span /></div>)}
    </div>
  );
}

const EMPTY: DiscoverFilters = { search: "", country: "", cause: "" };

export default function SupporterDiscoverPage() {
  const { token } = useAuth();
  const [filters, setFilters] = useState<DiscoverFilters>(EMPTY);
  const [view, setView] = useState<"grid" | "map">("grid");
  const set = (patch: Partial<DiscoverFilters>) => setFilters(f => ({ ...f, ...patch }));
  const clear = () => setFilters(EMPTY);

  const orgsQ = useQuery({ queryKey: ["organisations", "discover-all"], queryFn: () => api.getOrganisations(), staleTime: 0, refetchOnMount: "always" });
  const follows = useSupporterFollowing();
  const interestsQ = useQuery({ queryKey: ["interests", token], queryFn: () => api.getSupporterInterests(token as string), enabled: !!token, staleTime: 0, refetchOnMount: "always" });
  const givingQ = useQuery({ queryKey: ["donations", "my", token], queryFn: () => api.getMyDonations(token as string), enabled: !!token });

  const orgs = useMemo(() => (orgsQ.data ?? []).filter(o => o._id && o.name?.trim()), [orgsQ.data]);
  const followed = follows.data ?? [];
  const followedIds = new Set(followed.map(o => o._id));
  const followKnown = follows.isSuccess;
  const stateFor = (id: string): FollowState => ({ known: followKnown, following: followedIds.has(id) });

  const causes = useMemo(() => {
    const extra = new Set<string>();
    orgs.forEach(o => orgSectors(o).forEach(s => { if (s && !(SECTORS as readonly string[]).includes(s)) extra.add(s); }));
    return [...SECTORS, ...[...extra].sort()];
  }, [orgs]);

  const matching = useMemo(() => filterDiscoverOrgs(orgs, filters), [orgs, filters]);
  const signalsReady = followKnown && interestsQ.isSuccess && givingQ.isSuccess;
  const signalsFailed = follows.isError || interestsQ.isError || givingQ.isError;
  const signalsLoading = !signalsReady && !signalsFailed;
  const successfulGiving = useMemo(() =>
    (givingQ.data ?? []).filter(d => !d.status || ["succeeded", "paid", "completed"].includes(d.status)), [givingQ.data]);
  const rec = useMemo(() => {
    if (!signalsReady) return null;
    const supportedOrgIds = [...new Set(successfulGiving.map(d => d.orgId).filter(Boolean))];
    const byId = new Map(orgs.map(o => [o._id, o] as const));
    const supportedOrgs = supportedOrgIds.flatMap(id => { const o = byId.get(id); return o ? [o] : []; });
    return recommendDiscoverOrgs(matching, { interests: interestsQ.data?.interests ?? [], followedOrgs: follows.data ?? [], supportedOrgIds, supportedOrgs }, 3);
  }, [signalsReady, orgs, matching, interestsQ.data, follows.data, successfulGiving]);

  const hasInterests = (interestsQ.data?.interests ?? []).length > 0;
  const hasFollows = followed.length > 0;
  const hasGiving = successfulGiving.length > 0;
  const basis = [hasInterests && "your interests", hasFollows && "causes you follow", hasGiving && "your giving"].filter(Boolean) as string[];
  const basisLine = basis.length ? `Based on ${basis.length > 1 ? basis.slice(0, -1).join(", ") + " and " + basis[basis.length - 1] : basis[0]}.` : "";

  const mapped: MappedOrg[] = useMemo(() => matching.flatMap(org => {
    const position = mappedOrgPosition(org);
    return position ? [{ org, position }] : [];
  }), [matching]);
  const unmapped = matching.length - mapped.length;

  const retrySignals = () => {
    if (follows.isError) follows.refetch();
    if (interestsQ.isError) interestsQ.refetch();
    if (givingQ.isError) givingQ.refetch();
  };

  const emptyState = (
    <div className="rpd-empty" data-testid="status-no-matches">
      <p className="rpd-empty-h">No organisations match</p>
      <p>Try a different name, country or cause.</p>
      <button type="button" className="rp-btn rp-btn-ghost rpd-btn" onClick={clear} data-testid="button-clear-filters">Clear filters</button>
    </div>
  );

  return (
    <section className="rpd-page rp-rise" data-testid="page-supporter-discover">
      <h1 className="rpd-title">Discover<br />organisations</h1>
      <p className="rpd-lede">Find and support verified grassroots organisations in Jamaica, the UK, and beyond.</p>

      <div className="rpd-filters" role="search">
        <label className="rpd-field rpd-search">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search by name or location</span>
          <input type="search" placeholder="Search by name or location" value={filters.search}
            onChange={e => set({ search: e.target.value })} data-testid="input-search" />
        </label>
        <label className="rpd-field rpd-select">
          <span className="rpd-field-l">Country</span>
          <select value={filters.country} onChange={e => set({ country: e.target.value })} data-testid="select-country">
            <option value="">All countries</option>
            {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.value}</option>)}
          </select>
          <ChevronDown size={16} aria-hidden className="rpd-chev" />
        </label>
        <label className="rpd-field rpd-select">
          <span className="rpd-field-l">Cause</span>
          <select value={filters.cause} onChange={e => set({ cause: e.target.value })} data-testid="select-cause">
            <option value="">All causes</option>
            {causes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={16} aria-hidden className="rpd-chev" />
        </label>
        <div className="rpd-toggle" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")} data-testid="button-view-grid"><LayoutGrid size={16} aria-hidden /> Grid</button>
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} data-testid="button-view-map"><MapPin size={16} aria-hidden /> Map</button>
        </div>
      </div>

      {orgsQ.isLoading ? (
        <SkeletonGrid n={6} />
      ) : orgsQ.isError ? (
        <div className="rpd-error" role="alert" data-testid="error-orgs">
          <p>We couldn't load organisations right now.</p>
          <button type="button" className="rp-btn rp-btn-ghost rpd-btn" onClick={() => orgsQ.refetch()} data-testid="button-retry-orgs">Retry</button>
        </div>
      ) : (
        <>
          {view === "map" && (
            <div className="rpd-map-wrap" data-testid="view-map">
              {matching.length > 0 && <div className="rpd-map"><SupporterOrgMap items={mapped} /></div>}
              <p className="rpd-map-note" data-testid="text-map-coverage">
                {matching.length === 0 ? "No matching organisations to map."
                  : mapped.length === 0 ? "None of the matching organisations have a mapped location yet. They're all listed below."
                  : unmapped > 0 ? `${mapped.length} of ${matching.length} shown on the map. ${unmapped} ${unmapped === 1 ? "hasn't" : "haven't"} added a mapped location and ${unmapped === 1 ? "is" : "are"} listed below.`
                  : `All ${mapped.length} matching ${mapped.length === 1 ? "organisation is" : "organisations are"} on the map.`}
              </p>
            </div>
          )}

          {view === "grid" && matching.length > 0 && (
            <section className="rpd-section" aria-labelledby="rpd-rec-h" data-testid="section-recommended">
              {signalsLoading ? (
                <><h2 id="rpd-rec-h" className="rpd-h2">Recommended for you</h2><SkeletonGrid /></>
              ) : signalsFailed ? (
                <>
                  <h2 id="rpd-rec-h" className="rpd-h2">Recommendations</h2>
                  <div className="rpd-error" role="alert" data-testid="error-recommendations">
                    <p>We couldn't load your preferences, so we can't recommend organisations right now. The full directory below still works.</p>
                    <button type="button" className="rp-btn rp-btn-ghost rpd-btn" onClick={retrySignals} data-testid="button-retry-recommendations">Retry</button>
                  </div>
                </>
              ) : rec && rec.organisations.length > 0 ? (
                <>
                  <h2 id="rpd-rec-h" className="rpd-h2">{rec.personalised ? "Recommended for you" : "Explore organisations"}</h2>
                  {rec.personalised && basisLine && <p className="rpd-basis" data-testid="text-recommendation-basis">{basisLine}</p>}
                  <div className="rpd-grid">{rec.organisations.map(o => <DiscoverCard key={o._id} org={o} follow={stateFor(o._id)} section="rec" />)}</div>
                </>
              ) : (
                <>
                  <h2 id="rpd-rec-h" className="rpd-h2">Recommended for you</h2>
                  <p className="rpd-basis" data-testid="text-no-recommendations">You already follow every organisation that matches these filters.</p>
                </>
              )}
            </section>
          )}

          <section className="rpd-section" aria-labelledby="rpd-all-h" data-testid="section-all">
            <div className="rpd-sec-head">
              <h2 id="rpd-all-h" className="rpd-h2">All organisations</h2>
              <span className="rpd-count" data-testid="text-org-count">{matching.length} {matching.length === 1 ? "result" : "results"}</span>
            </div>
            {matching.length === 0 ? emptyState : (
              <div className="rpd-grid">{matching.map(o => <DiscoverCard key={o._id} org={o} follow={stateFor(o._id)} section="all" />)}</div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
