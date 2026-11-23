import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Lock } from "lucide-react";
import { SupporterInvolvementInputActivity, type SupporterInvolvementInputActivity as Activity } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import * as api from "@/lib/api";
import { GENERIC_ERROR } from "@/lib/bookmarks";
import { useToast } from "@/hooks/use-toast";
import { addInvolvement, newEntryId, refreshShowcase } from "@/lib/supporter-showcase";

const ACTIVITIES = Object.values(SupporterInvolvementInputActivity) as Activity[];

export function AddInvolvementDialog({ open, onOpenChange, token, profileIsPublic }: {
  open: boolean; onOpenChange: (v: boolean) => void; token: string; profileIsPublic: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const idRef = useRef(newEntryId());
  const [project, setProject] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity>("Volunteered");
  const [details, setDetails] = useState("");
  const [when, setWhen] = useState("");
  const [shared, setShared] = useState(true);
  const [suggest, setSuggest] = useState(false);
  const [error, setError] = useState("");

  const orgs = useQuery({ queryKey: ["organisations", "post-link"], queryFn: () => api.getOrganisations(), staleTime: 5 * 60_000, enabled: open });
  const matches = useMemo(() => {
    const q = project.trim().toLowerCase();
    if (!q || orgId) return [];
    return (orgs.data ?? []).filter(o => o.name.toLowerCase().includes(q)).slice(0, 6);
  }, [project, orgId, orgs.data]);

  const add = useMutation({
    mutationFn: () => addInvolvement({
      id: idRef.current, organisationId: orgId, projectName: project.trim(), activity,
      details: details.trim(), when: when.trim(), shared,
    }, token),
    onSuccess: async () => {
      await refreshShowcase(qc);
      toast({ title: "Added to your involvement" });
      idRef.current = newEntryId();
      setProject(""); setOrgId(null); setActivity("Volunteered"); setDetails(""); setWhen(""); setShared(true); setError("");
      onOpenChange(false);
    },
    // Form and id are kept so a retry is idempotent.
    onError: () => setError(GENERIC_ERROR),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (add.isPending) return;
    if (!project.trim()) return setError("Add the organisation or project.");
    if (!when.trim()) return setError("Add roughly when, e.g. Summer 2025.");
    setError("");
    add.mutate();
  }

  const label = "rp-label !text-[11px] text-[#17100F]/80 block mb-1.5";
  return (
    <Dialog open={open} onOpenChange={v => !add.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md p-0 gap-0 bg-[#FBF8F2] border-[#17100F] top-[calc(50%-2.25rem)] md:top-1/2 max-h-[calc(100dvh-8.5rem)] md:max-h-[90dvh] overflow-y-auto" data-testid="dialog-add-involvement">
        <DialogHeader className="px-5 py-4 border-b border-[#17100F]/15 text-left">
          <DialogTitle className="rp-label !text-[12px] !font-medium" style={{ fontFamily: "var(--app-font-mono)" }}>Add involvement</DialogTitle>
          <DialogDescription className="sr-only">Record something you did with an organisation or project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          <div className="relative">
            <label className={label} htmlFor="inv-project">Organisation or project</label>
            <input id="inv-project" className="rp-field !h-11 !text-[15px]" value={project} maxLength={120} autoComplete="off"
              onChange={e => { setProject(e.target.value); setOrgId(null); setSuggest(true); }}
              onFocus={() => setSuggest(true)} onBlur={() => setTimeout(() => setSuggest(false), 150)}
              data-testid="input-involvement-project" />
            {suggest && matches.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 mt-1 bg-[#FBF8F2] border border-[#17100F] max-h-56 overflow-y-auto" role="listbox">
                {matches.map(o => (
                  <li key={o._id}>
                    <button type="button" className="w-full text-left px-3 py-2.5 min-h-11 hover:bg-[#F3BF2C]/30 text-[15px]"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setProject(o.name); setOrgId(o._id); setSuggest(false); }} data-testid={`option-involvement-org-${o._id}`}>
                      <span className="font-semibold">{o.name}</span>
                      <span className="rp-label !text-[10px] text-[#17100F]/55 block">{[o.category, o.country].filter(Boolean).join(" · ")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[12px] text-[#17100F]/60 mt-1" data-testid="status-involvement-link">
              {orgId ? "Linked to this organisation on Root ProjX." : project.trim() ? "Not linked. Shown as a project outside Root ProjX." : "Pick a Root ProjX organisation, or type any group or project."}
            </p>
          </div>

          <div>
            <span className={label}>What did you do?</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup">
              {ACTIVITIES.map(a => (
                <button key={a} type="button" role="radio" aria-checked={activity === a} onClick={() => setActivity(a)}
                  className={`min-h-9 px-3 rounded-full border text-[13px] transition-colors ${activity === a ? "bg-[#17100F] text-[#FBF8F2] border-[#17100F]" : "border-[#17100F]/25 hover:border-[#17100F]"}`}
                  data-testid={`chip-activity-${a.replace(/\s+/g, "-").toLowerCase()}`}>{a}</button>
              ))}
            </div>
            {activity === "Gave" && <p className="text-[12px] text-[#17100F]/60 mt-1.5">A note only. It doesn’t record or show any donation or amount.</p>}
          </div>

          <div>
            <label className={label} htmlFor="inv-details">Details (optional)</label>
            <input id="inv-details" className="rp-field !h-11 !text-[15px]" value={details} maxLength={500} onChange={e => setDetails(e.target.value)} data-testid="input-involvement-details" />
          </div>
          <div>
            <label className={label} htmlFor="inv-when">When</label>
            <input id="inv-when" className="rp-field !h-11 !text-[15px]" value={when} maxLength={80} placeholder="Summer 2025" onChange={e => setWhen(e.target.value)} data-testid="input-involvement-when" />
          </div>

          <fieldset>
            <legend className={label}>Who can see this</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {[{ v: true, t: "On my profile", I: Globe }, { v: false, t: "Only me", I: Lock }].map(({ v, t, I }) => (
                <button key={t} type="button" aria-pressed={shared === v} onClick={() => setShared(v)}
                  className={`min-h-11 border px-3 text-[14px] inline-flex items-center gap-2 ${shared === v ? "border-[#17100F] bg-[#F3BF2C]/30 font-semibold" : "border-[#17100F]/25"}`}
                  data-testid={`button-involvement-${v ? "shared" : "private"}`}><I className="w-4 h-4" />{t}</button>
              ))}
            </div>
            <p className="text-[12px] text-[#17100F]/70 mt-1.5 flex gap-1.5" data-testid="text-involvement-privacy">
              {!shared ? "Only you will see this entry."
                : profileIsPublic ? "Shows on your profile’s Involvement tab, which anyone with your link can see."
                : "Your profile is hidden right now, so this stays visible only to you until you make your profile public."}
            </p>
          </fieldset>

          {error && <p role="alert" className="text-[14px] text-[#CA0813] font-semibold" data-testid="text-involvement-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-3 border-t border-[#17100F]/15 -mx-5 px-5">
            <button type="button" className="rp-btn rp-btn-ghost !min-h-11" onClick={() => onOpenChange(false)} disabled={add.isPending} data-testid="button-involvement-cancel">Cancel</button>
            <button type="submit" className="rp-btn rp-btn-yellow !min-h-11" disabled={add.isPending} data-testid="button-involvement-add">{add.isPending ? "Adding…" : "Add"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
