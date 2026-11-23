import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type SyntheticEvent, type TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import { Archive, ArchiveRestore, Check, Image as ImageIcon, Link2, Loader2, MessageCircleOff, MessageCircle, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import "./OwnPostMenu.css";

export type OwnerPostAction = "edit" | "cover" | "pin" | "archive" | "restore" | "commenting" | "copy" | "delete";

export interface OwnPostMenuProps {
  video: boolean;
  pinned: boolean;
  archived: boolean;
  commentsDisabled: boolean;
  onAction: (action: OwnerPostAction) => Promise<void> | void;
  className?: string;
}

type Item = { action: OwnerPostAction; label: string; help?: string; icon: ReactNode; danger?: boolean };

const ERR = "Something went wrong. Please try again.";
const stop = (e: SyntheticEvent) => e.stopPropagation();
const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches;

export function OwnPostMenu({ video, pinned, archived, commentsDisabled, onAction, className }: OwnPostMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState<OwnerPostAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const actionRef = useRef(onAction);
  actionRef.current = onAction;

  const items: Item[] = archived
    ? [
        { action: "restore", label: "Show on profile", icon: <ArchiveRestore aria-hidden /> },
        { action: "delete", label: "Delete", icon: <Trash2 aria-hidden />, danger: true },
      ]
    : [
        { action: "edit", label: "Edit post", help: "Caption, community, campaign", icon: <Pencil aria-hidden /> },
        ...(video ? [{ action: "cover" as const, label: "Change cover", help: "Pick a frame or upload an image", icon: <ImageIcon aria-hidden /> }] : []),
        { action: "pin", label: pinned ? "Unpin" : "Pin to your profile", icon: pinned ? <PinOff aria-hidden /> : <Pin aria-hidden /> },
        { action: "archive", label: "Archive", help: "Hide from your profile and the feed. Only you can see it.", icon: <Archive aria-hidden /> },
        { action: "commenting", label: commentsDisabled ? "Turn on commenting" : "Turn off commenting", icon: commentsDisabled ? <MessageCircle aria-hidden /> : <MessageCircleOff aria-hidden /> },
        { action: "copy", label: "Copy link", icon: <Link2 aria-hidden /> },
        { action: "delete", label: "Delete", icon: <Trash2 aria-hidden />, danger: true },
      ];

  const close = useCallback((refocus = true) => {
    setOpen(false); setConfirm(false); setError(null);
    if (refocus) requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);

  const place = useCallback(() => {
    const t = triggerRef.current, m = menuRef.current;
    if (!t || !m || isPhone()) return;
    const r = t.getBoundingClientRect();
    const w = m.offsetWidth, h = m.offsetHeight, gap = 8;
    let left = r.right + gap;
    if (left + w > window.innerWidth - 8) left = r.left - w - gap;
    if (left < 8) left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w));
    let top = r.top;
    if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => { if (open && !confirm) place(); }, [open, confirm, place, archived, video]);

  useEffect(() => {
    if (!open || confirm) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>("button.opm-item:not(:disabled)");
    first?.focus({ preventScroll: true });
    const onResize = () => place();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize, true); };
  }, [open, confirm, place]);

  useEffect(() => { if (confirm) cancelRef.current?.focus({ preventScroll: true }); }, [confirm]);

  // Escape closes (capture so the post viewer doesn't close underneath us).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault(); e.stopPropagation();
      if (pending) return;
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, pending, close]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(false), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const run = async (action: OwnerPostAction) => {
    if (pending) return;
    if (action === "delete" && !confirm) { setError(null); setConfirm(true); return; }
    setPending(action); setError(null);
    try {
      await actionRef.current(action);
      setPending(null);
      close(action !== "delete");
      if (action === "copy") setToast(true);
    } catch (error) {
      setPending(null);
      setError(error && typeof error === "object" && "status" in error && error.status === 409
        ? "You can pin up to 3 posts. Unpin one first." : ERR);
    }
  };

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const btns = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button.opm-item:not(:disabled)") ?? []);
    if (!btns.length) return;
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    let n = -1;
    if (e.key === "ArrowDown") n = (i + 1) % btns.length;
    else if (e.key === "ArrowUp") n = (i - 1 + btns.length) % btns.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = btns.length - 1;
    else if (e.key === "Tab") { e.preventDefault(); n = e.shiftKey ? (i - 1 + btns.length) % btns.length : (i + 1) % btns.length; }
    if (n >= 0) { e.preventDefault(); btns[n]?.focus(); }
  };

  const onConfirmKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.key !== "Tab") return;
    const btns = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    if (!btns.length) return;
    const first = btns[0]!, last = btns[btns.length - 1]!;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const touchStart = (e: ReactTouchEvent) => {
    if (!isPhone()) return;
    const t = e.touches[0]; if (t) drag.current = { y: t.clientY, dy: 0 };
    menuRef.current?.classList.add("dragging");
  };
  const touchMove = (e: ReactTouchEvent) => {
    const d = drag.current, t = e.touches[0], m = menuRef.current;
    if (!d || !t || !m) return;
    d.dy = Math.max(0, t.clientY - d.y);
    m.style.transform = `translateY(${d.dy}px)`;
  };
  const touchEnd = () => {
    const d = drag.current, m = menuRef.current; drag.current = null;
    if (!d || !m) return;
    m.classList.remove("dragging");
    if (d.dy > 80 && !pending) { close(); return; }
    m.classList.add("settling"); m.style.transform = "";
    window.setTimeout(() => m.classList.remove("settling"), 220);
  };

  const portal = (node: ReactNode) => typeof document !== "undefined" ? createPortal(node, document.body) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`opm-trigger${className ? ` ${className}` : ""}`}
        aria-label="Post options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={e => { e.stopPropagation(); e.preventDefault(); if (open) close(); else { setError(null); setOpen(true); } }}
        onPointerDown={stop}
        onTouchStart={stop}
        onTouchEnd={stop}
        onKeyDown={e => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); } }}
        data-testid="button-own-post-menu"
      >
        <MoreHorizontal aria-hidden />
      </button>

      {open && !confirm && portal(
        <div className="opm-layer" onClick={stop} onPointerDown={stop} onTouchStart={stop} onTouchEnd={stop}>
          <div className="opm-scrim" aria-hidden onClick={() => { if (!pending) close(); }} data-testid="overlay-own-post-menu" />
          <div
            ref={menuRef}
            className="opm-menu"
            role="menu"
            aria-label="Post options"
            style={{ top: pos.top, left: pos.left }}
            onKeyDown={onMenuKey}
            onTouchStart={touchStart}
            onTouchMove={touchMove}
            onTouchEnd={touchEnd}
            data-testid="menu-own-post"
          >
            <span className="opm-grab" aria-hidden />
            {items.map(it => (
              <button
                key={it.action}
                type="button"
                role="menuitem"
                className={`opm-item${it.danger ? " opm-dng" : ""}`}
                disabled={!!pending}
                aria-busy={pending === it.action}
                onClick={() => run(it.action)}
                data-testid={`menuitem-own-post-${it.action}`}
              >
                {pending === it.action ? <Loader2 className="opm-spin" aria-hidden /> : it.icon}
                <span>{it.label}{it.help && <small>{it.help}</small>}</span>
              </button>
            ))}
            {error && <p className="opm-err" role="alert" data-testid="text-own-post-error">{error}</p>}
          </div>
        </div>
      )}

      {open && confirm && portal(
        <div className="opm-confirm-layer" onClick={e => { stop(e); if (e.target === e.currentTarget && !pending) close(); }} onPointerDown={stop} onTouchStart={stop} onTouchEnd={stop}>
          <div className="opm-confirm" role="alertdialog" aria-modal="true" aria-labelledby="opm-del-title" aria-describedby="opm-del-desc" onKeyDown={onConfirmKey} data-testid="dialog-delete-post">
            <h2 id="opm-del-title">Delete this post?</h2>
            <p id="opm-del-desc">This can't be undone.</p>
            {error && <p className="opm-err" role="alert" data-testid="text-delete-error">{error}</p>}
            <div className="opm-actions">
              <button ref={cancelRef} type="button" className="opm-cancel" disabled={pending === "delete"} onClick={() => close()} data-testid="button-cancel-delete">Cancel</button>
              <button type="button" className="opm-delete" disabled={pending === "delete"} aria-busy={pending === "delete"} onClick={() => run("delete")} data-testid="button-confirm-delete">
                {pending === "delete" && <Loader2 className="opm-spin" size={16} aria-hidden />}Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && portal(
        <div className="opm-toast" role="status" aria-live="polite" data-testid="status-link-copied"><Check aria-hidden />Link copied</div>
      )}
    </>
  );
}

export default OwnPostMenu;
