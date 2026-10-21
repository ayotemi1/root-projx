import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";
import type { Org, OrgProfilePatch } from "@/lib/api";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface Options<T> {
  section: string;
  orgId: string;
  userId: string;
  token: string;
  /** Initial value derived from saved org data. Read once per org id. */
  initial: T;
  toPatch: (value: T) => OrgProfilePatch;
  /** Return an actionable message when the value cannot be saved yet. */
  validate?: (value: T) => string | null;
  /** Parent merges only the submitted fields. */
  onSaved: (patch: OrgProfilePatch, response: Org) => void;
}

interface DraftEnvelope<T> {
  v: 1;
  value: T;
  savedAt: number;
}

export function draftKey(userId: string, orgId: string, section: string) {
  return `rpx:profile-draft:${userId}:${orgId}:${section}`;
}

function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as DraftEnvelope<T>;
    return env && env.v === 1 ? env.value : null;
  } catch {
    return null;
  }
}

/** Returns false when this device can't keep a recovery copy. */
function writeDraft<T>(key: string, value: T): boolean {
  try {
    const env: DraftEnvelope<T> = { v: 1, value, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(env));
    return true;
  } catch {
    return false;
  }
}

export const STORAGE_WARNING =
  "This browser isn't letting us keep a backup copy of your edits (private mode or storage full). Stay on this page until you see Saved, or your changes may be lost.";

function clearDraftIfMatches(key: string, serialized: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const env = JSON.parse(raw) as DraftEnvelope<unknown>;
    if (JSON.stringify(env.value) === serialized) localStorage.removeItem(key);
  } catch { /* ignore */ }
}

function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  if (/failed to fetch|load failed|networkerror/i.test(raw)) {
    return "No connection. Your edits are kept on this device. Retry when you're back online.";
  }
  return raw ? `Not saved: ${raw}` : "Not saved. Your edits are kept on this device.";
}

/**
 * Per-section blur autosave with account-scoped draft recovery.
 * - Saves are serialised; edits made during a save are coalesced into one follow-up save.
 * - Never saves on mount or in response to a server reply.
 * - Drafts are cleared only when the exact submitted version is still current.
 */
export function useSectionAutosave<T>(opts: Options<T>) {
  const key = draftKey(opts.userId, opts.orgId, opts.section);
  const initialSerialized = JSON.stringify(opts.initial);

  const [recovered] = useState(() => {
    const d = readDraft<T>(key);
    return d !== null && JSON.stringify(d) !== initialSerialized ? d : null;
  });
  const [value, setValueState] = useState<T>(() => recovered ?? opts.initial);
  const [status, setStatus] = useState<SaveStatus>(recovered ? "dirty" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [wasRecovered, setWasRecovered] = useState(!!recovered);
  const [storageFailed, setStorageFailed] = useState(false);

  const valueRef = useRef<T>(value);
  const lastSavedRef = useRef<string>(initialSerialized);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // A refetch from another session may refresh an untouched section, but must
  // never replace a local draft or an in-flight submission.
  useEffect(() => {
    if (inFlightRef.current || JSON.stringify(valueRef.current) !== lastSavedRef.current) return;
    valueRef.current = optsRef.current.initial;
    lastSavedRef.current = initialSerialized;
    setValueState(optsRef.current.initial);
    clearDraftIfMatches(key, initialSerialized);
  }, [initialSerialized, key]);

  // If the server already matches (e.g. stale draft identical), drop it.
  useEffect(() => {
    if (!recovered) clearDraftIfMatches(key, initialSerialized);
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    const resolved = typeof next === "function" ? (next as (p: T) => T)(valueRef.current) : next;
    valueRef.current = resolved;
    setValueState(resolved);
    setStorageFailed(!writeDraft(key, resolved));
    setStatus((s) => (s === "saving" ? s : "dirty"));
    setError(null);
  }, [key]);

  const commit = useCallback(async (): Promise<void> => {
    const o = optsRef.current;
    // A save is running: queue a follow-up that re-evaluates the latest value
    // (including a revert to the last saved value) once it completes.
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }
    const snapshot = valueRef.current;
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSavedRef.current) {
      clearDraftIfMatches(key, serialized);
      setStatus((s) => (s === "dirty" ? "saved" : s));
      setError(null);
      return;
    }
    const invalid = o.validate?.(snapshot) ?? null;
    if (invalid) {
      setError(invalid);
      setStatus("error");
      return;
    }
    inFlightRef.current = true;
    setStatus("saving");
    setError(null);
    const patch = o.toPatch(snapshot);
    try {
      const res = await api.updateOrganisation(o.orgId, patch, o.token);
      lastSavedRef.current = serialized;
      o.onSaved(patch, res);
      clearDraftIfMatches(key, serialized);
      setWasRecovered(false);
      inFlightRef.current = false;
      if (JSON.stringify(valueRef.current) === serialized) {
        pendingRef.current = false;
        setStatus("saved");
      } else if (pendingRef.current) {
        pendingRef.current = false;
        await commit();
      } else {
        setStatus("dirty");
      }
    } catch (err) {
      inFlightRef.current = false;
      pendingRef.current = false;
      setError(friendlyError(err));
      setStatus("error");
    }
  }, [key]);

  /** Save now and wait. True only when the latest value is persisted (never on error). */
  const flush = useCallback(async (): Promise<boolean> => {
    const started = Date.now();
    await commit();
    while (inFlightRef.current && Date.now() - started < 20_000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (inFlightRef.current) return false;
    if (JSON.stringify(valueRef.current) !== lastSavedRef.current) {
      await commit();
      while (inFlightRef.current && Date.now() - started < 20_000) await new Promise((r) => setTimeout(r, 100));
    }
    return !inFlightRef.current && JSON.stringify(valueRef.current) === lastSavedRef.current;
  }, [commit]);

  /** Attach to a section wrapper: commits when focus leaves the section. */
  const onSectionBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    void commit();
  }, [commit]);

  const discardDraft = useCallback(() => {
    if (inFlightRef.current) return; // never drop recovery during an in-flight write
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    const base = JSON.parse(lastSavedRef.current) as T;
    valueRef.current = base;
    setValueState(base);
    setStatus("idle");
    setError(null);
    setWasRecovered(false);
  }, [key]);

  const storageWarning = storageFailed && status !== "saved" && status !== "idle" ? STORAGE_WARNING : null;

  return { value, setValue, commit, flush, onSectionBlur, status, error, wasRecovered, discardDraft, storageWarning };
}
