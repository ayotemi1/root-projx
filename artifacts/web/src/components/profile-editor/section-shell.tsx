import { useEffect, useRef, useState, type ReactNode } from "react";
import { openPreviewAfterSave, registerProfileFlush, flushProfile } from "@/lib/preview-nav";
import { AlertCircle, Check, ExternalLink, Loader2, RotateCcw, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SaveStatus } from "./use-section-autosave";
import { PROFILE_ANCHORS, type ProfileSection } from "@/lib/sectors";

export function SaveIndicator({
  status, error, onRetry, section, storageWarning, manualSave = false,
}: { status: SaveStatus; error: string | null; onRetry: () => void; section: string; storageWarning?: string | null; manualSave?: boolean }) {
  return (
    <div className="min-h-[20px] space-y-2" aria-live="polite" data-testid={`status-save-${section}`} data-save-state={status}>
      {storageWarning && (
        <div role="alert" className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2" data-testid={`warning-storage-${section}`}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{storageWarning}</span>
        </div>
      )}
      {status === "saving" && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving
        </span>
      )}
      {status === "saved" && (
        <span className="inline-flex items-center gap-1.5 text-xs text-green-700 font-medium">
          <Check className="w-3.5 h-3.5" /> Saved
        </span>
      )}
      {status === "dirty" && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-amber-700 font-medium">
          <span className="inline-flex items-center gap-1.5">
            <Circle className="w-2.5 h-2.5 fill-current" />
            {manualSave ? "Uploaded image is not attached yet. Save it without uploading again." : "Unsaved. Saves when you leave this section."}
          </span>
          <button type="button" onClick={onRetry} className="font-bold underline underline-offset-2"
            data-testid={`button-retry-${section}`}>
            {manualSave ? "Attach image" : "Save now"}
          </button>
        </div>
      )}
      {status === "error" && (
        <div role="alert" className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-2.5 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 font-bold underline underline-offset-2 flex-shrink-0"
            data-testid={`button-retry-${section}`}
          >
            <RotateCcw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}
    </div>
  );
}

export function SectionShell({
  section, title, hint, optional, orgId, status, error, onRetry, onBlur,
  wasRecovered, onDiscard, storageWarning, onFlush, children,
}: {
  /** Save this section and wait; true only when persisted. */
  onFlush?: () => Promise<boolean>;
  section: ProfileSection;
  title: string;
  hint: string;
  optional?: boolean;
  orgId: string;
  status: SaveStatus;
  error: string | null;
  onRetry: () => void;
  onBlur?: (e: React.FocusEvent<HTMLElement>) => void;
  wasRecovered?: boolean;
  onDiscard?: () => void;
  storageWarning?: string | null;
  children: ReactNode;
}) {
  const flushRef = useRef(onFlush);
  flushRef.current = onFlush;
  useEffect(() => registerProfileFlush(orgId, () => (flushRef.current ? flushRef.current() : Promise.resolve(true))), [orgId]);
  const [previewState, setPreviewState] = useState<"idle" | "saving" | "failed">("idle");
  async function preview() {
    setPreviewState("saving");
    const ok = await openPreviewAfterSave(() => flushProfile(orgId), `/organisations/${orgId}?preview=1#${PROFILE_ANCHORS[section]}`);
    setPreviewState(ok ? "idle" : "failed");
  }
  return (
    <section
      id={`edit-${section}`}
      data-tour-id={`profile-section-${section}`}
      aria-labelledby={`edit-${section}-title`}
      onBlur={onBlur}
      className="ops-psection scroll-mt-24 overflow-hidden"
    >
      <header className="pb-3 flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 id={`edit-${section}-title`} className="ops-display uppercase text-[26px] sm:text-[32px] leading-none text-foreground flex items-center gap-2 flex-wrap">
            {title}
            {optional && (
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground border border-current px-1.5 py-0.5 align-middle">
                Optional
              </span>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-prose">{hint}</p>
        </div>
        <button
          type="button"
          onClick={preview}
          disabled={previewState === "saving"}
          className="ops-btn ops-btn--sm flex-shrink-0 disabled:opacity-60"
          data-testid={`link-public-${section}`}
          data-tour-id={`profile-view-public-${section}`}
        >
          {previewState === "saving" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          {previewState === "saving" ? "Saving" : "Preview as donor"} <ExternalLink className="w-3 h-3" />
        </button>
      </header>
      {previewState === "failed" && (
        <p role="alert" className="mt-3 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2" data-testid={`error-preview-${section}`}>
          Your edits haven't saved yet, so a preview would be out of date. Fix the message below or retry, then preview again. Nothing was lost.
        </p>
      )}
      {wasRecovered && onDiscard && (
        <div className="mt-3 flex items-center gap-2 text-xs bg-accent/15 border border-accent/40 rounded-lg px-3 py-2">
          <span className="flex-1">We restored edits you hadn't saved yet. They save when you leave this section.</span>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onDiscard} disabled={status === "saving"} data-testid={`button-discard-${section}`}>
            Discard
          </Button>
        </div>
      )}
      <div className="py-4 space-y-4">{children}</div>
      <footer className="pb-4">
        <SaveIndicator status={status} error={error} onRetry={onRetry} section={section} storageWarning={storageWarning} />
      </footer>
    </section>
  );
}

export function CharCount({ value, min, max }: { value: string; min?: number; max?: number }) {
  const n = value.trim().length;
  const over = max !== undefined && n > max;
  const under = min !== undefined && n < min;
  return (
    <span className={`text-[11px] tabular-nums ${over ? "text-destructive font-bold" : under ? "text-amber-700" : "text-muted-foreground"}`}>
      {n}{max !== undefined ? `/${max}` : ""}{under && min !== undefined ? ` (aim for ${min}+)` : ""}
    </span>
  );
}
