import { Link } from "wouter";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogClose } from "@/components/ui/dialog";

/** No interaction is submitted until the visitor has joined or signed in. */
export function GuestJoinPrompt({ action, onClose }: { action: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!action} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[312px] w-[calc(100vw-2rem)] gap-0 rounded-none border border-[#17100F] bg-[#F4EFE6] p-5 pt-8 text-center [&>button:last-child]:hidden" data-testid="dialog-guest-join">
        <DialogClose className="absolute left-4 top-4 p-2 text-[#17100F]" aria-label="Close" data-testid="button-close-join"><X className="w-4 h-4" /></DialogClose>
        <img src="/logo-stylised.png" alt="Root ProjX" className="h-12 mx-auto object-contain" />
        <DialogTitle className="rp-display text-[34px] text-[#17100F] mt-4">Join the<br />movement</DialogTitle>
        <DialogDescription className="mt-3 text-[13.5px] leading-relaxed text-[#17100F]/80">
          {action === "follow organisations"
            ? "Join Root ProjX to follow organisations and see your impact in real time."
            : <>Join Root ProjX to {action}, follow organisations and see your impact in real time.</>}
        </DialogDescription>
        <Link href="/register" className="rp-btn rp-btn-yellow w-full mt-5 !min-h-[40px] !text-[14px]" data-testid="link-join-prompt-join">Join, it's free</Link>
        <p className="mt-4 text-[14px] text-[#17100F]">Already a supporter? <Link href="/login" className="rp-link-u" data-testid="link-join-prompt-signin">Sign in</Link></p>
      </DialogContent>
    </Dialog>
  );
}
