import { runAssistRequest } from "./assist-logic";
import { useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, FileText, Loader2, RotateCcw, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import * as api from "@/lib/api";
import { ApiError, type CampaignAssistField } from "@/lib/api";

export function FieldBlock({ label, htmlFor, hint, children, counter, error }: {
  label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode; counter?: ReactNode; error?: string | null;
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">{label}</label>
        {counter}
      </div>
      {hint && <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>}
      {children}
      {error && <p className="text-xs text-destructive font-medium" role="alert">{error}</p>}
    </div>
  );
}

export function Counter({ n, max, min, id }: { n: number; max?: number; min?: number; id: string }) {
  const over = max != null && n > max;
  const under = min != null && n < min;
  return (
    <span id={id} className={`text-[11px] font-semibold tabular-nums ${over ? "text-destructive" : under ? "text-amber-700" : "text-muted-foreground"}`} aria-live="polite">
      {max != null ? `${n}/${max}` : min != null && under ? `${n} of ${min} minimum` : `${n} characters`}
    </span>
  );
}

/**
 * Upload via multipart with progress. The URL is handed to the draft as soon as it
 * returns, so it is kept in local recovery and re-attached on the next save without uploading again.
 */
export function MediaUpload({
  id, label, accept, url, token, onUploaded, onRemove, tourId, kind = "image", aspect = "aspect-[4/3]",
}: {
  id: string; label: string; accept: string; url: string | null; token: string;
  onUploaded: (url: string) => void; onRemove?: () => void; tourId?: string;
  kind?: "image" | "video" | "file"; aspect?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  async function upload(file: File) {
    setLastFile(file);
    setError(null);
    setProgress(0);
    try {
      const urls = await api.uploadMediaWithProgress([file], token, setProgress);
      onUploaded(urls[0]);
      setLastFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-2" data-tour-id={tourId}>
      <input
        ref={inputRef} id={id} type="file" accept={accept} className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }}
        data-testid={`input-file-${id}`}
      />
      {url && kind === "image" ? (
        <div className={`relative rounded-xl overflow-hidden border border-border bg-secondary ${aspect}`}>
          <img src={url} alt={label} className="w-full h-full object-cover" />
          <div className="absolute bottom-2 right-2 flex gap-2">
            <Button type="button" size="sm" variant="secondary" className="h-8 shadow" onClick={() => inputRef.current?.click()} data-testid={`button-replace-${id}`}>Replace</Button>
            {onRemove && (
              <Button type="button" size="sm" variant="secondary" className="h-8 w-8 p-0 shadow" onClick={onRemove} aria-label={`Remove ${label}`} data-testid={`button-remove-${id}`}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      ) : url ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm min-w-0">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="truncate flex-1 min-w-0" data-testid={`text-uploaded-${id}`}>{url.split("/").pop()}</span>
          <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => inputRef.current?.click()}>Replace</Button>
          {onRemove && <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onRemove} aria-label={`Remove ${label}`}><X className="w-4 h-4" /></Button>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
          className="w-full flex items-center justify-center gap-2 px-4 py-5 border-2 border-dashed border-border rounded-xl text-sm font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-60"
          data-testid={`button-upload-${id}`}
        >
          <Upload className="w-4 h-4" /> {label}
        </button>
      )}
      {progress !== null && (
        <div className="space-y-1" aria-live="polite">
          <Progress value={Math.round(progress * 100)} className="h-1.5" />
          <p className="text-xs text-muted-foreground">Uploading {Math.round(progress * 100)}%</p>
        </div>
      )}
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5" /> <span>{error}</span>
          {lastFile && (
            <button type="button" className="font-bold underline underline-offset-2 inline-flex items-center gap-1" onClick={() => void upload(lastFile)} data-testid={`button-retry-upload-${id}`}>
              <RotateCcw className="w-3 h-3" /> Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function useAssistEnabled(token: string) {
  const q = useQuery({
    queryKey: ["campaign-assist-status"],
    queryFn: () => api.getCampaignAssistStatus(token),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return q.data?.enabled === true;
}

type AssistState =
  | { k: "idle" } | { k: "asking" } | { k: "loading" }
  | { k: "error"; msg: string } | { k: "unavailable"; msg: string }
  | { k: "suggestion"; text: string; editing: boolean };

/** "Help me write". Hidden when the flag is off. Nothing changes until the user accepts. */
export function AssistButton({ enabled, campaignId, field, token, onAccept, fieldLabel, testSuffix, beforeRequest }: {
  enabled: boolean; campaignId: string; field: CampaignAssistField; token: string;
  onAccept: (text: string) => void; fieldLabel: string; testSuffix?: string;
  /** Saves pending edits so the server reads the current draft. False = no request. */
  beforeRequest?: () => Promise<boolean>;
}) {
  const [st, setSt] = useState<AssistState>({ k: "idle" });
  const [instruction, setInstruction] = useState("");
  if (!enabled) return null;
  const tid = `${field.replace(".", "-")}${testSuffix ? `-${testSuffix}` : ""}`;

  async function ask() {
    setSt({ k: "loading" });
    const r = await runAssistRequest(beforeRequest, () => api.requestCampaignAssist({ campaignId, field, instruction: instruction.trim() }, token));
    if (r.k === "suggestion") setSt({ k: "suggestion", text: r.text, editing: false });
    else if (r.k === "unsaved") setSt({ k: "error", msg: "Your latest edits haven't saved yet, so the helper would read an old version. Nothing was sent. Fix the save message above, then try again." });
    else if (r.k === "invalid") setSt({ k: "error", msg: "The writing helper sent back an invalid response. Nothing was changed. Try again." });
    else {
      const e = r.error;
      if (e instanceof ApiError && (e.status === 503 || (e.body as { unavailable?: boolean })?.unavailable)) {
        setSt({ k: "unavailable", msg: "Writing help is not available right now. You can keep writing yourself." });
      } else {
        setSt({ k: "error", msg: e instanceof Error ? e.message : "Something went wrong." });
      }
    }
  }

  if (st.k === "idle") {
    return (
      <button type="button" onClick={() => setSt({ k: "asking" })} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline underline-offset-2" data-testid={`button-assist-${tid}`}>
        <Sparkles className="w-3.5 h-3.5" /> Help me write
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2" data-testid={`panel-assist-${tid}`}>
      <p className="text-xs font-bold text-foreground flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" /> Help with {fieldLabel}</p>
      {(st.k === "asking" || st.k === "error") && (
        <>
          <Textarea rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="What should it say? e.g. shorter, warmer, mention the children's choir" aria-label="Instruction for writing help" className="text-sm bg-background" data-testid={`input-assist-${tid}`} />
          {st.k === "error" && <p role="alert" className="text-xs text-destructive">{st.msg}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={ask} data-testid={`button-assist-ask-${tid}`}>{st.k === "error" ? "Try again" : "Suggest"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSt({ k: "idle" })}>Cancel</Button>
          </div>
        </>
      )}
      {st.k === "loading" && <p className="text-xs text-muted-foreground flex items-center gap-1.5" aria-live="polite"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Writing a suggestion</p>}
      {st.k === "unavailable" && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{st.msg}</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSt({ k: "idle" })}>Close</Button>
        </div>
      )}
      {st.k === "suggestion" && (
        <>
          {st.editing ? (
            <Textarea rows={4} value={st.text} onChange={(e) => setSt({ ...st, text: e.target.value })} className="text-sm bg-background" aria-label="Edit suggestion" />
          ) : (
            <p className="text-sm whitespace-pre-wrap bg-background rounded-lg border border-border p-2.5" data-testid={`text-assist-suggestion-${tid}`}>{st.text}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => { onAccept(st.text); setSt({ k: "idle" }); setInstruction(""); }} data-testid={`button-assist-accept-${tid}`}>
              <Check className="w-3.5 h-3.5 mr-1" /> Use this
            </Button>
            {!st.editing && <Button type="button" size="sm" variant="outline" onClick={() => setSt({ ...st, editing: true })} data-testid={`button-assist-edit-${tid}`}>Edit first</Button>}
            <Button type="button" size="sm" variant="ghost" onClick={() => setSt({ k: "idle" })} data-testid={`button-assist-reject-${tid}`}>Discard</Button>
          </div>
        </>
      )}
    </div>
  );
}
