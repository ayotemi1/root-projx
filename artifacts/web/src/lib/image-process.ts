export interface ImageSpec {
  /** Output aspect ratio (width / height). */
  aspect: number;
  minWidth: number;
  minHeight: number;
  /** Max output width (downscale only, never upscale). */
  maxWidth: number;
  label: string;
}

export const LOGO_SPEC: ImageSpec = { aspect: 1, minWidth: 400, minHeight: 400, maxWidth: 800, label: "logo" };
export const COVER_SPEC: ImageSpec = { aspect: 1600 / 600, minWidth: 1600, minHeight: 600, maxWidth: 1600, label: "cover image" };
export const TEAM_SPEC: ImageSpec = { aspect: 1, minWidth: 200, minHeight: 200, maxWidth: 400, label: "team photo" };

export async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("We couldn't read that image. Try a JPG or PNG.");
  }
}

/** Largest crop window at the spec aspect that fits the source. */
export function cropBox(w: number, h: number, aspect: number) {
  if (w / h > aspect) return { cw: Math.round(h * aspect), ch: h };
  return { cw: w, ch: Math.round(w / aspect) };
}

/** Returns a reason the source is too small, or null if usable. */
export function checkSize(img: HTMLImageElement, spec: ImageSpec): string | null {
  const { cw, ch } = cropBox(img.naturalWidth, img.naturalHeight, spec.aspect);
  if (cw < spec.minWidth || ch < spec.minHeight) {
    return `This image is ${img.naturalWidth}x${img.naturalHeight}. After cropping it is ${cw}x${ch}, smaller than the ${spec.minWidth}x${spec.minHeight} needed for a sharp ${spec.label}. Choose a larger photo; we won't stretch it.`;
  }
  return null;
}

/** position: 0..1 along whichever axis overflows. */
export async function cropAndResize(img: HTMLImageElement, spec: ImageSpec, position: number): Promise<Blob> {
  const W = img.naturalWidth, H = img.naturalHeight;
  const { cw, ch } = cropBox(W, H, spec.aspect);
  const sx = Math.round((W - cw) * position);
  const sy = Math.round((H - ch) * position);
  const outW = Math.min(cw, spec.maxWidth);
  const outH = Math.round(outW / spec.aspect);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing isn't supported in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, cw, ch, 0, 0, outW, outH);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not prepare image."))), "image/jpeg", 0.85),
  );
}
