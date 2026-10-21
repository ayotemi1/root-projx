import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";
import type { Campaign, CampaignEditorStep } from "@/lib/api";
import { draftFromCampaign, draftToPatch, validateDraft, type CampaignDraft } from "./model";

export type DraftSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface Envelope { v: 1; value: CampaignDraft; step: CampaignEditorStep; savedAt: number }

export function campaignDraftKey(userId: string, orgId: string, campId: string) {
  return `rpx:campaign-draft:${userId}:${orgId}:${campId}`;
}

function readLocal(key: string): Envelope | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope;
    return env?.v === 1 && env.value ? env : null;
  } catch { return null; }
}
function writeLocal(key: string, value: CampaignDraft, step: CampaignEditorStep): boolean {
  try {
    localStorage.setItem(key, JSON.stringify({ v: 1, value, step, savedAt: Date.now() } satisfies Envelope));
    return true;
  } catch { return false; }
}
function clearLocalIfMatches(key: string, serialized: string) {
  try {
    const env = readLocal(key);
    if (env && JSON.stringify({ value: env.value, step: env.step }) === serialized) localStorage.removeItem(key);
  } catch { /* ignore */ }
}

function friendly(err: unknown) {
  const raw = err instanceof Error ? err.message : "";
  if (/failed to fetch|load failed|networkerror/i.test(raw))
    return "No connection. Your edits are kept on this device. Retry when you are back online.";
  return raw ? `Not saved: ${raw}` : "Not saved. Your edits are kept on this device.";
}

const AUTOSAVE_MS = 1500;

/**
 * Wizard draft state with:
 * - account + org + campaign scoped local recovery (written on every edit, including uploaded URLs)
 * - serialised server saves (one in flight; later edits coalesce into a follow-up)
 * - debounced autosave, plus explicit commit on step change
 * - flush(): resolves true only when the latest snapshot is persisted and valid
 */
export function useCampaignDraft(opts: {
  campaign: Campaign; orgId: string; userId: string; token: string;
  onSaved: (c: Campaign) => void;
}) {
  const { campaign } = opts;
  const key = campaignDraftKey(opts.userId, opts.orgId, campaign._id);
  const serverDraft = draftFromCampaign(campaign);
  const serverStep = (campaign.editorStep ?? 1) as CampaignEditorStep;
  const serverSerialized = JSON.stringify({ value: serverDraft, step: serverStep });

  const [init] = useState(() => {
    const env = readLocal(key);
    if (env && JSON.stringify({ value: env.value, step: env.step }) !== serverSerialized) {
      return { value: { ...serverDraft, ...migrateLegacyDraft(env.value) }, step: env.step, recovered: true };
    }
    return { value: serverDraft, step: serverStep, recovered: false };
  });

  const [value, setValueState] = useState<CampaignDraft>(init.value);
  const [step, setStepState] = useState<CampaignEditorStep>(init.step);
  const [status, setStatus] = useState<DraftSaveStatus>(init.recovered ? "dirty" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(init.recovered);
  const [storageFailed, setStorageFailed] = useState(false);

  const valueRef = useRef(init.value);
  const stepRef = useRef(init.step);
  const lastSavedRef = useRef(serverSerialized);
  const themeRef = useRef(campaign.theme);
  const chainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const inFlightRef = useRef(false);
  /** Server form of our own last save; echoes of it must never overwrite the editor. */
  const ackServerRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const snapshot = () => JSON.stringify({ value: valueRef.current, step: stepRef.current });

  const doSave = useCallback(async (): Promise<boolean> => {
    const o = optsRef.current;
    const serialized = snapshot();
    if (serialized === lastSavedRef.current) {
      clearLocalIfMatches(key, serialized);
      setStatus("saved");
      setError(null);
      return true;
    }
    const v = valueRef.current;
    const invalid = validateDraft(v);
    if (invalid) {
      setError(invalid);
      setStatus("error");
      return false;
    }
    setStatus("saving");
    setError(null);
    inFlightRef.current = true;
    try {
      const res = await api.saveCampaignDraft(o.orgId, o.campaign._id, {
        ...draftToPatch(v, themeRef.current), editorStep: stepRef.current,
      }, o.token);
      lastSavedRef.current = serialized;
      ackServerRef.current = JSON.stringify({ value: draftFromCampaign(res), step: (res.editorStep ?? stepRef.current) as CampaignEditorStep });
      themeRef.current = res.theme ?? themeRef.current;
      clearLocalIfMatches(key, serialized);
      setRecovered(false);
      o.onSaved(res);
      setStatus(snapshot() === serialized ? "saved" : "dirty");
      return true;
    } catch (err) {
      setError(friendly(err));
      setStatus("error");
      return false;
    } finally {
      inFlightRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /** Queue a save of whatever is latest when its turn comes. */
  const commit = useCallback((): Promise<boolean> => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    chainRef.current = chainRef.current.then(doSave, doSave);
    return chainRef.current;
  }, [doSave]);

  /** Waits for every queued save, then saves the latest snapshot. */
  const flush = useCallback(async (): Promise<boolean> => {
    const ok = await commit();
    return ok && snapshot() === lastSavedRef.current;
  }, [commit]);

  const setValue = useCallback((next: CampaignDraft | ((p: CampaignDraft) => CampaignDraft)) => {
    const resolved = typeof next === "function" ? next(valueRef.current) : next;
    valueRef.current = resolved;
    setValueState(resolved);
    setStorageFailed(!writeLocal(key, resolved, stepRef.current));
    setStatus((s) => (s === "saving" ? s : "dirty"));
    setError(validateDraft(resolved));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void commit(); }, AUTOSAVE_MS);
  }, [key, commit]);

  const setStep = useCallback((s: CampaignEditorStep) => {
    stepRef.current = s;
    setStepState(s);
    writeLocal(key, valueRef.current, s);
    void commit();
  }, [key, commit]);

  const discardRecovered = useCallback(() => {
    // Never race a write: refuse while a save is running; cancel any pending autosave.
    if (inFlightRef.current) return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    const base = JSON.parse(lastSavedRef.current) as { value: CampaignDraft; step: CampaignEditorStep };
    valueRef.current = base.value;
    stepRef.current = base.step;
    setValueState(base.value);
    setStepState(base.step);
    setRecovered(false);
    setStatus("idle");
    setError(null);
  }, [key]);

  // Remote change to the canonical campaign: adopt it only when there are no local edits and nothing in flight.
  useEffect(() => {
    if (inFlightRef.current || timerRef.current) return;
    if (snapshot() !== lastSavedRef.current) return;
    if (serverSerialized === lastSavedRef.current) return;
    // Our own save echoed back (possibly normalised): editor state already reflects intent.
    if (serverSerialized === ackServerRef.current) return;
    const base = JSON.parse(serverSerialized) as { value: CampaignDraft; step: CampaignEditorStep };
    lastSavedRef.current = serverSerialized;
    themeRef.current = optsRef.current.campaign.theme;
    valueRef.current = base.value;
    stepRef.current = base.step;
    setValueState(base.value);
    setStepState(base.step);
    clearLocalIfMatches(key, serverSerialized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSerialized, key]);

  // Persist recovered drafts promptly once the editor opens.
  useEffect(() => {
    if (init.recovered) void commit();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (snapshot() !== lastSavedRef.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  return {
    value, setValue, step, setStep, commit, flush, status, error, recovered, discardRecovered,
    storageWarning: storageFailed && status !== "saved" && status !== "idle"
      ? "This browser is not keeping a backup copy (private mode or storage full). Stay on this page until you see Saved."
      : null,
  };
}

/** Old local drafts used match* keys. All legacy funding is committed, never matching. */
function migrateLegacyDraft(v: CampaignDraft): CampaignDraft {
  const old = v as CampaignDraft & { matchOn?: boolean; matchAnswer?: "yes" | "no" | null; matchAmount?: string; matchFunder?: string };
  if (!("matchOn" in old || "matchAnswer" in old || "matchAmount" in old || "matchFunder" in old)) return v;
  const { matchOn, matchAnswer, matchAmount, matchFunder, ...rest } = old;
  return {
    ...rest,
    partnerOn: rest.partnerOn ?? !!matchOn,
    partnerAnswer: rest.partnerAnswer ?? matchAnswer ?? null,
    partnerType: rest.partnerType ?? "committed",
    partnerAmount: rest.partnerAmount ?? matchAmount ?? "",
    partnerFunder: rest.partnerFunder ?? matchFunder ?? "",
  } as CampaignDraft;
}
