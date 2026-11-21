import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { MAX_POST_ITEMS, postMediaKind, selectPostMedia, type PostMediaKind } from "@/lib/supporter-post-media";
import { SupporterPostDialog } from "./SupporterPostDialog";

export type DraftItem = { id: string; file: File; url: string; kind: PostMediaKind; broken: boolean; ready: boolean };
export type DraftStage = "pick" | "review";

type Ctx = {
  open: boolean;
  stage: DraftStage;
  items: DraftItem[];
  active: number;
  caption: string;
  errors: string[];
  openPicker: (returnFocus?: HTMLElement | null) => void;
  close: () => void;
  addFiles: (files: readonly File[]) => void;
  removeAt: (i: number) => void;
  move: (i: number, dir: -1 | 1) => void;
  setActive: (i: number) => void;
  setStage: (s: DraftStage) => void;
  setCaption: (c: string) => void;
  markBroken: (id: string) => void;
  markReady: (id: string) => void;
  returnFocusRef: React.MutableRefObject<HTMLElement | null>;
};

const PostDraftContext = createContext<Ctx | null>(null);

export function useSupporterPostDraft() {
  return useContext(PostDraftContext);
}

let seq = 0;

export function SupporterPostDraftProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<DraftStage>("pick");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [active, setActiveRaw] = useState(0);
  const [caption, setCaption] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const itemsRef = useRef<DraftItem[]>([]);
  itemsRef.current = items;

  const clear = useCallback(() => {
    itemsRef.current.forEach(i => URL.revokeObjectURL(i.url));
    itemsRef.current = [];
    setItems([]); setActiveRaw(0); setCaption(""); setErrors([]); setStage("pick");
  }, []);

  const close = useCallback(() => { setOpen(false); clear(); }, [clear]);

  const openPicker = useCallback((returnFocus?: HTMLElement | null) => {
    if (!isAuthenticated || user?.accountType !== "supporter") return;
    returnFocusRef.current = returnFocus ?? (document.activeElement as HTMLElement | null);
    clear();
    setOpen(true);
  }, [clear, isAuthenticated, user?.accountType]);

  // Route or account change: close and drop the local draft.
  const userKey = user ? `${user.accountType}:${(user as { _id?: string; id?: string })._id ?? (user as { id?: string }).id ?? user.avatarInitials}` : "none";
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setOpen(false); clear();
  }, [location, userKey, clear]);

  // Unmount: revoke everything.
  useEffect(() => () => { itemsRef.current.forEach(i => URL.revokeObjectURL(i.url)); }, []);

  const addFiles = useCallback((files: readonly File[]) => {
    const { accepted, errors: errs } = selectPostMedia(files, itemsRef.current.length);
    const fresh: DraftItem[] = accepted.slice(0, MAX_POST_ITEMS - itemsRef.current.length).map(file => ({
      id: `pm-${++seq}`, file, url: URL.createObjectURL(file), kind: postMediaKind(file) ?? "image", broken: false, ready: false,
    }));
    setErrors(errs);
    if (fresh.length) {
      const prevLen = itemsRef.current.length;
      const next = [...itemsRef.current, ...fresh];
      itemsRef.current = next; // sync so rapid picks / immediate close see it
      setItems(next);
      setActiveRaw(prevLen);
    }
  }, []);

  const removeAt = useCallback((i: number) => {
    const prev = itemsRef.current;
    const target = prev[i];
    if (!target) return;
    URL.revokeObjectURL(target.url);
    const next = prev.filter((_, idx) => idx !== i);
    itemsRef.current = next;
    setItems(next);
    setActiveRaw(a => Math.max(0, Math.min(a > i ? a - 1 : a, next.length - 1)));
    if (next.length === 0) setStage("pick");
    setErrors([]);
  }, []);

  const move = useCallback((i: number, dir: -1 | 1) => {
    const prev = itemsRef.current;
    const j = i + dir;
    if (j < 0 || j >= prev.length) return;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    itemsRef.current = next;
    setItems(next);
    setActiveRaw(j);
  }, []);

  const setActive = useCallback((i: number) => {
    setActiveRaw(Math.max(0, Math.min(i, itemsRef.current.length - 1)));
  }, []);

  const markBroken = useCallback((id: string) => {
    const next = itemsRef.current.map(it => it.id === id ? { ...it, broken: true, ready: false } : it);
    itemsRef.current = next; setItems(next);
  }, []);
  const markReady = useCallback((id: string) => {
    if (!itemsRef.current.some(it => it.id === id && !it.ready && !it.broken)) return;
    const next = itemsRef.current.map(it => it.id === id ? { ...it, ready: true } : it);
    itemsRef.current = next; setItems(next);
  }, []);

  const value: Ctx = {
    open, stage, items, active, caption, errors, openPicker, close, addFiles, removeAt, move,
    setActive, setStage, setCaption, markBroken, markReady, returnFocusRef,
  };

  return (
    <PostDraftContext.Provider value={value}>
      {children}
      <SupporterPostDialog />
    </PostDraftContext.Provider>
  );
}
