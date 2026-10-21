import type { ReactNode } from "react";
import { AlertCircle, Check, ExternalLink, Loader2, RotateCcw, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SaveStatus } from "./use-section-autosave";
import { PROFILE_ANCHORS, type ProfileSection } from "@/lib/sectors";

export function SaveIndicator({
  status, error, onRetry, section, storageWarning, manualSave = false,
}: { status: SaveStatus; error: string | null; onRetry: () => void; section: string; storageWarning?: string | null; manualSave?: boolean }) {
  return (
    <div className="min-h-[20px] space-y-2" aria-live="polite" data-testid={`status-save-${section}`}>
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
  wasRecovered, onDiscard, storageWarning, children,
}: {
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
  return (
    <section
      id={`edit-${section}`}
      data-tour-id={`profile-section-${section}`}
      aria-labelledby={`edit-${section}-title`}
      onBlur={onBlur}
      className="scroll-mt-24 bg-card border border-border rounded-2xl shadow-sm overflow-hidden"
    >
      <header className="px-4 sm:px-5 pt-4 pb-3 border-b border-border/60 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 id={`edit-${section}-title`} className="font-extrabold text-base text-foreground flex items-center gap-2 flex-wrap">
            {title}
            {optional && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                Optional
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>
        </div>
        <a
          href={`/organisations/${orgId}#${PROFILE_ANCHORS[section]}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-2 py-1"
          data-testid={`link-public-${section}`}
          data-tour-id={`profile-view-public-${section}`}
        >
          View <ExternalLink className="w-3 h-3" />
        </a>
      </header>
      {wasRecovered && onDiscard && (
        <div className="mx-4 sm:mx-5 mt-3 flex items-center gap-2 text-xs bg-accent/15 border border-accent/40 rounded-lg px-3 py-2">
          <span className="flex-1">We restored edits you hadn't saved yet. They save when you leave this section.</span>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onDiscard} disabled={status === "saving"} data-testid={`button-discard-${section}`}>
            Discard
          </Button>
        </div>
      )}
      <div className="px-4 sm:px-5 py-4 space-y-4">{children}</div>
      <footer className="px-4 sm:px-5 pb-4">
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
