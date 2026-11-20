import { userErrorMessage } from "@/lib/error-feedback";
import { canUseDrumExperience } from "@/lib/drum-experience";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Circle, Loader2, RotateCcw, Copy, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import { ApiError, type Campaign, type CampaignEditorStep, type CampaignGate, type Org } from "@/lib/api";
import { useCampaignDraft, type DraftSaveStatus } from "./use-campaign-draft";
import { computeGates, validateDraft, type CampaignDraft } from "./model";
import { useAssistEnabled } from "./fields";
import { StepBasics, StepLook, StepMoney, StepStory } from "./steps";
import { PublishStep } from "./publish-step";

const STEPS: Array<{ n: CampaignEditorStep; title: string; short: string }> = [
  { n: 1, title: "What are you raising for?", short: "Ask" },
  { n: 2, title: "The money", short: "Money" },
  { n: 3, title: "Your story", short: "Story" },
  { n: 4, title: "How it looks", short: "Look" },
  { n: 5, title: "Preview and publish", short: "Publish" },
];

function SaveBadge({ status, error, onRetry }: { status: DraftSaveStatus; error: string | null; onRetry: () => void }) {
  return (
    <div className="text-xs font-medium min-h-[20px]" aria-live="polite" data-testid="status-campaign-save" data-save-state={status}>
      {status === "saving" && <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving draft</span>}
      {status === "saved" && <span className="inline-flex items-center gap-1.5 text-green-700"><Check className="w-3.5 h-3.5" /> Draft saved</span>}
      {status === "dirty" && <span className="inline-flex items-center gap-1.5 text-amber-700"><Circle className="w-2.5 h-2.5 fill-current" /> Kept on this device, saving soon</span>}
      {status === "error" && (
        <span className="inline-flex flex-wrap items-center gap-1.5 text-destructive" role="alert">
          <AlertCircle className="w-3.5 h-3.5" /> {error ?? "Not saved."}
          {!error?.startsWith("The one-line") && (
            <button type="button" onClick={onRetry} className="font-bold underline underline-offset-2 inline-flex items-center gap-1" data-testid="button-retry-campaign-save">
              <RotateCcw className="w-3 h-3" /> Retry
            </button>
          )}
        </span>
      )}
    </div>
  );
}

export function CampaignWizard({ campaign, org, orgId, userId, token, onClose }: {
  campaign: Campaign; org: Org; orgId: string; userId: string; token: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [current, setCurrent] = useState<Campaign>(campaign);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [serverGates, setServerGates] = useState<CampaignGate[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const assistEnabled = useAssistEnabled(token);

  const onSaved = useCallback((c: Campaign) => {
    setCurrent(c);
    setServerGates(null);
    qc.setQueryData<Campaign[]>(["campaigns", orgId], (old) => old?.map((x) => (x._id === c._id ? c : x)));
  }, [qc, orgId]);

  const draft = useCampaignDraft({ campaign, orgId, userId, token, onSaved });
  const { value: d, setValue, step, setStep } = draft;
  useEffect(() => {
    if (!canUseDrumExperience(orgId, campaign._id) && d.drumExperience.enabled) {
      setValue(previous => ({ ...previous, drumExperience: { ...previous.drumExperience, enabled: false } }));
    }
  }, [orgId, campaign._id, d.drumExperience.enabled, setValue]);
  const update = useCallback((patch: Partial<CampaignDraft> | ((previous: CampaignDraft) => Partial<CampaignDraft>)) =>
    setValue((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) })), [setValue]);
  const gates = useMemo(() => computeGates(d, org), [d, org]);
  const saveBlocked = validateDraft(d);

  const go = (s: number) => {
    const n = Math.min(5, Math.max(1, s)) as CampaignEditorStep;
    setStep(n);
    setPublishError(null);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // The guided tour asks the wizard to open a step so its anchor can mount.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const onTour = (e: Event) => {
      const n = (e as CustomEvent<{ campaignId: string; step: number }>).detail;
      if (n && n.campaignId === campaign._id && n.step !== step) goRef.current(n.step);
    };
    window.addEventListener("rpx-tour-wizard-step", onTour);
    return () => window.removeEventListener("rpx-tour-wizard-step", onTour);
  }, [campaign._id, step]);

  async function publish() {
    setPublishing(true);
    setPublishError(null);
    setNotice(null);
    try {
      const ok = await draft.flush();
      if (!ok) { setPublishError("Your latest edits are not saved yet, so nothing was published. Fix the message above and try again."); return; }
      const res = await api.setCampaignPublished(orgId, campaign._id, true, token);
      applyCanonical({ ...res, hasUnpublishedChanges: res.hasUnpublishedChanges ?? false });
      setServerGates(null);
      setNotice("Published. Your page is live.");
      await qc.invalidateQueries({ queryKey: ["campaigns", orgId] });
    } catch (e) {
      const gatesFromServer = e instanceof ApiError ? (e.body as { unmetGates?: CampaignGate[] } | null)?.unmetGates : undefined;
      if (gatesFromServer?.length) {
        setServerGates(gatesFromServer);
        setPublishError("Not published yet. These still need doing:");
        void qc.invalidateQueries({ queryKey: ["org", orgId] });
      } else {
        setPublishError(userErrorMessage(e, "confirm campaign publication"));
      }
    } finally {
      setPublishing(false);
    }
  }

  async function unpublish() {
    if (!confirm("Take this page offline? You can publish it again at any time.")) return;
    setPublishing(true);
    try {
      const res = await api.setCampaignPublished(orgId, campaign._id, false, token);
      applyCanonical(res);
      setNotice("Unpublished. The page is offline; your draft is kept.");
      await qc.invalidateQueries({ queryKey: ["campaigns", orgId] });
    } catch (e) {
      setPublishError(userErrorMessage(e, "confirm this campaign is unpublished"));
    } finally {
      setPublishing(false);
    }
  }

  async function copyLink() {
    const path = current.sharePath || (current.publicId ? `/campaigns/${current.publicId}` : "");
    if (!path) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); setNotice("Share link copied."); }
    catch { setNotice(`Copy this link: ${window.location.origin}${path}`); }
  }

  async function close() {
    setClosing(true);
    setCloseError(null);
    const ok = await draft.flush();
    setClosing(false);
    if (ok) { onClose(); return; }
    setCloseError(draft.error ?? "Your latest edits did not reach the server.");
  }

  function applyCanonical(res: Campaign) {
    setCurrent(res);
    qc.setQueryData<Campaign[]>(["campaigns", orgId], (old) => old?.map((x) => (x._id === res._id ? res : x)));
  }

  // Server locks currency after the first donation; mirror that here.
  const currencyLocked = !!current.currencyLockedAt || (current.amountRaised ?? 0) > 0 || (current.supporterCount ?? 0) > 0;
  const stepProps = { d, update, token, orgId, campaignId: campaign._id, assistEnabled, beforeAssist: draft.flush, currencyLocked };

  // Preview as donor: save the latest draft first; never navigate on a save error.
  const [, navigate] = useLocation();
  const [previewState, setPreviewState] = useState<"idle" | "saving" | "failed">("idle");
  async function openPreview() {
    setPreviewState("saving");
    const ok = await draft.flush().catch(() => false);
    if (!ok) { setPreviewState("failed"); return; }
    setPreviewState("idle");
    navigate(`/campaign/preview/${orgId}/${campaign._id}`);
  }
  const meta = STEPS[step - 1];

  return (
    <div ref={topRef} className="ops-wizard space-y-5 scroll-mt-24 min-w-0" data-tour-id="campaign-wizard">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <button type="button" onClick={close} disabled={closing} className="ops-btn ops-btn--sm" data-testid="button-close-wizard" data-tour-id="campaign-wizard-close">
          <ArrowLeft className="w-4 h-4" /> All campaigns
        </button>
        <button type="button" onClick={openPreview} disabled={previewState === "saving"}
          className="ops-btn ops-btn--sm disabled:opacity-60" data-testid="link-preview-as-donor" data-tour-id="campaign-preview-open">
          <Eye className="w-3.5 h-3.5" /> {previewState === "saving" ? "Saving…" : "Preview as donor"}
        </button>
        <SaveBadge status={draft.status} error={draft.error} onRetry={() => void draft.commit()} />
      </div>

      {closeError && (
        <div role="alert" className="text-xs bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 space-y-2" data-testid="banner-close-unsaved">
          <p>Not saved yet: {closeError} A copy is kept on this device, but it has not reached the server.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="h-7" onClick={close} disabled={closing} data-testid="button-close-retry">Retry save</Button>
            <Button size="sm" variant="outline" className="h-7" onClick={() => setCloseError(null)} data-testid="button-close-stay">Stay and fix</Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={onClose} data-testid="button-close-keep-local">Leave, keep copy on this device</Button>
          </div>
        </div>
      )}

      {draft.recovered && (
        <div className="flex flex-wrap items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2" role="status" data-testid="banner-draft-recovered">
          <span className="flex-1 min-w-0">We brought back edits from this device that had not reached the server.</span>
          <button type="button" className="font-bold underline disabled:opacity-50 disabled:no-underline" disabled={draft.status === "saving"} onClick={draft.discardRecovered} data-testid="button-discard-recovered">Discard them</button>
        </div>
      )}
      {draft.storageWarning && <p role="alert" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{draft.storageWarning}</p>}

      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Campaign editor · saved as you go</p>
        <h2 className="ops-display uppercase text-[34px] sm:text-[44px] leading-[.92] mt-1 break-words" data-testid="text-wizard-campaign-name">{d.name?.trim() || current.name || "Untitled campaign"}</h2>
      </div>

      <nav aria-label="Campaign steps" data-tour-id="campaign-stepper">
        <ol className="ops-stepper">
          {STEPS.map((s) => {
            const active = s.n === step;
            const done = s.n < step;
            return (
              <li key={s.n} className="min-w-0">
                <button type="button" onClick={() => go(s.n)} aria-current={active ? "step" : undefined} data-done={done}
                  aria-label={`Step ${s.n}: ${s.short}`} data-testid={`button-step-${s.n}`} data-tour-id={`campaign-step-${s.n}`}>
                  <span className="ops-stepnum tabular-nums">{s.n}</span><span className="hidden sm:inline truncate">{s.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Step {step} of 5</p>
        <h3 className="ops-display uppercase text-2xl sm:text-[28px] leading-none text-foreground mt-1" data-testid="text-step-title">{meta.title}</h3>
      </div>

      {notice && (
        <div className="flex flex-wrap items-center gap-2 text-sm bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2" role="status" data-testid="text-wizard-notice">
          <span className="flex-1 min-w-0 break-words">{notice}</span>
          {current.enabled && (current.sharePath || current.publicId) && (
            <Button size="sm" variant="outline" className="h-7" onClick={copyLink} data-testid="button-copy-share-link"><Copy className="w-3.5 h-3.5 mr-1" /> Copy link</Button>
          )}
        </div>
      )}

      <div className="animate-in fade-in slide-in-from-bottom-1 duration-300" key={step}>
        {step === 1 && <StepBasics {...stepProps} />}
        {step === 2 && <StepMoney {...stepProps} />}
        {step === 3 && <StepStory {...stepProps} />}
        {step === 4 && <StepLook {...stepProps} />}
        {step === 5 && (
          <PublishStep d={d} campaign={current} org={org} gates={gates} serverGates={serverGates}
            publishing={publishing} publishError={publishError} onPublish={publish} onUnpublish={unpublish}
            goToStep={go} saveBlocked={saveBlocked} />
        )}
      </div>

      <div className="flex flex-col items-start gap-1" data-testid={`block-step-preview-${step}`}>
        <button type="button" onClick={openPreview} disabled={previewState === "saving"}
          className="ops-btn ops-btn--sm disabled:opacity-60"
          data-testid={`button-preview-step-${step}`}>
          <Eye className="w-4 h-4" /> {previewState === "saving" ? "Saving your draft…" : "Preview this as a donor"}
        </button>
        {previewState === "failed" && (
          <p role="alert" className="text-xs text-destructive" data-testid="error-preview-unsaved">
            Your latest edits didn't save, so we didn't open the preview. Nothing was lost — fix the message above or retry saving, then preview again.
          </p>
        )}
      </div>

      <div className="ops-wizard-foot flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => go(step - 1)} disabled={step === 1} data-testid="button-step-back" data-tour-id="campaign-step-back">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {step < 5 && (
          <Button onClick={() => go(step + 1)} className="font-bold bg-[#17100F] text-[#F4EFE6] hover:bg-[#17100F]/90" data-testid="button-step-next" data-tour-id="campaign-step-next">
            Save and continue <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
