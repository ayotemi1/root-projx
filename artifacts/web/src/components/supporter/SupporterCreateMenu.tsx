import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Copy, Camera, Pencil, X, type LucideIcon } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useAuth } from "@/context/AuthContext";
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

  useEffect(() => { setOpen(false); }, [location, desktop]);

  if (!isAuthenticated || user?.accountType !== "supporter") {
    return <Link href="/create" className={className} aria-label={ariaLabel} data-testid={testId}>{children}</Link>;
  }

  const trigger = (
    <button type="button" className={className} aria-label={ariaLabel} aria-haspopup={asMenu ? "menu" : "dialog"}
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
            className="rpc-menu" data-testid="menu-create">
            {options.filter(o => !o.mobileOnly).map(o => (
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
        <DialogPrimitive.Content className="rpc-sheet" aria-describedby={undefined} data-testid="sheet-create">
          <div className="rpc-sheet-head">
            <DialogPrimitive.Title className="rpc-sheet-title">Create</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rpc-close" aria-label="Close create menu" data-testid="button-close-create">
              <X size={20} aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <ul>
            {options.map(o => (
              <li key={o.type}>
                <Link href={`/create?type=${o.type}`} className="rpc-sheet-item" onClick={() => setOpen(false)}
                  data-testid={`sheet-create-${o.type}`}>
                  <span className="rpc-sheet-text">
                    <span className="rpc-sheet-label">{o.label}</span>
                    {o.description && <span className="rpc-sheet-desc">{o.description}</span>}
                  </span>
                  <o.icon size={19} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
