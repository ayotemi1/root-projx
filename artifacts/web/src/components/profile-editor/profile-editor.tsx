import { openPreviewAfterSave, flushProfile } from "@/lib/preview-nav";
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import type { Org, OrgProfilePatch } from "@/lib/api";
import { orgSectors, SECTORS } from "@/lib/sectors";
import {
  IdentitySection, StorySection, SectorsSection, ImpactSection, FundsSection, ContactSection, TeamSection,
  type SectionCtx,
} from "./sections";

interface Check { id: string; label: string; done: boolean; missing: string; optional?: boolean; section: string }

export function profileChecks(org: Org): Check[] {
  const short = (org.shortDescription ?? "").trim().length;
  const story = (org.description ?? "").trim().length;
  return [
    { id: "name", section: "identity", label: "Organisation name", done: !!org.name?.trim(), missing: "Add your name." },
    { id: "short", section: "identity", label: "One-line description", done: short >= 20 && short <= 120, missing: short === 0 ? "Write a one-line description (20 to 120 characters)." : `One-line description is ${short} characters; aim for 20 to 120.` },
    { id: "country", section: "identity", label: "Country", done: !!org.country?.trim(), missing: "Add your country." },
    { id: "story", section: "story", label: "Full story", done: story >= 200, missing: `Story is ${story} characters; aim for at least 200.` },
    { id: "sectors", section: "sectors", label: "At least one sector", done: orgSectors(org).some(value => (SECTORS as readonly string[]).includes(value)), missing: "Choose a sector." },
    { id: "logo", section: "identity", label: "Logo", done: !!org.logo, missing: "Add a logo." },
    { id: "impact", section: "impact", optional: true, label: "Impact metrics", done: !!org.impactMetrics && Object.keys(org.impactMetrics).length > 0, missing: "Share a number or two." },
    { id: "funds", section: "funds", optional: true, label: "Funds breakdown", done: !!org.fundsUsage, missing: "Show how money is spent." },
    { id: "contact", section: "contact", optional: true, label: "Contact", done: !!(org.contact && Object.values(org.contact).some(Boolean)), missing: "Add a way to reach you." },
    { id: "team", section: "team", optional: true, label: "Team", done: (org.team ?? []).length > 0, missing: "Introduce your people." },
  ];
}

function CompletenessMeter({ org }: { org: Org }) {
  const checks = profileChecks(org);
  const core = checks.filter((c) => !c.optional);
  const extra = checks.filter((c) => c.optional);
  const coreDone = core.filter((c) => c.done).length;
  const pct = Math.round((coreDone / core.length) * 100);
  const ready = coreDone === core.length;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm" data-tour-id="profile-completeness" data-testid="card-completeness">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-extrabold text-foreground">{ready ? "Donor-ready" : "Profile essentials"}</h3>
        <span className="text-sm font-extrabold tabular-nums text-primary" data-testid="text-completeness">{coreDone}/{core.length}</span>
      </div>
      <div className="mt-2 h-2.5 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Essential profile completeness">
        <div className="h-full bg-primary origin-left transition-transform duration-500" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <p className="text-xs text-muted-foreground mt-2">Based on what's saved. Name, one-line description, country, logo, story and a sector are required; the extras below help but are optional.</p>
      <ul className="mt-3 space-y-1.5">
        {core.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-sm">
            {c.done ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
            {c.done ? <span className="text-foreground/80">{c.label}</span> : (
              <a href={`#edit-${c.section}`} className="text-foreground hover:text-primary underline-offset-2 hover:underline">{c.missing}</a>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap gap-1.5">
        {extra.map((c) => (
          <a key={c.id} href={`#edit-${c.section}`} title={c.done ? `${c.label} added` : c.missing}
            className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${c.done ? "bg-green-50 border-green-200 text-green-700" : "border-border text-muted-foreground"}`}>
            {c.label}{c.done ? " added" : ""}
          </a>
        ))}
      </div>
    </div>
  );
}

const NAV = [
  ["identity", "Identity"], ["story", "Story"], ["sectors", "Sectors"], ["impact", "Impact"],
  ["funds", "Funds"], ["contact", "Contact"], ["team", "Team"],
] as const;

export function ProfileEditor({ org, userId, token }: { org: Org; userId: string; token: string }) {
  const queryClient = useQueryClient();
  const orgId = org._id;

  const onSaved = useCallback((patch: OrgProfilePatch, response: Org) => {
    // Merge only the fields this section submitted; take the server's value for those keys.
    queryClient.setQueryData<Org>(["org", orgId], (old) => {
      if (!old) return old;
      const next = { ...old } as Record<string, unknown>;
      const res = response as unknown as Record<string, unknown>;
      for (const k of Object.keys(patch)) next[k] = k in res ? res[k] : (patch as Record<string, unknown>)[k];
      return next as unknown as Org;
    });
    queryClient.invalidateQueries({ queryKey: ["organisations"] });
    queryClient.invalidateQueries({ queryKey: ["org", orgId], refetchType: "none" });
  }, [queryClient, orgId]);

  const ctx: SectionCtx = { org, orgId, userId, token, onSaved };

  return (
    <div className="space-y-5" data-tour-id="profile-editor">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="ops-display uppercase text-[34px] sm:text-[44px] leading-[.92] text-foreground">Edit profile</h2>
          <p className="text-sm text-muted-foreground">Each section saves on its own when you move on. Edits are kept on this device until saved.</p>
        </div>
        <ProfilePreviewButton orgId={orgId} />
      </div>

      <nav aria-label="Profile sections" className="-mx-4 px-4 overflow-x-auto sticky top-0 z-10 bg-[color:var(--ops-cream,hsl(var(--background)))] border-b border-[color:var(--ops-ink,transparent)] py-2">
        <ul className="flex gap-1.5 w-max">
          {NAV.map(([id, label]) => (
            <li key={id}>
              <a href={`#edit-${id}`} className="block text-xs font-bold px-3 py-2 border border-[color:var(--ops-line,transparent)] bg-[#FFFDF9] font-mono uppercase tracking-wider text-foreground/80 hover:border-[color:var(--ops-ink,currentColor)]" data-tour-id={`profile-nav-${id}`}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-8 items-start">
        <div className="space-y-0 order-2 lg:order-1 min-w-0">
          <IdentitySection {...ctx} />
          <StorySection {...ctx} />
          <SectorsSection {...ctx} />
          <ImpactSection {...ctx} />
          <FundsSection {...ctx} />
          <ContactSection {...ctx} />
          <TeamSection {...ctx} />
        </div>
        <div className="order-1 lg:order-2 lg:sticky lg:top-16 ops-block">
          <CompletenessMeter org={org} />
        </div>
      </div>
    </div>
  );
}

/** Saves every section first; opens the donor view only when all saved. */
export function ProfilePreviewButton({ orgId, className, tourId = "profile-view-public", testId = "link-public-profile" }: { orgId: string; className?: string; tourId?: string; testId?: string }) {
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" disabled={state === "saving"}
        onClick={async () => { setState("saving"); const ok = await openPreviewAfterSave(() => flushProfile(orgId), `/organisations/${orgId}?preview=1`); setState(ok ? "idle" : "failed"); }}
        className={className ?? "inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline underline-offset-2 disabled:opacity-60"}
        data-testid={testId} data-tour-id={tourId}>
        {state === "saving" ? "Saving…" : "Preview as a donor"} <ExternalLink className="w-3.5 h-3.5" />
      </button>
      {state === "failed" && (
        <span role="alert" className="text-xs text-destructive" data-testid="error-preview-profile">
          Some edits haven't saved, so we didn't open the preview. Check the sections marked in red. Nothing was lost.
        </span>
      )}
    </span>
  );
}
