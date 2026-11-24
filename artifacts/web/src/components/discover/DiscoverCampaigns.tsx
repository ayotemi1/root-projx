import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { useListDiscoverCampaigns, getListDiscoverCampaignsQueryKey } from "@workspace/api-client-react";
import { ArrowRight } from "lucide-react";
import type { DiscoverCampaignItem } from "@/lib/api";
import {
  adaptDiscoverEntries, CAMPAIGN_SORTS, DISCOVER_TABS, filterDiscoverCampaigns, parseDiscoverTab, sortDiscoverCampaigns,
  validDiscoverCampaigns, withDiscoverTab, type CampaignSort, type DiscoverTab,
} from "@/lib/discover-campaigns";
import { DiscoverCampaignCard } from "@/components/campaign-card/DiscoverCampaignCard";
import { DonationAmountDialog } from "@/components/donation-amount-dialog";
import "./discover-campaigns.css";

export const DISCOVER_INTRO = "Find verified grassroots organisations and the campaigns they're running right now.";

/** URL-backed tab (?tab=), preserving other params; pushes history so Back/Forward work. */
export function useDiscoverTab(): [DiscoverTab, (t: DiscoverTab) => void] {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const tab = parseDiscoverTab(search);
  const set = (t: DiscoverTab) => { if (t !== tab) navigate(`${location}${withDiscoverTab(search, t)}`); };
  return [tab, set];
}

export function DiscoverTabs({ tab, onTab }: { tab: DiscoverTab; onTab: (t: DiscoverTab) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % DISCOVER_TABS.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + DISCOVER_TABS.length) % DISCOVER_TABS.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = DISCOVER_TABS.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onTab(DISCOVER_TABS[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div className="dcx-tabs" role="tablist" aria-label="Discover sections">
      {DISCOVER_TABS.map((t, i) => (
        <button key={t.value} ref={el => { refs.current[i] = el; }} type="button" role="tab" id={`dcx-tab-${t.value}`}
          aria-selected={tab === t.value} aria-controls="dcx-panel" tabIndex={tab === t.value ? 0 : -1}
          onClick={() => onTab(t.value)} onKeyDown={e => onKey(e, i)} data-testid={`tab-${t.value}`}>{t.label}</button>
      ))}
    </div>
  );
}

export function DiscoverTabPanel({ tab, children }: { tab: DiscoverTab; children: ReactNode }) {
  return <div id="dcx-panel" role="tabpanel" aria-labelledby={`dcx-tab-${tab}`}>{children}</div>;
}

type Filters = { search: string; country: string; cause: string };

export function useDiscoverCampaigns(filters: Filters) {
  const q = useListDiscoverCampaigns({ query: { queryKey: getListDiscoverCampaignsQueryKey(), staleTime: 0, refetchOnMount: "always", refetchInterval: 60_000 } });
  const all = useMemo(() => validDiscoverCampaigns(adaptDiscoverEntries(q.data)), [q.data]);
  const matching = useMemo(() => filterDiscoverCampaigns(all, filters), [all, filters.search, filters.country, filters.cause]); // eslint-disable-line react-hooks/exhaustive-deps
  return { q, all, matching };
}

function useDonate() {
  const [item, setItem] = useState<DiscoverCampaignItem | null>(null);
  const dialog = item && (
    <DonationAmountDialog onClose={() => setItem(null)} orgId={item.organisation._id} orgName={item.organisation.name}
      campaignId={item.campaign._id} campaignName={item.campaign.name}
      campaignPath={item.campaign.sharePath ?? (item.campaign.publicId ? `/campaigns/${encodeURIComponent(item.campaign.publicId)}` : null)}
      currency={item.campaign.currency ?? "gbp"} />
  );
  return { open: setItem, dialog };
}

function Card({ item, onDonate }: { item: DiscoverCampaignItem; onDonate: (i: DiscoverCampaignItem) => void }) {
  const o = item.organisation;
  return <DiscoverCampaignCard campaign={item.campaign}
    org={{ name: o.name, logo: o.logo, verified: o.verified === true, href: `/organisations/${encodeURIComponent(o._id)}` }}
    onDonate={() => onDonate(item)} />;
}

function Skeleton({ n, row }: { n: number; row?: boolean }) {
  return (
    <div className={row ? "dcx-row" : "dcx-grid"} aria-busy="true" aria-label="Loading campaigns" data-testid="status-campaigns-loading">
      {Array.from({ length: n }, (_, i) => <div key={i} className="dcx-skel"><span /><span /><span /><span /></div>)}
    </div>
  );
}

type State = ReturnType<typeof useDiscoverCampaigns>;

function Status({ state, onClear }: { state: State; onClear: () => void }) {
  if (state.q.isError) return (
    <div className="dcx-msg" role="alert" data-testid="error-campaigns">
      <p className="dcx-msg-h">Could not load campaigns.</p>
      <p>Check your connection and try again.</p>
      <button type="button" className="rp-btn rp-btn-ghost" onClick={() => state.q.refetch()} data-testid="button-retry-campaigns">Try again</button>
    </div>
  );
  if (state.all.length === 0) return (
    <div className="dcx-msg" data-testid="status-no-campaigns">
      <p className="dcx-msg-h">No live campaigns right now</p>
      <p>Organisations launch new campaigns regularly. Check back soon.</p>
    </div>
  );
  return (
    <div className="dcx-msg" data-testid="status-no-campaign-matches">
      <p className="dcx-msg-h">No campaigns match</p>
      <p>Try a different name, country or cause.</p>
      <button type="button" className="rp-btn rp-btn-ghost" onClick={onClear} data-testid="button-clear-campaign-filters">Clear filters</button>
    </div>
  );
}

/** ALL tab: horizontal row of live campaigns. */
export function LiveCampaignsRow({ state, onSeeAll, onClear }: { state: State; onSeeAll: () => void; onClear: () => void }) {
  const donate = useDonate();
  const sorted = useMemo(() => sortDiscoverCampaigns(state.matching, "ending"), [state.matching]);
  return (
    <section className="dcx-section" aria-labelledby="dcx-live-h" data-testid="section-live-campaigns">
      {donate.dialog}
      <div className="dcx-head">
        <h2 id="dcx-live-h" className="dcx-h2">Live campaigns</h2>
        <button type="button" className="dcx-seeall" onClick={onSeeAll} data-testid="link-see-all-campaigns">See all campaigns <ArrowRight size={16} aria-hidden /></button>
      </div>
      {state.q.isLoading ? <Skeleton n={4} row />
        : state.q.isError || sorted.length === 0 ? <Status state={state} onClear={onClear} />
        : <div className="dcx-row" data-testid="row-live-campaigns">{sorted.map(i => <Card key={i.campaign._id} item={i} onDonate={donate.open} />)}</div>}
    </section>
  );
}

/** CAMPAIGNS tab: count, sort and grid. */
export function CampaignsGrid({ state, onClear }: { state: State; onClear: () => void }) {
  const donate = useDonate();
  const [sort, setSort] = useState<CampaignSort>("ending");
  const sorted = useMemo(() => sortDiscoverCampaigns(state.matching, sort), [state.matching, sort]);
  const n = sorted.length;
  return (
    <section className="dcx-section" aria-labelledby="dcx-grid-h" data-testid="section-campaigns">
      {donate.dialog}
      <div className="dcx-head dcx-head-wrap">
        <h2 id="dcx-grid-h" className="dcx-h2" data-testid="text-campaign-count">
          {state.q.isLoading ? "Live campaigns" : `${n} live ${n === 1 ? "campaign" : "campaigns"}`}
        </h2>
        <div className="dcx-sorts" role="group" aria-label="Sort campaigns">
          {CAMPAIGN_SORTS.map(s => (
            <button key={s.value} type="button" aria-pressed={sort === s.value} onClick={() => setSort(s.value)} data-testid={`button-sort-${s.value}`}>{s.label}</button>
          ))}
        </div>
      </div>
      {state.q.isLoading ? <Skeleton n={4} />
        : state.q.isError || n === 0 ? <Status state={state} onClear={onClear} />
        : <div className="dcx-grid" data-testid="grid-campaigns">{sorted.map(i => <Card key={i.campaign._id} item={i} onDonate={donate.open} />)}</div>}
    </section>
  );
}
