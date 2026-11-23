import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { startMessageConversation, type MessageRecipient } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PERSONAL, authInit, errorStatus, invalidateMessaging, useMessagingContext } from "@/components/inbox/use-messaging";
import { GENERIC_ERROR } from "@/lib/bookmarks";

type Choice = { id: string; label: string; sub: string };

/**
 * Starts (or reopens) a conversation from a profile. Sender identity comes from the
 * signed-in account's actual messaging context; when more than one is allowed the
 * person chooses explicitly.
 */
export function StartMessageButton({ recipient, recipientName, className = "rp-btn rp-btn-ghost", testId = "button-message", onGuest, disabled, children }: {
  recipient: MessageRecipient; recipientName: string; className?: string; testId?: string;
  onGuest?: () => void; disabled?: boolean; children?: ReactNode;
}) {
  const { isAuthenticated, token, user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const ctx = useMessagingContext();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choices: Choice[] = [];
  if (ctx.data?.personal) choices.push({ id: PERSONAL, label: user?.name ? `${user.name} (personal)` : "Personal", sub: "From your own account" });
  for (const o of ctx.data?.organisations ?? []) {
    if (recipient.kind === "organisation" && o.id === recipient.id) continue;
    choices.push({ id: o.id, label: o.name, sub: "As this organisation" });
  }
  const ownOrg = user?.accountType === "organisation" ? String(user.id) : null;
  const fallback = choices.find(c => c.id === ownOrg)?.id ?? choices.find(c => c.id === PERSONAL)?.id ?? choices[0]?.id ?? null;

  async function start(as: string) {
    if (!token || busy) return;
    setBusy(true); setError(null);
    const asOrgId = as === PERSONAL ? undefined : as;
    try {
      const conv = await startMessageConversation({ recipient, ...(asOrgId ? { asOrgId } : {}) }, authInit(token));
      void invalidateMessaging(qc, token);
      setOpen(false);
      navigate(`/inbox?conversation=${encodeURIComponent(conv.id)}${asOrgId ? `&orgId=${encodeURIComponent(asOrgId)}` : ""}`);
    } catch (e) {
      const s = errorStatus(e);
      setError(s === 403 || s === 404 ? "You can't message this account." : GENERIC_ERROR);
    } finally { setBusy(false); }
  }

  function click() {
    if (!isAuthenticated) { if (onGuest) onGuest(); else navigate("/login"); return; }
    if (ctx.isError) { void ctx.refetch(); setError(GENERIC_ERROR); return; }
    if (!ctx.data) return;
    if (choices.length === 0) { setError("You can't message this account."); return; }
    if (choices.length === 1) { void start(choices[0]!.id); return; }
    setPick(fallback); setError(null); setOpen(true);
  }

  return (
    <>
      <button type="button" className={className} onClick={click} disabled={disabled || busy || (isAuthenticated && ctx.isLoading)} data-testid={testId}>
        {children ?? <><MessageSquare className="w-4 h-4" aria-hidden /> {busy ? "Opening" : "Message"}</>}
      </button>
      {error && !open && <p role="alert" className="basis-full text-[13px] text-[#CA0813] mt-1" data-testid={`${testId}-error`}>{error}</p>}
      <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md bg-[#FBF8F2] border border-[#17100F] rounded-none p-6" data-testid="dialog-message-identity">
          <DialogTitle className="rp-display text-[30px]">Message {recipientName}</DialogTitle>
          <DialogDescription className="text-[14px] text-[#17100F]/70">Choose who this message is from. They'll see that name on every message.</DialogDescription>
          <fieldset className="mt-2 border-t border-[#17100F]">
            <legend className="sr-only">Send as</legend>
            {choices.map(c => (
              <label key={c.id} className={`flex items-center gap-3 py-3 px-2 border-b border-[#17100F]/15 cursor-pointer ${pick === c.id ? "bg-[#F3BF2C]/30" : "hover:bg-[#17100F]/5"}`} data-testid={`option-send-as-${c.id}`}>
                <input type="radio" name="send-as" value={c.id} checked={pick === c.id} onChange={() => setPick(c.id)} className="accent-[#17100F] w-4 h-4" />
                <span className="min-w-0"><span className="block font-bold text-[15px] truncate">{c.label}</span><span className="rp-label !text-[10px] text-[#17100F]/60">{c.sub}</span></span>
              </label>
            ))}
          </fieldset>
          {error && <p role="alert" className="text-[13px] text-[#CA0813]" data-testid="text-message-identity-error">{error}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className="rp-btn rp-btn-ghost !min-h-10 !text-[14px]" onClick={() => setOpen(false)} disabled={busy} data-testid="button-message-identity-cancel">Cancel</button>
            <button type="button" className="rp-btn rp-btn-yellow !min-h-10 !text-[14px]" disabled={!pick || busy} onClick={() => pick && void start(pick)} data-testid="button-message-identity-continue">{busy ? "Opening" : "Continue"}</button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
