import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Copy, Camera, Pencil, X, type LucideIcon } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useAuth } from "@/context/AuthContext";
import { useSupporterPostDraft } from "./SupporterPostDraftProvider";
import { useTextPost } from "./TextPostProvider";
import "./supporter-create.css";

type Option = { type: "post" | "story" | "text"; label: string; description?: string; icon: LucideIcon; mobileOnly?: boolean };

const options: Option[] = [
  { type: "post", label: "Post", description: "Photos or video", icon: Copy },
  { type: "story", label: "Story", description: "Phone only. Gone after 24 hours", icon: Camera, mobileOnly: true },
  { type: "text", label: "Text post", icon: Pencil },
];

const DESKTOP = "(min-width: 1024px)";

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(DESKTOP).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

type Props = {
  className: string;
  testId: string;
  children: ReactNode;
  /** Force sheet presentation (e.g. bottom nav, which only exists below 1024px). */
  variant?: "auto" | "sheet";
  ariaLabel?: string;
};

export function SupporterCreateMenu({ className, testId, children, variant = "auto", ariaLabel }: Props) {
  const { isAuthenticated, user } = useAuth();
  const [location] = useLocation();
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const asMenu = variant === "auto" && desktop;
  const draft = useSupporterPostDraft();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingPost = useRef(false);
  // Close the chooser first, then open the picker on the next frame + task so Radix
  // finishes releasing focus/modal state before the picker dialog takes over.
  const startPost = () => {
    if (!draft) return;
    pendingPost.current = true;
    setOpen(false);
    const el = triggerRef.current;
    requestAnimationFrame(() => setTimeout(() => { pendingPost.current = false; draft.openPicker(el); }, 0));
  };
  const textPost = useTextPost();
  const startText = () => {
    if (!textPost) return;
    pendingPost.current = true;
    setOpen(false);
    const el = triggerRef.current;
    requestAnimationFrame(() => setTimeout(() => { pendingPost.current = false; textPost.openComposer(el); }, 0));
  };
  const keepFocus = (e: Event) => { if (pendingPost.current) e.preventDefault(); };

  useEffect(() => { setOpen(false); }, [location, desktop]);

  if (!isAuthenticated || user?.accountType !== "supporter") {
    return <Link href="/create" className={className} aria-label={ariaLabel} data-testid={testId}>{children}</Link>;
  }

  const trigger = (
    <button ref={triggerRef} type="button" className={className} aria-label={ariaLabel} aria-haspopup={asMenu ? "menu" : "dialog"}
      aria-expanded={open} data-testid={testId}>
      {children}
    </button>
  );

  if (asMenu) {
    return (
      <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content align="start" sideOffset={6} collisionPadding={12}
            className="rpc-menu" data-testid="menu-create" onCloseAutoFocus={keepFocus}>
            {options.filter(o => !o.mobileOnly).map(o => (o.type === "post" && draft) || (o.type === "text" && textPost) ? (
              <DropdownMenuPrimitive.Item key={o.type} className="rpc-menu-item" onSelect={o.type === "text" ? startText : startPost} data-testid={`menu-create-${o.type}`}>
                <span>{o.label}</span><o.icon size={17} aria-hidden />
              </DropdownMenuPrimitive.Item>
            ) : (
              <DropdownMenuPrimitive.Item key={o.type} asChild>
                <Link href={`/create?type=${o.type}`} className="rpc-menu-item" data-testid={`menu-create-${o.type}`}>
                  <span>{o.label}</span><o.icon size={17} aria-hidden />
                </Link>
              </DropdownMenuPrimitive.Item>
            ))}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="rpc-overlay" />
        <DialogPrimitive.Content className="rpc-sheet" aria-describedby={undefined} data-testid="sheet-create" onCloseAutoFocus={keepFocus}>
          <div className="rpc-sheet-head">
            <DialogPrimitive.Title className="rpc-sheet-title">Create</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rpc-close" aria-label="Close create menu" data-testid="button-close-create">
              <X size={20} aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <ul>
            {options.map(o => (
              <li key={o.type}>
                {o.type === "story" ? (
                  <button type="button" className="rpc-sheet-item is-unavailable" disabled aria-disabled="true" data-testid="sheet-create-story">
                    <span className="rpc-sheet-text">
                      <span className="rpc-sheet-label">{o.label} <span className="rpc-badge" data-testid="status-story-unavailable">Unavailable</span></span>
                      <span className="rpc-sheet-desc">Stories haven't been built yet.</span>
                    </span>
                    <o.icon size={19} aria-hidden />
                  </button>
                ) : (o.type === "post" && draft) || (o.type === "text" && textPost) ? (
                  <button type="button" className="rpc-sheet-item" onClick={o.type === "text" ? startText : startPost} data-testid={`sheet-create-${o.type}`}>
                    <span className="rpc-sheet-text">
                      <span className="rpc-sheet-label">{o.label}</span>
                      {o.description && <span className="rpc-sheet-desc">{o.description}</span>}
                    </span>
                    <o.icon size={19} aria-hidden />
                  </button>
                ) : (
                <Link href={`/create?type=${o.type}`} className="rpc-sheet-item" onClick={() => setOpen(false)}
                  data-testid={`sheet-create-${o.type}`}>
                  <span className="rpc-sheet-text">
                    <span className="rpc-sheet-label">{o.label}</span>
                    {o.description && <span className="rpc-sheet-desc">{o.description}</span>}
                  </span>
                  <o.icon size={19} aria-hidden />
                </Link>
                )}
              </li>
            ))}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
