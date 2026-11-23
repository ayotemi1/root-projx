import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useBrowserLocation, useSearch as useBrowserSearch, navigate } from "wouter/use-browser-location";
import type { PostRef } from "@/lib/post-activity";

export type ViewerSession = {
  refs: PostRef[];
  index: number;
  label?: string;
  comments: boolean;
  /** Absolute pathname + search of the page kept mounted behind the viewer. */
  bgPath: string;
  bgSearch: string;
  scrollY: number;
  returnFocus: HTMLElement | null;
};

type OpenArgs = { refs: PostRef[]; index: number; label?: string; comments?: boolean; trigger?: HTMLElement | null };

type Ctx = {
  session: ViewerSession | null;
  open: (a: OpenArgs) => void;
  close: () => void;
  go: (index: number) => void;
  setComments: (open: boolean) => void;
};

const ViewerCtx = createContext<Ctx | null>(null);
const BgCtx = createContext<{ path: string; search: string } | null>(null);

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
export const postPath = (r: PostRef) => `/posts/${encodeURIComponent(r.id)}?kind=${r.kind}`;
const absPostPath = (r: PostRef) => `${BASE}${postPath(r)}`;
const isPostPath = (pathname: string) => new RegExp(`^${BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/posts/[^/]+/?$`).test(pathname);

/** Wouter location hook: while the viewer is open, routes keep rendering the background page. */
export function useViewerAwareLocation(): [string, typeof navigate] {
  const [loc, nav] = useBrowserLocation();
  const bg = useContext(BgCtx);
  return [bg ? bg.path : loc, nav];
}
export function useViewerAwareSearch(): string {
  const search = useBrowserSearch();
  const bg = useContext(BgCtx);
  return bg ? bg.search : search;
}

export function PostViewerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ViewerSession | null>(null);
  const closed = useRef<ViewerSession | null>(null);
  const [pathname] = useBrowserLocation();
  const search = useBrowserSearch();
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const restore = useCallback((s: ViewerSession) => {
    requestAnimationFrame(() => {
      window.scrollTo(0, s.scrollY);
      if (s.returnFocus && document.contains(s.returnFocus)) s.returnFocus.focus({ preventScroll: true });
    });
  }, []);

  // Back closes; Forward to the same post reopens over the same background.
  useEffect(() => {
    const s = sessionRef.current;
    if (s && !isPostPath(pathname)) {
      closed.current = s;
      setSession(null);
      if (pathname === s.bgPath) restore(s);
      return;
    }
    const c = closed.current;
    if (!s && c && isPostPath(pathname)) {
      const ref = c.refs[c.index];
      if (ref && `${pathname}${search}` === absPostPath(ref)) {
        closed.current = null;
        setSession({ ...c, comments: false, scrollY: window.scrollY });
      }
    }
  }, [pathname, search, restore]);

  useEffect(() => {
    if (!session) return;
    const prev = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { history.scrollRestoration = prev; html.style.overflow = overflow; };
  }, [!!session]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = useCallback((a: OpenArgs) => {
    const ref = a.refs[a.index];
    if (!ref) return;
    const trigger = a.trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const already = sessionRef.current;
    const next: ViewerSession = {
      refs: a.refs, index: a.index, label: a.label, comments: !!a.comments,
      bgPath: already?.bgPath ?? window.location.pathname,
      bgSearch: already?.bgSearch ?? window.location.search,
      scrollY: already?.scrollY ?? window.scrollY,
      returnFocus: already?.returnFocus ?? trigger,
    };
    closed.current = null;
    setSession(next);
    navigate(absPostPath(ref), { replace: !!already });
  }, []);

  const close = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    if (isPostPath(window.location.pathname)) history.back();
    else { setSession(null); restore(s); }
  }, [restore]);

  const go = useCallback((index: number) => {
    const s = sessionRef.current;
    const ref = s?.refs[index];
    if (!s || !ref) return;
    setSession({ ...s, index, comments: false });
    navigate(absPostPath(ref), { replace: true });
  }, []);

  const setComments = useCallback((v: boolean) => setSession(s => (s ? { ...s, comments: v } : s)), []);

  const bg = useMemo(() => (session ? { path: session.bgPath, search: session.bgSearch } : null), [session?.bgPath, session?.bgSearch, !!session]); // eslint-disable-line react-hooks/exhaustive-deps
  const value = useMemo(() => ({ session, open, close, go, setComments }), [session, open, close, go, setComments]);

  return (
    <ViewerCtx.Provider value={value}>
      <BgCtx.Provider value={bg}>{children}</BgCtx.Provider>
    </ViewerCtx.Provider>
  );
}

export function usePostViewer() {
  const ctx = useContext(ViewerCtx);
  if (!ctx) throw new Error("usePostViewer must be used inside PostViewerProvider");
  return ctx;
}
