import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Org, OrgProfilePatch, ImpactMetricKey, ImpactMetricsInput, TeamMember, FundsUsage } from "@/lib/api";
import { SECTORS, orgSectors } from "@/lib/sectors";
import { COVER_SPEC, LOGO_SPEC, TEAM_SPEC } from "@/lib/image-process";
import { useSectionAutosave } from "./use-section-autosave";
import { SectionShell, CharCount, SaveIndicator } from "./section-shell";
import { ImageUploadField } from "./image-upload-field";

export interface SectionCtx {
  org: Org;
  orgId: string;
  userId: string;
  token: string;
  onSaved: (patch: OrgProfilePatch, response: Org) => void;
}

const HTML_RE = /<\s*\/?\s*[a-z!][^>]*>/i;
const t = (s: string) => s.trim();

function base(ctx: SectionCtx, section: string) {
  return { section, orgId: ctx.orgId, userId: ctx.userId, token: ctx.token, onSaved: ctx.onSaved };
}

// ── Identity ─────────────────────────────────────────────────────────────────

interface IdentityValue { name: string; shortDescription: string; country: string; city: string }

export function IdentitySection(ctx: SectionCtx) {
  const { org } = ctx;
  const s = useSectionAutosave<IdentityValue>({
    ...base(ctx, "identity"),
    initial: { name: org.name ?? "", shortDescription: org.shortDescription ?? "", country: org.country ?? "", city: org.city ?? "" },
    validate: (v) => {
      if (!t(v.name)) return "Add your organisation's name before we can save this section.";
      if (t(v.shortDescription).length > 120) return `Shorten the one-line description to 120 characters (currently ${t(v.shortDescription).length}).`;
      if (!t(v.country)) return "Add the country you work in.";
      return null;
    },
    toPatch: (v) => ({ name: t(v.name), shortDescription: t(v.shortDescription), country: t(v.country), city: t(v.city) || null }),
  });
  const logo = useSectionAutosave<string | null>({
    ...base(ctx, "identity-logo"),
    initial: org.logo ?? null,
    validate: (v) => (v ? null : "Upload a logo first."),
    toPatch: (v) => ({ logo: v }),
  });
  const cover = useSectionAutosave<string | null>({
    ...base(ctx, "identity-cover"),
    initial: org.coverImage ?? null,
    validate: (v) => (v ? null : "Upload a cover image first."),
    toPatch: (v) => ({ coverImage: v }),
  });

  /** Uploaded URL is kept as a recoverable draft until the PATCH attaching it succeeds. */
  async function attach(hook: typeof logo, url: string) {
    hook.setValue(url);
    await hook.commit();
  }

  const v = s.value;
  return (
    <SectionShell section="identity" title="Identity" hint="Who you are, where you work, and the one line donors see on Discover."
      orgId={ctx.orgId} status={s.status} error={s.error} onRetry={s.commit} onBlur={s.onSectionBlur}
      wasRecovered={s.wasRecovered} onDiscard={s.discardDraft} storageWarning={s.storageWarning}>
      <div>
        <Label htmlFor="pe-name" className="font-semibold">Organisation name</Label>
        <Input id="pe-name" className="mt-1.5" value={v.name} onChange={(e) => s.setValue({ ...v, name: e.target.value })}
          autoComplete="organization" data-testid="input-org-name" data-tour-id="profile-identity-name" />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="pe-short" className="font-semibold">One-line description</Label>
          <CharCount value={v.shortDescription} min={20} max={120} />
        </div>
        <Input id="pe-short" className="mt-1.5" value={v.shortDescription} maxLength={140}
          placeholder="e.g. After-school maths clubs for girls in Kisumu's informal settlements"
          onChange={(e) => s.setValue({ ...v, shortDescription: e.target.value })}
          aria-describedby="pe-short-help" data-testid="input-short-description" data-tour-id="profile-identity-short-description" />
        <p id="pe-short-help" className="text-[11px] text-muted-foreground mt-1">Shown on your Discover card. Who you help and how, in one breath.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="pe-country" className="font-semibold">Country</Label>
          <Input id="pe-country" className="mt-1.5" value={v.country} onChange={(e) => s.setValue({ ...v, country: e.target.value })}
            autoComplete="country-name" data-testid="input-country" data-tour-id="profile-identity-country" />
        </div>
        <div>
          <Label htmlFor="pe-city" className="font-semibold">City or town <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="pe-city" className="mt-1.5" value={v.city} onChange={(e) => s.setValue({ ...v, city: e.target.value })}
            autoComplete="address-level2" data-testid="input-city" data-tour-id="profile-identity-city" />
        </div>
      </div>
      <div className="grid gap-5 pt-2 border-t border-border/60">
        <div className="space-y-2">
          <ImageUploadField id="pe-logo" label="Logo" shape="round" spec={LOGO_SPEC} token={ctx.token} currentUrl={logo.value}
            guidance="Required. Square, at least 400x400. We crop and shrink it on your phone before uploading."
            onUploaded={(url) => attach(logo, url)} tourId="profile-identity-logo" />
          <SaveIndicator section="identity-logo" manualSave status={logo.status} error={logo.error && `Logo uploaded but not attached yet. ${logo.error}`} onRetry={logo.commit} storageWarning={logo.storageWarning} />
        </div>
        <div className="space-y-2">
          <ImageUploadField id="pe-cover" label="Cover image" spec={COVER_SPEC} token={ctx.token} currentUrl={cover.value}
            guidance="Required. Wide, at least 1600x600. A real photo of your work lands better than a graphic."
            onUploaded={(url) => attach(cover, url)} tourId="profile-identity-cover" />
          <SaveIndicator section="identity-cover" manualSave status={cover.status} error={cover.error && `Cover uploaded but not attached yet. ${cover.error}`} onRetry={cover.commit} storageWarning={cover.storageWarning} />
        </div>
      </div>
    </SectionShell>
  );
}

// ── Story ────────────────────────────────────────────────────────────────────

interface StoryValue { description: string; mission: string }

export function StorySection(ctx: SectionCtx) {
  const { org } = ctx;
  const s = useSectionAutosave<StoryValue>({
    ...base(ctx, "story"),
    initial: { description: org.description ?? "", mission: org.mission ?? "" },
    validate: (v) => (HTML_RE.test(v.description) || HTML_RE.test(v.mission)
      ? "Your story contains HTML tags (often from copying a web page). Remove them and use plain text or Markdown like **bold** and - lists."
      : null),
    toPatch: (v) => ({ description: v.description.trim(), mission: t(v.mission) || null }),
  });
  const v = s.value;
  return (
    <SectionShell section="story" title="Your story" hint="The full picture for donors. Markdown works: blank lines for paragraphs, **bold**, - for lists, ## for headings. No HTML."
      orgId={ctx.orgId} status={s.status} error={s.error} onRetry={s.commit} onBlur={s.onSectionBlur}
      wasRecovered={s.wasRecovered} onDiscard={s.discardDraft} storageWarning={s.storageWarning}>
      <details className="rounded-xl bg-accent/10 border border-accent/30 px-3 py-2 text-xs group">
        <summary className="font-bold cursor-pointer text-foreground py-1">See a worked example</summary>
        <p className="mt-2 text-foreground/80 leading-relaxed">
          Try three sentences: who you serve, what you do, and what changes.
        </p>
        <blockquote className="mt-2 border-l-2 border-primary pl-3 italic text-foreground/80 leading-relaxed">
          We work with 140 teenage girls in Nyalenda, Kisumu, most of whom leave school before sixteen. Twice a week our volunteer tutors run maths and reading clubs in a borrowed church hall, with a hot meal at every session. Last year 31 of our girls sat their KCPE exams, up from 9 three years ago.
        </blockquote>
      </details>
      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="pe-story" className="font-semibold">Full story</Label>
          <CharCount value={v.description} min={200} />
        </div>
        <Textarea id="pe-story" rows={8} className="mt-1.5 leading-relaxed" value={v.description}
          onChange={(e) => s.setValue({ ...v, description: e.target.value })}
          data-testid="input-story" data-tour-id="profile-story-description" />
      </div>
      <div>
        <Label htmlFor="pe-mission" className="font-semibold">Mission <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea id="pe-mission" rows={2} className="mt-1.5" value={v.mission}
          onChange={(e) => s.setValue({ ...v, mission: e.target.value })}
          data-testid="input-mission" data-tour-id="profile-story-mission" />
      </div>
    </SectionShell>
  );
}

// ── Sectors ──────────────────────────────────────────────────────────────────

export function SectorsSection(ctx: SectionCtx) {
  const legacy = orgSectors(ctx.org);
  const known = SECTORS as readonly string[];
  const retired = legacy.filter((x) => !known.includes(x));
  const s = useSectionAutosave<string[]>({
    ...base(ctx, "sectors"),
    // Only valid list values are ever selected or sent; retired values are shown below.
    initial: legacy.filter((x) => known.includes(x)),
    validate: (v) => (v.length === 0 ? "Choose at least one sector so donors can find you." : null),
    toPatch: (v) => ({ categories: v, category: v[0] }),
  });
  function toggle(sector: string) {
    s.setValue((prev) => (prev.includes(sector) ? prev.filter((x) => x !== sector) : [...prev, sector]));
    void s.commit();
  }
  return (
    <SectionShell section="sectors" title="Sectors" hint="Pick every area you work in. The first one is shown as your main sector."
      orgId={ctx.orgId} status={s.status} error={s.error} onRetry={s.commit}
      wasRecovered={s.wasRecovered} onDiscard={s.discardDraft} storageWarning={s.storageWarning}>
      <div role="group" aria-label="Sectors" className="flex flex-wrap gap-2" data-tour-id="profile-sectors-list">
        {SECTORS.map((sector) => {
          const on = s.value.includes(sector);
          const primary = s.value[0] === sector;
          return (
            <button key={sector} type="button" aria-pressed={on} onClick={() => toggle(sector)}
              className={`min-h-[40px] px-3 py-2 rounded-full text-sm font-semibold border-2 transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
              data-testid={`toggle-sector-${sector}`}>
              {sector}{primary && <span className="ml-1.5 text-[10px] uppercase tracking-wider">Main</span>}
            </button>
          );
        })}
      </div>
      {retired.length > 0 && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" data-testid="text-retired-sectors">
          Your profile previously listed {retired.map((r) => `"${r}"`).join(", ")}, which is no longer in the sector list.
          It will be replaced by your choices above the next time this section saves. Pick the closest match.
        </p>
      )}
    </SectionShell>
  );
}

// ── Impact metrics ───────────────────────────────────────────────────────────

const METRICS: { key: ImpactMetricKey; title: string; example: string }[] = [
  { key: "peopleReached", title: "People reached", example: "Girls in our clubs this year" },
  { key: "groundCovered", title: "Ground covered", example: "Villages visited" },
  { key: "resourcesDelivered", title: "Resources delivered", example: "Meals served" },
];
type MetricDraft = Record<ImpactMetricKey, { label: string; value: string }>;

export function ImpactSection(ctx: SectionCtx) {
  const im = ctx.org.impactMetrics ?? {};
  const initial = Object.fromEntries(METRICS.map(({ key }) => [key, { label: im[key]?.label ?? "", value: im[key] ? String(im[key]!.value) : "" }])) as MetricDraft;
  const s = useSectionAutosave<MetricDraft>({
    ...base(ctx, "impact"),
    initial,
    validate: (v) => {
      for (const { key, title } of METRICS) {
        const { label, value } = v[key];
        if (!t(label) && !t(value)) continue;
        if (!t(label)) return `${title}: add a short label so donors know what the number means.`;
        const n = Number(value);
        if (!t(value) || !Number.isFinite(n) || n < 0) return `${title}: enter a number of zero or more.`;
      }
      return null;
    },
    toPatch: (v) => {
      const out: ImpactMetricsInput = {};
      for (const { key } of METRICS) {
        if (t(v[key].label) && t(v[key].value)) out[key] = { label: t(v[key].label), value: Number(v[key].value) };
      }
      return { impactMetrics: Object.keys(out).length ? out : null };
    },
  });
  return (
    <SectionShell section="impact" optional title="Impact metrics" hint="Up to three honest numbers. Leave any blank and it won't appear. Progress to goal comes from your active campaign."
      orgId={ctx.orgId} status={s.status} error={s.error} onRetry={s.commit} onBlur={s.onSectionBlur}
      wasRecovered={s.wasRecovered} onDiscard={s.discardDraft} storageWarning={s.storageWarning}>
      {METRICS.map(({ key, title, example }) => (
        <fieldset key={key} className="grid grid-cols-[1fr_110px] gap-2" data-tour-id={`profile-impact-${key}`}>
          <legend className="text-sm font-semibold mb-1.5 col-span-2">
            {title}
            {im[key]?.updatedAt && (
              <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                updated {new Date(im[key]!.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </legend>
          <Input aria-label={`${title} label`} placeholder={example} value={s.value[key].label}
            onChange={(e) => s.setValue((p) => ({ ...p, [key]: { ...p[key], label: e.target.value } }))} data-testid={`input-metric-label-${key}`} />
          <Input aria-label={`${title} number`} inputMode="decimal" type="number" min={0} placeholder="0" value={s.value[key].value}
            onChange={(e) => s.setValue((p) => ({ ...p, [key]: { ...p[key], value: e.target.value } }))} data-testid={`input-metric-value-${key}`} />
        </fieldset>
      ))}
    </SectionShell>
  );
}

// ── Funds usage ──────────────────────────────────────────────────────────────

const FUNDS: { key: keyof FundsUsage; label: string }[] = [
  { key: "operations", label: "Operations" },
  { key: "materials", label: "Materials & Supplies" },
  { key: "staff", label: "Staff & Volunteers" },
  { key: "events", label: "Community Events" },
  { key: "other", label: "Other" },
];
type FundsDraft = Record<keyof FundsUsage, string>;

export function FundsSection(ctx: SectionCtx) {
  const fu = ctx.org.fundsUsage;
  const s = useSectionAutosave<FundsDraft>({
    ...base(ctx, "funds"),
    initial: Object.fromEntries(FUNDS.map(({ key }) => [key, fu ? String(fu[key] ?? 0) : ""])) as FundsDraft,
    validate: (v) => {
      const nums = FUNDS.map(({ key }) => Number(v[key] || 0));
      if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 100)) return "Use whole numbers between 0 and 100.";
      const total = nums.reduce((a, b) => a + b, 0);
      if (total !== 0 && total !== 100) return `Percentages must add up to 100 (currently ${total}). Leave all blank to hide this section.`;
      return null;
    },
    toPatch: (v) => {
      const nums = Object.fromEntries(FUNDS.map(({ key }) => [key, Number(v[key] || 0)])) as unknown as FundsUsage;
      const total = FUNDS.reduce((a, { key }) => a + nums[key], 0);
      return { fundsUsage: total === 0 ? null : nums };
    },
  });
  const total = FUNDS.reduce((a, { key }) => a + (Number(s.value[key]) || 0), 0);
  return (
    <SectionShell section="funds" optional title="How funds are used" hint="Self-reported split across five categories. Must add to 100."
      orgId={ctx.orgId} status={s.status} error={s.error} onRetry={s.commit} onBlur={s.onSectionBlur}
      wasRecovered={s.wasRecovered} onDiscard={s.discardDraft} storageWarning={s.storageWarning}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-tour-id="profile-funds-inputs">
        {FUNDS.map(({ key, label }) => (
          <div key={key}>
            <Label htmlFor={`pe-funds-${key}`} className="text-xs font-semibold text-muted-foreground">{label}</Label>
            <div className="relative mt-1">
              <Input id={`pe-funds-${key}`} type="number" inputMode="numeric" min={0} max={100} className="pr-8" value={s.value[key]}
                onChange={(e) => s.setValue((p) => ({ ...p, [key]: e.target.value }))} data-testid={`input-funds-${key}`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden" aria-hidden>
        <div className={`h-full transition-transform origin-left ${total === 100 ? "bg-green-600" : "bg-amber-500"}`}
          style={{ transform: `scaleX(${Math.min(total, 100) / 100})` }} />
      </div>
      <p className={`text-xs font-bold ${total === 100 ? "text-green-700" : "text-amber-700"}`} data-testid="text-funds-total">
        Total {total}%{total === 0 ? " (hidden from donors)" : total < 100 ? `, ${100 - total}% to allocate` : total > 100 ? `, ${total - 100}% over` : ""}
      </p>
    </SectionShell>
  );
}

// ── Contact and links ────────────────────────────────────────────────────────

const SOCIALS = ["instagram", "facebook", "twitter", "linkedin", "youtube", "tiktok"] as const;
interface ContactValue { email: string; phone: string; website: string; social: Record<string, string> }

function cleanUrl(u: string) {
  const s = t(u);
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function ContactSection(ctx: SectionCtx) {
  const c = ctx.org.contact ?? {};
  const s = useSectionAutosave<ContactValue>({
    ...base(ctx, "contact"),
    initial: { email: c.email ?? "", phone: c.phone ?? "", website: c.website ?? "", social: { ...(ctx.org.socialLinks ?? {}) } },
    validate: (v) => {
      if (t(v.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t(v.email))) return "That email address doesn't look right.";
      const urls = [v.website, ...SOCIALS.map((k) => v.social[k] ?? "")].filter((x) => t(x));
      for (const u of urls) { try { new URL(cleanUrl(u)); } catch { return `"${u}" isn't a valid link.`; } }
      return null;
    },
    toPatch: (v) => {
      const contact: { email?: string; phone?: string; website?: string } = {};
      if (t(v.email)) contact.email = t(v.email);
      if (t(v.phone)) contact.phone = t(v.phone);
      if (t(v.website)) contact.website = cleanUrl(v.website);
      const socialLinks: Record<string, string> = {};
      // Only send supported platforms; legacy unknown keys are left for the server to preserve.
      for (const k of SOCIALS) if (t(v.social[k] ?? "")) socialLinks[k] = cleanUrl(v.social[k]!);
      return { contact: Object.keys(contact).length ? contact : null, socialLinks: Object.keys(socialLinks).length ? socialLinks : null };
    },
  });
  const v = s.value;
  const extraKeys = Object.keys(v.social).filter((k) => !(SOCIALS as readonly string[]).includes(k));
  return (
    <SectionShell section="contact" title="Contact and links" hint="How donors reach you. Leave anything blank to keep it off your profile."
      orgId={ctx.orgId} status={s.status} error={s.error} onRetry={s.commit} onBlur={s.onSectionBlur}
      wasRecovered={s.wasRecovered} onDiscard={s.discardDraft} storageWarning={s.storageWarning}>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="pe-email" className="font-semibold">Public email</Label>
          <Input id="pe-email" type="email" inputMode="email" className="mt-1.5" value={v.email} onChange={(e) => s.setValue({ ...v, email: e.target.value })} data-testid="input-contact-email" data-tour-id="profile-contact-email" />
        </div>
        <div>
          <Label htmlFor="pe-phone" className="font-semibold">Phone</Label>
          <Input id="pe-phone" type="tel" inputMode="tel" className="mt-1.5" value={v.phone} onChange={(e) => s.setValue({ ...v, phone: e.target.value })} data-testid="input-contact-phone" />
        </div>
      </div>
      <div>
        <Label htmlFor="pe-website" className="font-semibold">Website</Label>
        <Input id="pe-website" inputMode="url" className="mt-1.5" placeholder="yourorg.org" value={v.website} onChange={(e) => s.setValue({ ...v, website: e.target.value })} data-testid="input-contact-website" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border/60" data-tour-id="profile-contact-social">
        {SOCIALS.map((k) => (
          <div key={k}>
            <Label htmlFor={`pe-social-${k}`} className="text-xs font-semibold text-muted-foreground capitalize">{k === "twitter" ? "X (Twitter)" : k}</Label>
            <Input id={`pe-social-${k}`} inputMode="url" className="mt-1" value={v.social[k] ?? ""}
              onChange={(e) => s.setValue({ ...v, social: { ...v.social, [k]: e.target.value } })} data-testid={`input-social-${k}`} />
          </div>
        ))}
      </div>
      {extraKeys.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Also on your profile from earlier: {extraKeys.join(", ")}. These aren't editable here and are left as they are.
        </p>
      )}
    </SectionShell>
  );
}

// ── Team ─────────────────────────────────────────────────────────────────────

export function TeamSection(ctx: SectionCtx) {
  const s = useSectionAutosave<TeamMember[]>({
    ...base(ctx, "team"),
    initial: (ctx.org.team ?? []).map((m) => ({ name: m.name ?? "", role: m.role ?? "", photoUrl: m.photoUrl ?? null })),
    validate: (v) => {
      const rows = v.filter((m) => t(m.name) || t(m.role) || m.photoUrl);
      if (rows.length > 6) return "You can show up to six people.";
      for (let i = 0; i < rows.length; i++) {
        const m = rows[i]!;
        const missing = [!t(m.name) && "a name", !t(m.role) && "a role", !m.photoUrl && "a photo"].filter(Boolean);
        if (missing.length) return `Person ${i + 1} needs ${missing.join(", ")} before the team can be saved. Your edits are kept here.`;
      }
      return null;
    },
    toPatch: (v) => ({
      team: v.filter((m) => t(m.name) || t(m.role) || m.photoUrl).map((m) => ({ name: t(m.name), role: t(m.role), photoUrl: m.photoUrl })),
    }),
  });
  const v = s.value;
  function update(i: number, p: Partial<TeamMember>) {
    s.setValue((prev) => prev.map((m, j) => (j === i ? { ...m, ...p } : m)));
  }
  return (
    <SectionShell section="team" optional title="Team" hint="Up to six faces. Donors give to people they can picture."
      orgId={ctx.orgId} status={s.status} error={s.error} onRetry={s.commit} onBlur={s.onSectionBlur}
      wasRecovered={s.wasRecovered} onDiscard={s.discardDraft} storageWarning={s.storageWarning}>
      {v.length === 0 && (
        <p className="text-sm text-muted-foreground bg-secondary/50 rounded-xl px-3 py-4 text-center">
          No one added yet. This section stays hidden until you add someone.
        </p>
      )}
      <ol className="space-y-4">
        {v.map((m, i) => (
          <li key={i} className="rounded-xl border border-border p-3 space-y-3 bg-secondary/20" data-testid={`row-team-${i}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Person {i + 1}</span>
              <button type="button" aria-label={`Remove person ${i + 1}`}
                onClick={() => { s.setValue((prev) => prev.filter((_, j) => j !== i)); void s.commit(); }}
                className="p-2 -m-2 text-muted-foreground hover:text-destructive" data-testid={`button-remove-team-${i}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`pe-team-name-${i}`} className="text-xs font-semibold">Name</Label>
                <Input id={`pe-team-name-${i}`} className="mt-1" value={m.name} onChange={(e) => update(i, { name: e.target.value })} data-testid={`input-team-name-${i}`} />
              </div>
              <div>
                <Label htmlFor={`pe-team-role-${i}`} className="text-xs font-semibold">Role</Label>
                <Input id={`pe-team-role-${i}`} className="mt-1" placeholder="e.g. Founder, Head tutor" value={m.role} onChange={(e) => update(i, { role: e.target.value })} data-testid={`input-team-role-${i}`} />
              </div>
            </div>
            <ImageUploadField id={`pe-team-photo-${i}`} label="Photo" shape="round" spec={TEAM_SPEC} token={ctx.token} currentUrl={m.photoUrl}
              guidance="Required for each person. Square, at least 200x200."
              onUploaded={async (url) => { update(i, { photoUrl: url }); await s.commit(); }} />
          </li>
        ))}
      </ol>
      {v.length < 6 && (
        <Button type="button" variant="outline" className="w-full h-11 font-semibold border-dashed"
          onClick={() => s.setValue((prev) => [...prev, { name: "", role: "", photoUrl: null }])}
          data-testid="button-add-team" data-tour-id="profile-team-add">
          <Plus className="w-4 h-4 mr-1.5" /> Add a person ({v.length}/6)
        </Button>
      )}
    </SectionShell>
  );
}
