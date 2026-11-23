import { userErrorMessage } from "@/lib/error-feedback";
import { useEffect, useRef, useState } from "react";
import { Upload, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import * as api from "@/lib/api";
import { checkSize, cropAndResize, cropBox, loadImage, type ImageSpec } from "@/lib/image-process";

/**
 * Pick -> crop/resize locally -> upload with progress -> onUploaded(url).
 * Never removes the current image; a failed upload leaves it untouched.
 */
export function ImageUploadField({
  id, label, guidance, spec, currentUrl, token, onUploaded, onRemoved, shape = "wide", tourId,
}: {
  id: string;
  label: string;
  guidance: string;
  spec: ImageSpec;
  currentUrl: string | null;
  token: string;
  onUploaded: (url: string) => Promise<void> | void;
  onRemoved?: () => Promise<void> | void;
  shape?: "wide" | "square" | "round";
  tourId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [position, setPosition] = useState(0.5);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const [removing, setRemoving] = useState(false);
  useEffect(() => () => {
    if (img) URL.revokeObjectURL(img.src);
  }, [img]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    try {
      const loaded = await loadImage(file);
      const tooSmall = checkSize(loaded, spec);
      if (tooSmall) { URL.revokeObjectURL(loaded.src); setError(tooSmall); return; }
      setImg(loaded);
      setPosition(0.5);
    } catch (err) {
      setError(userErrorMessage(err, "read this image; choose another image if it cannot be opened"));
    }
  }

  async function upload(blob: Blob) {
    setProgress(0);
    setError(null);
    try {
      const urls = await api.uploadMediaWithProgress([blob], token, setProgress);
      await onUploaded(urls[0]!);
      setImg(null);
      setLastBlob(null);
    } catch (err) {
      setLastBlob(blob);
      setError(userErrorMessage(err, "upload this image"));
    } finally {
      setProgress(null);
    }
  }

  async function confirmCrop() {
    if (!img) return;
    try {
      const blob = await cropAndResize(img, spec, position);
      await upload(blob);
    } catch (err) {
      setError(userErrorMessage(err, "prepare this image; choose a different file if it cannot be opened"));
    }
  }

  const box = img ? cropBox(img.naturalWidth, img.naturalHeight, spec.aspect) : null;
  const overflowX = img && box ? img.naturalWidth > box.cw : false;
  const overflowY = img && box ? img.naturalHeight > box.ch : false;
  const canAdjust = overflowX || overflowY;
  const previewShape = shape === "round" ? "rounded-full" : "rounded-xl";
  const previewSize = shape === "wide" ? "w-full aspect-[8/3]" : "w-24 h-24";
  const uploading = progress !== null;

  async function remove() {
    setRemoving(true);
    setError(null);
    try {
      await onRemoved?.();
      setLastBlob(null);
    } catch (err) {
      setError(userErrorMessage(err, "remove this image"));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-2" data-tour-id={tourId}
      data-save-state={uploading ? "saving" : error ? "error" : img ? "dirty" : undefined}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-foreground" id={`${id}-label`}>{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{guidance}</p>

      <div className={shape === "wide" ? "space-y-2" : "flex items-center gap-4"}>
        <div className={`${previewSize} ${previewShape} overflow-hidden border border-border bg-secondary flex-shrink-0 relative`}>
          {img ? (
            <img
              src={img.src}
              alt={`${label} crop preview`}
              className="w-full h-full object-cover"
              style={{ objectPosition: `${overflowX ? position * 100 : 50}% ${overflowY ? position * 100 : 50}%` }}
            />
          ) : currentUrl ? (
            <img src={currentUrl} alt={`Current ${label.toLowerCase()}`} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[11px] text-muted-foreground px-2 text-center">
              None yet
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {img ? (
            <>
              {canAdjust && (
                <label className="block text-xs font-medium text-foreground">
                  {overflowX ? "Slide to choose left to right" : "Slide to choose top to bottom"}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={position}
                    onChange={(e) => setPosition(Number(e.target.value))}
                    className="w-full mt-1 accent-[hsl(var(--primary))]"
                    disabled={uploading}
                    data-testid={`input-crop-${id}`}
                  />
                </label>
              )}
              <div className="flex gap-2">
                <Button type="button" size="sm" className="h-9 font-bold" onClick={confirmCrop} disabled={uploading} data-testid={`button-upload-${id}`}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> {uploading ? "Uploading" : "Use this crop"}
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => setImg(null)} disabled={uploading} data-testid={`button-cancel-${id}`}>
                  <X className="w-3.5 h-3.5 mr-1" /> Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <input
                ref={inputRef}
                id={id}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-labelledby={`${id}-label`}
                onChange={onPick}
                data-testid={`input-file-${id}`}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 font-semibold"
                onClick={() => inputRef.current?.click()}
                disabled={uploading || removing}
                data-testid={`button-choose-${id}`}
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" /> {currentUrl ? "Replace" : "Choose image"}
              </Button>
              {currentUrl && onRemoved && (
                <Button type="button" size="sm" variant="outline" className="h-9 ml-2" onClick={remove}
                  disabled={uploading || removing} data-testid={`button-remove-${id}`}>
                  <X className="w-3.5 h-3.5 mr-1" /> {removing ? "Removing…" : "Remove"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {uploading && (
        <div className="space-y-1" aria-live="polite">
          <Progress value={Math.round((progress ?? 0) * 100)} className="h-2" aria-label={`${label} upload progress`} />
          <p className="text-[11px] text-muted-foreground tabular-nums">Uploading {Math.round((progress ?? 0) * 100)}%</p>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-2.5 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          {lastBlob && (
            <button type="button" className="font-bold underline flex-shrink-0" onClick={() => upload(lastBlob)} data-testid={`button-retry-upload-${id}`}>
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
