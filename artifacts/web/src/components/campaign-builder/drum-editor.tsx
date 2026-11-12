import { Plus, Trash2, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { DrumUpdate } from "@/lib/api";
import { FieldBlock, MediaUpload } from "./fields";
import { MAX_DRUM_UPDATES, drumBlockReason, emptyDrumUpdate } from "./model";
import type { StepProps } from "./steps";
import { DRUM_COST_USD, DRUM_TARGET_USD, DRUM_TOTAL } from "@/lib/drum-experience";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

/** Appearance selector: supporter wall (default) or Drum Life build. */
export function AppearanceSelector({ d, update }: Pick<StepProps, "d" | "update">) {
  const drum = d.drumExperience.enabled;
  const blocked = drumBlockReason(d);
  const choose = (on: boolean) => update((p) => ({ drumExperience: { ...p.drumExperience, enabled: on } }));
  return (
    <section className="space-y-3">
      <div>
        <h3 id="cb-appearance-q" className="text-sm font-semibold">Campaign appearance</h3>
        <p className="text-xs text-muted-foreground">How progress is drawn at the top of your page.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-labelledby="cb-appearance-q">
        <button type="button" role="radio" aria-checked={!drum} onClick={() => choose(false)} data-testid="button-appearance-wall"
          className={`text-left p-3.5 rounded-xl border-2 ${!drum ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
          <span className="block font-bold text-sm">Supporter wall</span>
          <span className="block text-xs text-muted-foreground mt-0.5">Every donor adds one unit.</span>
        </button>
        <button type="button" role="radio" aria-checked={drum} disabled={!!blocked && !drum} onClick={() => choose(true)} data-testid="button-appearance-drum"
          aria-describedby="cb-drum-note"
          className={`text-left p-3.5 rounded-xl border-2 disabled:opacity-55 disabled:cursor-not-allowed ${drum ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
          <span className="block font-bold text-sm">Drum build</span>
          <span className="block text-xs text-muted-foreground mt-0.5">{DRUM_TOTAL} drums at US${DRUM_COST_USD}, filled from money raised.</span>
        </button>
      </div>
      <p id="cb-drum-note" className={`text-xs flex gap-1.5 ${blocked ? "text-amber-800" : "text-muted-foreground"}`} data-testid="text-drum-note">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        {blocked
          ? drum ? `${blocked} Your page cannot save the drum build until this is fixed.` : blocked
          : `US$${DRUM_COST_USD} per drum, ${DRUM_TOTAL} drums including the reclaimed-wood centre, US$${DRUM_TARGET_USD.toLocaleString("en-US")} for all. Includes credit to Humanity Ova Vanity for the centre drum. Your goal is not changed.`}
      </p>
    </section>
  );
}

export function DrumUpdatesEditor({ d, update, token }: Pick<StepProps, "d" | "update" | "token">) {
  const ups = d.drumExperience.updates;
  const set = (id: string, patch: Partial<DrumUpdate>) =>
    update((p) => ({ drumExperience: { ...p.drumExperience, updates: p.drumExperience.updates.map((u) => (u.id === id ? { ...u, ...patch } : u)) } }));
  return (
    <section className="rounded-xl border border-border p-4 space-y-4" data-testid="section-drum-updates">
      <div>
        <h3 className="text-sm font-semibold">Centre drum build updates</h3>
        <p className="text-xs text-muted-foreground">Shown when someone opens the centre drum. Add a date and text or a photo to show an update publicly. Unfinished rows stay in your draft. Up to {MAX_DRUM_UPDATES}.</p>
      </div>
      {ups.map((u, i) => (
        <div key={u.id} className="rounded-xl border border-border p-3 space-y-3" data-testid={`row-drum-update-${i}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">Update {i + 1}</p>
            <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground" aria-label={`Remove update ${i + 1}`} data-testid={`button-remove-drum-update-${i}`}
              onClick={() => update((p) => ({ drumExperience: { ...p.drumExperience, updates: p.drumExperience.updates.filter((x) => x.id !== u.id) } }))}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <FieldBlock label="Date" htmlFor={`cb-drum-date-${i}`}>
            <Input id={`cb-drum-date-${i}`} type="date" value={u.date} onChange={(e) => set(u.id, { date: e.target.value })} className="max-w-[220px]" data-testid={`input-drum-date-${i}`} />
          </FieldBlock>
          <FieldBlock label="What happened" htmlFor={`cb-drum-text-${i}`}>
            <Textarea id={`cb-drum-text-${i}`} rows={3} maxLength={5000} value={u.text} onChange={(e) => set(u.id, { text: e.target.value })} placeholder="Describe the latest work on the reclaimed-wood drum." data-testid={`input-drum-text-${i}`} />
          </FieldBlock>
          <FieldBlock label="Photo (optional)">
            <MediaUpload id={`drum-photo-${u.id}`} label="Upload a photo" accept={IMAGE_ACCEPT} url={u.photoUrl} token={token} aspect="aspect-[4/3]"
              onUploaded={(url) => set(u.id, { photoUrl: url })} onRemove={() => set(u.id, { photoUrl: null })} />
          </FieldBlock>
          <FieldBlock label="Caption (optional)" htmlFor={`cb-drum-caption-${i}`}>
            <Input id={`cb-drum-caption-${i}`} maxLength={500} value={u.caption} onChange={(e) => set(u.id, { caption: e.target.value })} data-testid={`input-drum-caption-${i}`} />
          </FieldBlock>
        </div>
      ))}
      {ups.length < MAX_DRUM_UPDATES && (
        <Button type="button" variant="outline" size="sm" data-testid="button-add-drum-update"
          onClick={() => update((p) => ({ drumExperience: { ...p.drumExperience, updates: [...p.drumExperience.updates, emptyDrumUpdate()].slice(0, MAX_DRUM_UPDATES) } }))}>
          <Plus className="w-4 h-4 mr-1" /> Add a build update
        </Button>
      )}
    </section>
  );
}
