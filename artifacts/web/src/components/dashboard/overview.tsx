import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertCircle, ArrowRight, Megaphone, RefreshCw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api";
import type { Campaign, ImpactMetricKey, Org } from "@/lib/api";

const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const daysSince = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : null);

function Block({ label, children, action, testId }: { label: string; children: React.ReactNode; action?: React.ReactNode; testId: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm" data-testid={testId}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-primary">{label}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DashboardOverview({ orgId, token, org, campaigns }: { orgId: string; token: string; org: Org | undefined; campaigns: Campaign[] }) {
  const q = useQuery({
    queryKey: ["dashboard-summary", orgId],
    queryFn: () => api.getDashboardSummary(orgId, token),
    enabled: !!orgId && !!token,
    staleTime: 30_000,
  });
  const s = q.data;

  if (q.isLoading) {
    return <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>;
  }

  const active = campaigns.filter((c) => c.status !== "completed");
  const raisedFor = (id: string, fallback: number) => s?.campaignRaised.find((r) => r.campaignId === id)?.raisedGbp ?? fallback;
  const updateAge = daysSince(s?.latestUpdateAt);
  const metricKeys: ImpactMetricKey[] = ["peopleReached", "groundCovered", "resourcesDelivered"];
  const metrics = metricKeys.map((k) => ({ k, m: org?.impactMetrics?.[k] }));
  const goalCampaign = active.find((c) => c.enabled && c.type === "fundraising" && c.goal > 0);
  const oldestMetric = metrics.reduce<number | null>((acc, { m }) => {
    const d = daysSince(m?.updatedAt); return d == null ? acc : Math.max(acc ?? 0, d);
  }, null);
  const metricsStale = s?.impactMetricsStale ?? (oldestMetric != null && oldestMetric > 30);

  return (
    <div className="space-y-4">
      {q.isError && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <span className="flex-1">We couldn't load your money summary. Nothing below is a guess.</span>
          <Button size="sm" variant="outline" onClick={() => q.refetch()} data-testid="button-retry-summary"><RefreshCw className="w-3.5 h-3.5 mr-1" />Retry</Button>
        </div>
      )}

      <Block label="Money" testId="block-overview-money" action={<Link href="/dashboard?tab=profile" className="text-xs font-bold text-primary hover:underline">Payouts</Link>}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-semibold">Raised, all time</p>
            <p className="text-2xl font-extrabold tabular-nums" data-testid="text-raised">{s ? gbp(s.raisedGbp) : "Couldn't load"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold">Owed to you now</p>
            <p className={`tabular-nums font-extrabold ${s?.owedGbp == null ? "text-base text-muted-foreground pt-1.5" : "text-2xl"}`} data-testid="text-owed">
              {s?.owedGbp == null ? "Couldn't load" : gbp(s.owedGbp)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold">Next payout</p>
            <p className="text-sm font-bold" data-testid="text-next-payout">{s?.nextPayoutAt ? day(s.nextPayoutAt) : s ? "Not scheduled" : "Couldn't load"}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-semibold">Last payout</p>
            {s?.lastPayout ? (
              <p className="text-sm font-bold" data-testid="text-last-payout">
                {gbp(s.lastPayout.amountGbp)} <span className="text-muted-foreground font-medium">on {day(s.lastPayout.sentAt)}</span>
                <span className="block text-[11px] font-mono text-muted-foreground truncate">Ref {s.lastPayout.reference}</span>
              </p>
            ) : <p className="text-sm font-bold text-muted-foreground" data-testid="text-last-payout">{s ? "None yet" : "Couldn't load"}</p>}
          </div>
        </div>
        {s && s.campaignRaised.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border" data-testid="block-money-per-campaign">
            <p className="text-xs text-muted-foreground font-semibold mb-1.5">Raised on each campaign</p>
            <ul className="space-y-1">
              {s.campaignRaised.map((r) => (
                <li key={r.campaignId} className="flex items-baseline justify-between gap-3 text-sm" data-testid={`text-campaign-raised-${r.campaignId}`}>
                  <span className="truncate">{r.name || "Untitled campaign"}</span>
                  <span className="font-extrabold tabular-nums">{gbp(r.raisedGbp)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">Raised is what donors chose to give, before fees. Owed is what our ledger says we still need to pay you.</p>
      </Block>

      <Block label="Supporters" testId="block-overview-supporters">
        {s && s.recentSupporters.length > 0 ? (
          <ul className="divide-y divide-border">
            {s.recentSupporters.slice(0, 6).map((p, i) => (
              <li key={`${p.displayName}-${p.createdAt}-${i}`} className="flex items-center gap-3 py-2">
                <span className="w-8 h-8 rounded-full bg-accent/25 text-foreground flex items-center justify-center text-xs font-extrabold">
                  {p.displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className="flex-1 text-sm font-semibold truncate">{p.displayName}</span>
                <span className="text-xs text-muted-foreground">{day(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{s ? "No supporters yet. Your first campaign will change that." : "Couldn't load."}</p>}
      </Block>

      <Block label="Campaigns" testId="block-overview-campaigns" action={<Link href="/dashboard?tab=campaigns" className="text-xs font-bold text-primary hover:underline">All</Link>}>
        {active.length === 0 ? (
          <Link href="/dashboard?tab=campaigns" className="flex items-center gap-2 text-sm font-bold text-primary"><Target className="w-4 h-4" /> Start your first campaign <ArrowRight className="w-4 h-4" /></Link>
        ) : (
          <ul className="space-y-3">
            {active.slice(0, 4).map((c) => {
              const raised = raisedFor(c._id, c.amountRaised ?? 0);
              const pct = c.goal > 0 ? Math.min(100, (raised / c.goal) * 100) : 0;
              return (
                <li key={c._id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-bold truncate">{c.name || "Untitled draft"}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.enabled ? "bg-green-50 text-green-700" : "bg-secondary text-muted-foreground"}`}>{c.enabled ? "Live" : "Draft"}</span>
                  </div>
                  {c.type === "fundraising" && c.goal > 0 && (
                    <>
                      <div className="h-2 rounded-full bg-secondary mt-1.5 overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} /></div>
                      <p className="text-xs text-muted-foreground mt-1 tabular-nums">{gbp(raised)} of {gbp(c.goal)}</p>
                    </>
                  )}
                  <div className="flex gap-3">
                    <Link href={`/dashboard?tab=campaigns&campaign=${encodeURIComponent(c._id)}`} className="text-xs font-bold text-primary hover:underline" data-testid={`link-overview-edit-${c._id}`}>Edit</Link>
                    <Link href={`/campaign/preview/${orgId}/${c._id}`} className="text-xs font-bold text-primary hover:underline" data-testid={`link-overview-preview-${c._id}`}>Preview as donor</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Block>

      <Block label="Updates" testId="block-overview-updates">
        {updateAge == null || updateAge >= 30 ? (
          <div className="flex items-start gap-3">
            <Megaphone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{updateAge == null ? "You haven't posted an update yet." : `Your last update was ${updateAge} days ago.`}</p>
              <p className="text-xs text-muted-foreground">Supporters who hear from you give again. One photo and two lines is enough.</p>
            </div>
            <Link href="/dashboard?tab=profile" className="text-xs font-bold text-primary whitespace-nowrap hover:underline" data-testid="link-post-update">Post one</Link>
          </div>
        ) : <p className="text-sm text-muted-foreground">Last update {updateAge === 0 ? "today" : `${updateAge} days ago`}. Nice.</p>}
      </Block>

      <Block label="Impact" testId="block-overview-impact" action={<Link href="/dashboard?tab=build#edit-impact" className="text-xs font-bold text-primary hover:underline">Edit</Link>}>
        <div className="grid grid-cols-2 gap-3">
          {metrics.map(({ k, m }) => (
            <div key={k} className="rounded-xl bg-secondary/50 p-3">
              <p className="text-xl font-extrabold tabular-nums">{m ? m.value.toLocaleString("en-GB") : "—"}</p>
              <p className="text-xs text-muted-foreground font-semibold truncate">{m?.label ?? "Not set"}</p>
            </div>
          ))}
          <div className="rounded-xl bg-primary/5 p-3">
            {goalCampaign ? (
              <>
                <p className="text-xl font-extrabold tabular-nums">{Math.floor(Math.min(100, (raisedFor(goalCampaign._id, goalCampaign.amountRaised ?? 0) / goalCampaign.goal) * 100))}%</p>
                <p className="text-xs text-muted-foreground font-semibold truncate">of {goalCampaign.name} goal</p>
              </>
            ) : <><p className="text-xl font-extrabold">—</p><p className="text-xs text-muted-foreground font-semibold">No live goal</p></>}
          </div>
        </div>
        {metricsStale && (
          <p className="text-xs text-muted-foreground mt-3" data-testid="text-impact-stale">
            These numbers haven't changed in over a month. <Link href="/dashboard?tab=build#edit-impact" className="font-bold text-primary hover:underline">Refresh them</Link> so donors see where things stand.
          </p>
        )}
      </Block>
    </div>
  );
}
