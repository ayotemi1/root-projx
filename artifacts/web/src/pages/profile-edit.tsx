import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSupporterAccount, saveSupporterAccountProfile, uploadSupporterAccountPhoto, discardSupporterAccountPhoto,
  type SupporterAccountProfileInput,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SupporterAvatar } from "@/components/supporter/SupporterAvatar";
import { accountKey, authInit, friendlyError, GENERIC } from "./account-shared";
import "./account-pages.css";

type Photo = { kind: "keep" } | { kind: "staged"; id: string; url: string } | { kind: "remove" };
const MAX_BYTES = 20 * 1024 * 1024;
const MIN_PX = 400;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
    img.src = url;
  });
}

function cropSquare(img: HTMLImageElement, type: string): Promise<Blob> {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = side; canvas.height = side;
  canvas.getContext("2d")!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, side, side);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("crop"))), type, 0.92));
}

export default function ProfileEditPage() {
  const { token, refreshUser } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const key = accountKey(token);
  const q = useQuery({ queryKey: key, queryFn: ({ signal }) => getSupporterAccount(authInit(token, signal)), enabled: !!token });

  const [name, setName] = useState("");
  const [loc, setLoc] = useState("");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState<Photo>({ kind: "keep" });
  const [error, setError] = useState<{ field: "name" | "bio" | "photo" | "form"; text: string } | null>(null);
  const [busy, setBusy] = useState<"upload" | "save" | null>(null);
  const [cropOffer, setCropOffer] = useState<{ img: HTMLImageElement; type: string } | null>(null);
  const initialised = useRef(false);
  const staged = useRef<Set<string>>(new Set());
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  /** Resolves to the photo ID the in-flight save attached (null if none or failed). */
  const saving = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    if (q.data && !initialised.current) {
      initialised.current = true;
      setName(q.data.displayName); setLoc(q.data.location); setBio(q.data.bio);
    }
  }, [q.data]);

  const discard = (ids: string[], attaching?: string) => {
    ids.filter(id => id !== attaching).forEach(id => {
      staged.current.delete(id);
      discardSupporterAccountPhoto(id, authInit(tokenRef.current)).catch(() => undefined);
    });
  };
  // Best-effort cleanup of unattached uploads when leaving without saving.
  // While a save is in flight, wait for it so the photo being attached is never deleted.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const pending = saving.current;
      if (pending) void pending.then(attached => discard([...staged.current], attached ?? undefined));
      else discard([...staged.current]);
    };
  }, []);

  const upload = async (blob: Blob, fileName: string) => {
    setBusy("upload"); setError(null);
    try {
      const body = new FormData();
      body.append("file", blob, fileName);
      const res = await uploadSupporterAccountPhoto({ ...authInit(token), body });
      // Left the page (Cancel) while uploading: never keep an orphaned staged photo.
      if (!mounted.current) { discard([res.photoId]); return; }
      const previous = photo.kind === "staged" ? photo.id : null;
      staged.current.add(res.photoId);
      setPhoto({ kind: "staged", id: res.photoId, url: res.previewUrl });
      if (previous) discard([previous]);
    } catch (e) {
      setError({ field: "photo", text: friendlyError(e) });
    } finally { setBusy(null); }
  };

  const onFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    setError(null); setCropOffer(null);
    if (!["image/jpeg", "image/png"].includes(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
      setError({ field: "photo", text: "Choose a square JPG or PNG photo" }); return;
    }
    if (file.size > MAX_BYTES) { setError({ field: "photo", text: "Use a photo smaller than 20 MB" }); return; }
    let img: HTMLImageElement;
    try { img = await loadImage(file); } catch { setError({ field: "photo", text: "Choose a square JPG or PNG photo" }); return; }
    const w = img.naturalWidth, h = img.naturalHeight;
    if (Math.min(w, h) < MIN_PX) { setError({ field: "photo", text: "That photo is too small" }); return; }
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    if (w !== h) { setCropOffer({ img, type }); return; }
    await upload(file, file.name);
  };

  const acceptCrop = async () => {
    if (!cropOffer) return;
    const { img, type } = cropOffer;
    setCropOffer(null);
    try {
      const blob = await cropSquare(img, type);
      if (blob.size > MAX_BYTES) { setError({ field: "photo", text: "Use a photo smaller than 20 MB" }); return; }
      await upload(blob, type === "image/png" ? "photo.png" : "photo.jpg");
    } catch { setError({ field: "photo", text: GENERIC }); }
  };

  const save = async () => {
    const displayName = name.trim();
    if (!displayName) { setError({ field: "name", text: "Add a display name" }); return; }
    if (bio.length > 160) { setError({ field: "bio", text: "Keep your bio to 160 characters" }); return; }
    setBusy("save"); setError(null);
    const body: SupporterAccountProfileInput = { displayName, location: loc.trim(), bio };
    if (photo.kind === "staged") body.photoId = photo.id;
    if (photo.kind === "remove") body.photoId = null;
    try {
      const request = saveSupporterAccountProfile(body, authInit(token));
      const attaching = photo.kind === "staged" ? photo.id : null;
      saving.current = request.then(() => attaching, () => null);
      const next = await request.finally(() => { saving.current = null; });
      if (photo.kind === "staged") staged.current.delete(photo.id);
      discard([...staged.current]);
      qc.setQueryData(key, next); // token-scoped key: always safe to commit
      // Only touch global auth/caches/navigation if still on this page as the same subject.
      if (!mounted.current || tokenRef.current !== token) return;
      await refreshUser().catch(() => undefined);
      if (!mounted.current || tokenRef.current !== token) return;
      void qc.invalidateQueries({ predicate: query => query.queryKey[0] !== key[0] });
      toast({ title: "Profile updated" });
      setLocation("/profile");
    } catch (e) {
      if (!mounted.current || tokenRef.current !== token) return;
      const text = friendlyError(e);
      setError({ field: text === "Add a display name" ? "name" : text === "Keep your bio to 160 characters" ? "bio" : text.includes("photo") ? "photo" : "form", text });
      setBusy(null);
    }
  };

  const cancel = () => { if (busy === "save") return; setLocation("/profile"); };

  if (q.isLoading || !token) {
    return <div className="rpa-page" data-testid="page-edit-profile"><h1 className="rpa-h1">Edit profile</h1><div className="rpa-skel" /><div className="rpa-skel" /></div>;
  }
  if (q.isError || !q.data) {
    return (
      <div className="rpa-page" data-testid="page-edit-profile">
        <h1 className="rpa-h1">Edit profile</h1>
        <section className="rpa-box first"><p className="rpa-err" role="alert">{GENERIC}</p>
          <div className="rpa-row"><button type="button" className="rpa-btn sm" onClick={() => q.refetch()} data-testid="button-retry-profile">Try again</button></div></section>
      </div>
    );
  }

  const acc = q.data;
  const previewUrl = photo.kind === "staged" ? photo.url : photo.kind === "remove" ? null : acc.avatarUrl;
  const initials = (name.trim() ? name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2) : acc.avatarInitials).toUpperCase();
  const av = (size: number, testId?: string) => <SupporterAvatar avatarUrl={previewUrl} initials={initials} size={size} testId={testId} />;

  return (
    <div className="rpa-page" data-testid="page-edit-profile">
      <h1 className="rpa-h1">Edit profile</h1>
      <p className="rpa-sub">How you appear to organisations and other supporters</p>

      <section className="rpa-box first" aria-labelledby="rpa-photo">
        <p className="rpa-label" id="rpa-photo">Profile photo</p>
        <div className="rpa-preview">
          {av(160, "img-avatar-preview")}
          <div className="rpa-mini">{av(46)}<span className="rpa-hint" style={{ margin: 0 }}>In the feed</span></div>
          <div className="rpa-mini">{av(28)}<span className="rpa-hint" style={{ margin: 0 }}>Menu</span></div>
        </div>
        {!previewUrl && <p className="rpa-hint" style={{ marginTop: 12 }}>No photo: your initials show instead.</p>}
        {cropOffer && (
          <div className="rpa-crop" role="group" aria-label="Crop photo">
            <p style={{ margin: 0, fontWeight: 700 }}>This photo isn’t square.</p>
            <p className="rpa-hint">We can crop it to a square from the centre.</p>
            <div className="rpa-row" style={{ marginTop: 10 }}>
              <button type="button" className="rpa-btn sm y" onClick={acceptCrop} data-testid="button-crop-square">Crop to square</button>
              <button type="button" className="rpa-btn sm" onClick={() => setCropOffer(null)} data-testid="button-crop-cancel">Choose another</button>
            </div>
          </div>
        )}
        <div className="rpa-row">
          <label className="rpa-btn sm" style={{ cursor: busy ? "default" : "pointer" }} data-testid="button-upload-photo">
            {busy === "upload" ? "Uploading…" : "Upload photo"}
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="rpa-sr" disabled={!!busy}
              onChange={e => onFile(e.target.files?.[0])} data-testid="input-photo" />
          </label>
          {previewUrl && (
            <button type="button" className="rpa-btn sm" disabled={!!busy} data-testid="button-remove-photo"
              onClick={() => { setError(null); setPhoto(acc.avatarUrl ? { kind: "remove" } : { kind: "keep" }); }}>Remove photo</button>
          )}
        </div>
        <p className="rpa-hint">Square JPG or PNG, at least 400 × 400px.</p>
        {error?.field === "photo" && <p className="rpa-err" role="alert" data-testid="error-photo">{error.text}</p>}
      </section>

      <section className="rpa-box" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <p className="rpa-label" style={{ margin: 0 }}>About you</p>
        <label className="rpa-f">
          <span>Display name</span>
          <input className="rpa-in" value={name} maxLength={80} aria-invalid={error?.field === "name"} required
            onChange={e => { setName(e.target.value); if (error?.field === "name") setError(null); }} data-testid="input-display-name" />
        </label>
        {error?.field === "name" && <p className="rpa-err" role="alert" style={{ marginTop: -10 }} data-testid="error-name">{error.text}</p>}
        <label className="rpa-f">
          <span>Location <small>(optional)</small></span>
          <input className="rpa-in" value={loc} maxLength={100} placeholder="City or country" onChange={e => setLoc(e.target.value)} data-testid="input-location" />
        </label>
        <label className="rpa-f">
          <span>Bio</span>
          <textarea className="rpa-in" value={bio} aria-invalid={bio.length > 160} aria-describedby="rpa-biocount"
            onChange={e => { const v = e.target.value; setBio(v.length > 160 && v.length > bio.length ? (bio.length > 160 ? bio : v.slice(0, 160)) : v); if (error?.field === "bio") setError(null); }}
            data-testid="input-bio" />
          <span id="rpa-biocount" className="rpa-hint" style={{ margin: 0, color: bio.length > 160 ? "var(--rp-red)" : undefined }} data-testid="text-bio-count">{bio.length}/160</span>
        </label>
        {error?.field === "bio" && <p className="rpa-err" role="alert" style={{ marginTop: -10 }} data-testid="error-bio">{error.text}</p>}
      </section>

      {error?.field === "form" && <p className="rpa-err" role="alert" data-testid="error-form">{error.text}</p>}
      <div className="rpa-actions">
        <button type="button" className="rpa-btn y" onClick={save} disabled={!!busy} data-testid="button-save-profile">{busy === "save" ? "Saving…" : "Save"}</button>
        <button type="button" className="rpa-btn" onClick={cancel} disabled={busy === "save"} data-testid="button-cancel-profile">Cancel</button>
      </div>
    </div>
  );
}
