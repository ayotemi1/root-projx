import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SupporterPostTag } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { GENERIC_SHARE_ERROR, cachePublishedPost, newPostId, publishPost } from "@/lib/supporter-publishing";
import { TextPostDialog } from "./TextPostDialog";

export const MAX_TEXT_POST = 500;

type Ctx = {
  open: boolean; text: string; tag: SupporterPostTag | null; pending: boolean; error: string | null;
  openComposer: (returnFocus?: HTMLElement | null) => void;
  close: () => void;
  setText: (t: string) => void;
  setTag: (t: SupporterPostTag | null) => void;
  publish: () => Promise<void>;
  returnFocusRef: React.MutableRefObject<HTMLElement | null>;
};

const TextPostContext = createContext<Ctx | null>(null);
export function useTextPost() { return useContext(TextPostContext); }

/**
 * Text-only supporter post composer state. The draft (text + tag + idempotency id) survives closing the
 * composer, opening the tag picker and failed publishes; it is cleared on success or account change.
 */
export function TextPostProvider({ children }: { children: ReactNode }) {
  const { user, token, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setTextRaw] = useState("");
  const [tag, setTagRaw] = useState<SupporterPostTag | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pendingRef = useRef(false);
  /** Stable id for this exact payload; a retry of the same text+tag reuses it, an edit gets a new one. */
  const attempt = useRef<{ id: string; sig: string } | null>(null);
  const userKey = user ? `${user.accountType}:${user.id}` : "none";

  useEffect(() => {
    setOpen(false); setTextRaw(""); setTagRaw(null); setError(null); attempt.current = null;
  }, [userKey]);

  const openComposer = useCallback((returnFocus?: HTMLElement | null) => {
    if (!isAuthenticated || user?.accountType !== "supporter") return;
    returnFocusRef.current = returnFocus ?? (document.activeElement as HTMLElement | null);
    setError(null);
    setOpen(true);
  }, [isAuthenticated, user?.accountType]);

  const close = useCallback(() => { if (!pendingRef.current) setOpen(false); }, []);
  const setText = useCallback((t: string) => { if (!pendingRef.current) { setTextRaw(t.slice(0, MAX_TEXT_POST)); setError(null); } }, []);
  const setTag = useCallback((t: SupporterPostTag | null) => { if (!pendingRef.current) { setTagRaw(t); setError(null); } }, []);

  const publish = useCallback(async () => {
    const caption = text.trim();
    if (!token || pendingRef.current || !caption || caption.length > MAX_TEXT_POST) return;
    const tagInput = tag ? { type: tag.type, value: tag.value } : null;
    const sig = JSON.stringify([caption, tagInput]);
    if (!attempt.current || attempt.current.sig !== sig) attempt.current = { id: newPostId(), sig };
    pendingRef.current = true; setPending(true); setError(null);
    try {
      const saved = await publishPost({ id: attempt.current.id, type: "text", caption, media: [], tag: tagInput }, token);
      await cachePublishedPost(qc, saved, token);
      attempt.current = null;
      setTextRaw(""); setTagRaw(null);
      pendingRef.current = false;
      setOpen(false);
      toast({ title: "Posted" });
    } catch {
      setError(GENERIC_SHARE_ERROR);
    } finally {
      pendingRef.current = false; setPending(false);
    }
  }, [text, tag, token, qc, toast]);

  return (
    <TextPostContext.Provider value={{ open, text, tag, pending, error, openComposer, close, setText, setTag, publish, returnFocusRef }}>
      {children}
      <TextPostDialog />
    </TextPostContext.Provider>
  );
}
