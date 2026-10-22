import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour.css";
import * as api from "@/lib/api";
import type { Campaign, Org, WalkthroughProgress, WalkthroughState } from "@/lib/api";
import { gate, skipGate, worstSaveState, type Gate } from "@/lib/tour/gate";
import { checklist, stepsFor, type TourCtx, type TourId, type TourStep } from "@/lib/tour/steps";

const QUEUE_KEY = (orgId: string) => `rpx_walkthrough_queue_${orgId}`;

function readQueue(orgId: string): Partial<WalkthroughProgress> | null {
  try { const v = localStorage.getItem(QUEUE_KEY(orgId)); return v ? JSON.parse(v) : null; } catch { return null; }
}
/** Returns false when this device can't keep a backup copy. */
function writeQueue(orgId: string, v: Partial<WalkthroughProgress> | null): boolean {
  try { if (v) localStorage.setItem(QUEUE_KEY(orgId), JSON.stringify(v)); else localStorage.removeItem(QUEUE_KEY(orgId)); return true; } catch { return false; }
}

export function isUntouched(w: WalkthroughProgress | undefined) {
  return !!w && w.profileStep == null && w.campaignStep == null && !w.profileDone && !w.campaignDone && !w.exitedAt;
}

export interface Active { tour: TourId; step: number }

export function useWalkthroughQuery(orgId: string, token: string | null, fast: boolean) {
  return useQuery({
    queryKey: ["walkthrough", orgId],
    queryFn: () => api.getWalkthrough(orgId, token!),
    enabled: !!orgId && !!token,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchInterval: fast ? 4000 : false,
    retry: 1,
  });
}

function pickCampaign(campaigns: Campaign[], selectedId: string | null | undefined): Campaign | undefined {
  const live = campaigns.filter((c) => c.status !== "completed");
  return live.find((c) => c._id === selectedId) ?? live.find((c) => !c.enabled) ?? live[0];
}

export function useWalkthrough({ orgId, token, org, campaigns, explicitTab }: {
  orgId: string; token: string | null; org: Org | undefined; campaigns: Campaign[] | undefined; explicitTab: boolean;
}) {
  const qc = useQueryClient();
  const [location, setLocation] = useLocation();
  const [active, setActive] = useState<Active | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const step: TourStep | undefined = active ? stepsFor(active.tour)[active.step - 1] : undefined;
  const needsServer = !!step && /p-payout|p-preview|c-preview/.test(step.id);
  const wtQ = useWalkthroughQuery(orgId, token, needsServer);
  const wt = wtQ.data;

  // In-memory pending patch is authoritative; localStorage is only a recovery copy.
  const pendingRef = useRef<Partial<WalkthroughProgress> | null>(null);
  const [pendingView, setPendingView] = useState<Partial<WalkthroughProgress>>({});
  const loadedQueue = useRef(false);
  if (!loadedQueue.current && orgId) {
    loadedQueue.current = true;
    const q = readQueue(orgId);
    if (q) pendingRef.current = q;
  }
  const progress: WalkthroughProgress | undefined = wt ? { ...wt.walkthrough, ...(pendingRef.current ?? {}), ...pendingView } : undefined;

  const campaign = pickCampaign(campaigns ?? [], progress?.selectedCampaignId);
  const ctx: TourCtx = useMemo(() => ({ org, campaigns: campaigns ?? [], campaign, wt }), [org, campaigns, campaign, wt]);

  // ── Persistence: one request in flight, coalesce the latest, ack by snapshot ──
  const inflight = useRef(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const flush = useCallback(async (): Promise<void> => {
    const tk = tokenRef.current;
    if (!tk || inflight.current || !pendingRef.current) return;
    const snapshot = pendingRef.current;
    inflight.current = true;
    let ok = false;
    try {
      const res = await api.patchWalkthrough(orgId, snapshot, tk);
      ok = true;
      // Only clear what was acknowledged; newer checkpoints stay pending.
      const rest: Partial<WalkthroughProgress> = { ...(pendingRef.current ?? {}) };
      (Object.keys(snapshot) as (keyof WalkthroughProgress)[]).forEach((k) => {
        if (rest[k] === snapshot[k]) delete rest[k];
      });
      pendingRef.current = Object.keys(rest).length ? rest : null;
      const stored = writeQueue(orgId, pendingRef.current);
      setPendingView({ ...(pendingRef.current ?? {}) });
      setSyncError(stored ? null : "This device can't keep a backup of your tour position, but our server has it.");
      qc.setQueryData<WalkthroughState>(["walkthrough", orgId], (old) => (old ? { ...old, walkthrough: res.walkthrough } : old));
    } catch (e) {
      const stored = !!readQueue(orgId);
      setSyncError(stored
        ? `Your place in the tour is saved on this device but not on our server yet (${e instanceof Error ? e.message : "network error"}). Retrying.`
        : `Your place in the tour isn't saved yet — not on our server, and this device can't store a backup. Keep this tab open while we retry.`);
    } finally {
      inflight.current = false;
    }
    if (ok && pendingRef.current) void flush();
  }, [orgId, qc]);

  const persist = useCallback((patch: Partial<WalkthroughProgress>) => {
    pendingRef.current = { ...(pendingRef.current ?? {}), ...patch };
    const stored = writeQueue(orgId, pendingRef.current);
    if (!stored) setSyncError("This device can't keep a backup of your tour position. We're saving it to our server.");
    setPendingView({ ...pendingRef.current });
    void flush();
  }, [orgId, flush]);

  useEffect(() => {
    void flush();
    const on = () => void flush();
    window.addEventListener("online", on);
    const t = window.setInterval(on, 15000);
    return () => { window.removeEventListener("online", on); window.clearInterval(t); };
  }, [flush]);

  // ── Start / resume / replay / exit ──────────────────────────────────────
  const goTo = useCallback((tour: TourId, n: number) => {
    setActive({ tour, step: n });
    persist(tour === "profile" ? { profileStep: n, exitedAt: null } : { campaignStep: n, exitedAt: null });
  }, [persist]);

  const resume = useCallback(() => {
    if (!progress) return;
    if (!progress.profileDone) goTo("profile", progress.profileStep ?? 1);
    else goTo("campaign", progress.campaignStep ?? 1);
  }, [progress, goTo]);

  const replay = useCallback((tour: TourId) => {
    // Replay restarts the pointer only; real data is untouched.
    persist(tour === "profile" ? { profileDone: false } : { campaignDone: false });
    goTo(tour, 1);
  }, [goTo, persist]);

  const finishLater = useCallback(() => {
    setActive(null);
    persist({ exitedAt: new Date().toISOString() });
    // Land on the checklist (below the tabs) so they can see what's left.
    window.setTimeout(() => {
      document.getElementById("setup-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, [persist]);

  const next = useCallback(() => {
    if (!active) return;
    const total = stepsFor(active.tour).length;
    if (active.step < total) { goTo(active.tour, active.step + 1); return; }
    if (active.tour === "profile") {
      persist({ profileDone: true, campaignDone: false });
      goTo("campaign", 1);
    } else {
      persist({ campaignDone: true, campaignStep: null });
      setActive(null);
    }
  }, [active, goTo, persist]);

  // First approved login: only when walkthrough was never touched and nothing is done yet.
  const items = checklist(ctx);
  const allDone = items.every((i) => i.done);
  useEffect(() => {
    if (autoStarted.current || !wt || !org || !campaigns) return;
    autoStarted.current = true;
    const tab = new URLSearchParams(window.location.search).get("tab");
    const w = { ...wt.walkthrough, ...(pendingRef.current ?? {}) };
    if (isUntouched(w)) {
      if (!allDone && (!explicitTab || tab === "build")) goTo("profile", 1);
      return;
    }
    // Reopened mid-tour (not "Finish later"): pick up where they were.
    if (w.exitedAt) return;
    if (!w.profileDone && w.profileStep != null) goTo("profile", w.profileStep);
    else if (w.profileDone && !w.campaignDone && w.campaignStep != null) goTo("campaign", w.campaignStep);
  }, [wt, org, campaigns, allDone, goTo, explicitTab]);

  // Remember which campaign the tour is building, once one exists.
  useEffect(() => {
    if (active?.tour === "campaign" && campaign && progress?.selectedCampaignId !== campaign._id) {
      persist({ selectedCampaignId: campaign._id });
    }
  }, [active?.tour, campaign, progress?.selectedCampaignId, persist]);

  // ── Navigation to the real anchor ───────────────────────────────────────
  useEffect(() => {
    if (!step) return;
    const p = step.place;
    const url = new URL(window.location.href);
    const wantTab = p.tab;
    const wantCampaign = p.inWizard && campaign ? campaign._id : null;
    const curTab = url.searchParams.get("tab");
    const curCampaign = url.searchParams.get("campaign");
    const needNav = curTab !== wantTab || (p.tab === "campaigns" && (wantCampaign ?? null) !== (curCampaign ?? null) && (p.inWizard || step.id === "c-create"));
    if (needNav) {
      setLocation(`/dashboard?tab=${wantTab}${wantCampaign ? `&campaign=${encodeURIComponent(wantCampaign)}` : ""}`);
    }
  }, [step, campaign, setLocation, location]);

  // ── Driver.js spotlight ─────────────────────────────────────────────────
  const drvRef = useRef<Driver | null>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const handlers = useRef({ next, finishLater, skip: next });
  handlers.current = { next, finishLater, skip: next };

  useEffect(() => {
    if (!step || !active) { drvRef.current?.destroy(); drvRef.current = null; return; }
    let cancelled = false;
    let statusEl: HTMLParagraphElement | null = null;
    let primaryBtn: HTMLButtonElement | null = null;
    let shownFor: Element | null | undefined;
    let suspended = false;
    const check = step.completionCheck;
    const wasDoneOnArrival = check ? check(ctxRef.current) : false;
    const total = stepsFor(active.tour).length;
    let helping = false;
    let backBtn: HTMLButtonElement | null = null;

    /** Latest gate: saved-data check + editor save state + visible error, read now. */
    const readGate = (skipping = false): Gate => {
      const el = step.anchor ? document.querySelector(`[data-tour-id="${step.anchor}"]`) : null;
      const scope = el ? (el.closest("section") ?? el.parentElement ?? el) : null;
      const wizard = step.place.inWizard ? el?.closest('[data-tour-id="campaign-wizard"]') : null;
      const saveAlert = wizard?.querySelector('[data-testid="status-campaign-save"][data-save-state="error"] [role="alert"]');
      const alert = saveAlert?.textContent?.trim() || scope?.querySelector('[role="alert"]')?.textContent?.trim() || null;
      const states: (string | null)[] = [];
      scope?.querySelectorAll("[data-save-state]").forEach((n) => states.push(n.getAttribute("data-save-state")));
      if (step.place.inWizard) {
        document.querySelectorAll('[data-tour-id="campaign-wizard"] [data-testid="status-campaign-save"][data-save-state]')
          .forEach((n) => states.push(n.getAttribute("data-save-state")));
      }
      const input = { checkPassed: check ? check(ctxRef.current) : null, alert, saveState: worstSaveState(states) };
      return skipping ? skipGate({ ...input, skippable: step.skippable }) : gate(input);
    };
    const tryNext = () => {
      const g = readGate();
      if (!g.ok && (check || g.reason !== "not-done")) { if (statusEl) statusEl.textContent = g.message; return; }
      handlers.current.next();
    };
    const endHelp = () => {
      helping = false;
      backBtn?.remove(); backBtn = null;
      suspended = true; // forces a re-render on the next poll
    };

    const drv = driver({
      allowClose: false,
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 12,
      smoothScroll: true,
      popoverClass: "rpx-tour",
      overlayClickBehavior: () => { /* never close on overlay tap */ },
    } as Parameters<typeof driver>[0]);
    drvRef.current?.destroy();
    drvRef.current = drv;

    const render = (el: Element | null) => {
      shownFor = el;
      drv.highlight({
        element: el ?? undefined,
        popover: {
          title: step.title,
          description: step.body,
          side: "bottom",
          align: "start",
          showButtons: [],
          onPopoverRender: (pop) => {
            const progressEl = document.createElement("p");
            progressEl.className = "rpx-tour-progress";
            progressEl.textContent = `${active.tour === "profile" ? "Your profile" : "Your first campaign"} · ${active.step} of ${total}`;
            pop.title.before(progressEl);
            statusEl = document.createElement("p");
            statusEl.className = "rpx-tour-status";
            statusEl.setAttribute("role", "status");
            pop.description.after(statusEl);
            // Driver hides the footer when no built-in buttons are requested; force ours visible.
            pop.footer.style.display = "flex";
            pop.progress.style.display = "none";
            pop.closeButton.style.display = "none";
            const foot = pop.footerButtons;
            foot.innerHTML = "";
            const later = document.createElement("button");
            later.type = "button"; later.className = "rpx-tour-btn rpx-tour-later"; later.textContent = "Finish later";
            later.setAttribute("data-testid", "button-tour-finish-later");
            later.onclick = () => handlers.current.finishLater();
            foot.appendChild(later);
            if (step.skippable) {
              const skip = document.createElement("button");
              skip.type = "button"; skip.className = "rpx-tour-btn"; skip.textContent = "Skip";
              skip.setAttribute("data-testid", "button-tour-skip");
              skip.onclick = () => {
                const g = readGate(true);
                if (!g.ok) { if (statusEl) statusEl.textContent = g.message; return; }
                handlers.current.skip();
              };
              foot.appendChild(skip);
            }
            if (!check || wasDoneOnArrival) {
              primaryBtn = document.createElement("button");
              primaryBtn.type = "button"; primaryBtn.className = "rpx-tour-btn rpx-tour-primary";
              primaryBtn.textContent = !check ? (step.actionLabel ?? "Continue") : "Continue";
              primaryBtn.setAttribute("data-testid", "button-tour-primary");
              primaryBtn.onclick = tryNext;
              foot.appendChild(primaryBtn);
              if (wasDoneOnArrival && statusEl) statusEl.textContent = "Already done and saved.";
            } else if (statusEl) {
              statusEl.textContent = "Waiting for this to save…";
            }
            const help = step.helper?.(ctxRef.current);
            if (help) {
              const hb = document.createElement("button");
              hb.type = "button"; hb.className = "rpx-tour-btn rpx-tour-help"; hb.textContent = help.label;
              hb.setAttribute("data-testid", "button-tour-helper");
              hb.onclick = () => {
                // Step aside so the other section is fully usable; no spotlight trap.
                helping = true;
                drv.destroy();
                document.getElementById(help.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
                backBtn = document.createElement("button");
                backBtn.type = "button"; backBtn.className = "rpx-tour-btn rpx-tour-primary rpx-tour-back";
                backBtn.textContent = "Back to the tour";
                backBtn.setAttribute("data-testid", "button-tour-back");
                backBtn.onclick = endHelp;
                document.body.appendChild(backBtn);
              };
              pop.description.after(hb);
            }
            pop.wrapper.setAttribute("data-testid", `popover-tour-${step.id}`);
          },
        },
      });
    };

    const started = Date.now();
    let advanceTimer = 0;
    const poll = () => {
      if (cancelled) return;
      if (helping) {
        const h = step.helper?.(ctxRef.current);
        if (!h) endHelp(); // the side-trip field is saved: return to the step
        return;
      }
      // Hide while a dialog (e.g. image crop) is open, so it's usable; return after.
      const dialogOpen = !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
      if (dialogOpen) {
        if (!suspended) { suspended = true; drv.destroy(); }
        return;
      }
      const el = step.anchor ? document.querySelector(`[data-tour-id="${step.anchor}"]`) : null;
      if (step.anchor && !el) {
        if (step.place.wizardStep && ctxRef.current.campaign) {
          window.dispatchEvent(new CustomEvent("rpx-tour-wizard-step", { detail: { campaignId: ctxRef.current.campaign._id, step: step.place.wizardStep } }));
        }
        if (Date.now() - started > 6000 && shownFor !== null) {
          render(null);
          if (statusEl) statusEl.textContent = "We can't find this on screen yet. It may still be loading — or tap Finish later and use the checklist.";
        }
        return;
      }
      const scope = el ? (el.closest("section") ?? el.parentElement ?? el) : null;
      const msg = scope?.querySelector('[role="alert"]')?.textContent?.trim();
      const wizard = step.place.inWizard ? el?.closest('[data-tour-id="campaign-wizard"]') : null;
      const wizardSaveFailed = wizard?.querySelector('[data-testid="status-campaign-save"][data-save-state="error"]');
      // A field-only spotlight blocks its section's recovery controls. On error,
      // expose the whole section so Retry remains usable by touch and pointer.
      // Campaign Retry lives in the wizard header, outside the field section.
      // Expose both the field and its recovery controls rather than blocking Retry.
      const target = wizardSaveFailed && wizard ? wizard : msg && scope ? scope : el;
      if (suspended || shownFor !== target) { suspended = false; render(target); }
      const g = readGate();
      if (el && statusEl && check && !advanceTimer) {
        if (!g.ok) { if (g.reason !== "not-done" || !wasDoneOnArrival) statusEl.textContent = g.message; }
        else if (wasDoneOnArrival) statusEl.textContent = "Already done and saved.";
      }
      // Auto-advance only when the saved data flips to done AND the editor is clean.
      if (check && !wasDoneOnArrival && !advanceTimer && g.ok) {
        if (statusEl) statusEl.textContent = "Saved. Moving on…";
        advanceTimer = window.setTimeout(() => {
          advanceTimer = 0;
          if (cancelled) return;
          const again = readGate(); // re-check at fire time: a new edit or error cancels
          if (again.ok) handlers.current.next();
          else if (statusEl) statusEl.textContent = again.message;
        }, 900);
      }
    };
    const iv = window.setInterval(poll, 400);
    poll();
    return () => { cancelled = true; window.clearInterval(iv); window.clearTimeout(advanceTimer); backBtn?.remove(); drv.destroy(); };
  }, [step, active]);

  useEffect(() => () => { drvRef.current?.destroy(); }, []);

  return {
    wt, wtQ, progress, active, step, items, allDone, syncError,
    resume, replay, finishLater, campaign,
    started: !!progress && !isUntouched(progress),
    unfinished: !!progress && !isUntouched(progress) && (!progress.profileDone || !progress.campaignDone),
  };
}
