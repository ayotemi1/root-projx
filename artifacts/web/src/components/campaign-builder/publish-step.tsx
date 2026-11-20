import { useState } from "react";
import { Link } from "wouter";
import { AlertCircle, CheckCircle2, Monitor, Smartphone, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampaignPageView } from "@/components/campaign/campaign-page-view";
import type { Campaign, CampaignGate, Org } from "@/lib/api";
import { draftToPreviewCampaign, gateHref, type CampaignDraft, type ClientGate } from "./model";

export function PublishStep({
  d, campaign, org, gates, serverGates, publishing, publishError, onPublish, onUnpublish, goToStep, saveBlocked,
}: {
  d: CampaignDraft; campaign: Campaign; org: Org; gates: ClientGate[]; serverGates: CampaignGate[] | null;
  publishing: boolean; publishError: string | null; onPublish: () => void; onUnpublish: () => void;
  goToStep: (s: number) => void; saveBlocked: string | null;
}) {
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const preview = draftToPreviewCampaign(d, campaign);
  const shown: Array<CampaignGate & { href?: string }> = serverGates?.length ? serverGates.map((g) => ({ ...g, href: gateHref(g) })) : gates;
  const live = !!campaign.enabled;
  const organisation = {
    _id: org._id, name: org.name || "Your organisation", country: org.country, city: org.city,
    category: org.category, description: org.shortDescription || org.description, logo: org.logo,
    coverImage: org.coverImage, verified: org.verified,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-secondary/40" role="group" aria-label="Preview size">
          {(["phone", "desktop"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setDevice(v)} aria-pressed={device === v}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${device === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
              data-testid={`button-preview-${v}`} data-tour-id={`campaign-preview-${v}`}>
              {v === "phone" ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
              {v === "phone" ? "Phone" : "Desktop"}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">Preview of your latest draft. Donations and sharing are off here.</span>
      </div>

      <div className="border-[1.5px] border-[#17100F] bg-[#EDE4D6] p-2 sm:p-4 overflow-hidden" data-tour-id="campaign-preview">
        <div className={`mx-auto rounded-xl overflow-auto bg-background shadow-lg border border-border h-[640px] ${device === "phone" ? "w-full max-w-[390px]" : "w-full"}`}>
          <div className={device === "desktop" ? "min-w-[900px]" : ""}>
            <CampaignPageView campaign={preview} organisation={organisation} preview layout={device} />
          </div>
        </div>
      </div>

      <section className="ops-block space-y-4" style={{ borderTopWidth: 4 }} data-tour-id="campaign-publish-gates">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="ops-display uppercase text-2xl leading-none">Ready to publish?</h3>
          {live ? (
            <span className="text-[11px] font-bold px-2 py-0.5 border border-current text-green-800 font-mono uppercase tracking-wider" data-testid="status-live">Live</span>
          ) : (
            <span className="text-[11px] font-bold px-2 py-0.5 border border-current text-muted-foreground font-mono uppercase tracking-wider" data-testid="status-draft">Not live</span>
          )}
          {live && campaign.hasUnpublishedChanges && (
            <span className="text-[11px] font-bold px-2 py-0.5 border border-current text-amber-800 bg-[#F3BF2C]/20 font-mono uppercase tracking-wider" data-testid="status-unpublished-changes">Unpublished changes</span>
          )}
        </div>
        {live && <p className="text-xs text-muted-foreground">Your live page does not change until you publish these edits.</p>}

        {shown.length === 0 ? (
          <p className="text-sm text-green-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Everything donors need is in place.</p>
        ) : (
          <ul className="border-t border-[#DDD5CC]" data-testid="list-publish-gates">
            {shown.map((g) => (
              <li key={g.id} className="flex items-start gap-2 text-sm py-2.5 border-b border-[#DDD5CC]" data-testid={`gate-${g.id}`}>
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="flex-1 min-w-0">{g.message}</span>
                {g.step > 0 ? (
                  <button type="button" onClick={() => goToStep(g.step)} className="text-xs font-bold text-primary whitespace-nowrap hover:underline" data-testid={`link-fix-gate-${g.id}`}>Fix in step {g.step}</button>
                ) : g.href ? (
                  <Link href={g.href} className="text-xs font-bold text-primary whitespace-nowrap hover:underline inline-flex items-center gap-0.5" data-testid={`link-fix-gate-${g.id}`}>Fix <ArrowRight className="w-3 h-3" /></Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {saveBlocked && <p role="alert" className="text-xs text-destructive">{saveBlocked}</p>}
        {publishError && <p role="alert" className="text-sm text-destructive" data-testid="text-publish-error">{publishError}</p>}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={onPublish}
            disabled={publishing || gates.length > 0 || !!saveBlocked || (live && !campaign.hasUnpublishedChanges)}
            className="font-bold h-11 sm:flex-1 bg-[#CA0813] hover:bg-[#CA0813]/90 text-[#FFFDF9]"
            data-testid="button-publish-campaign" data-tour-id="campaign-publish"
          >
            {publishing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving and publishing</> : live ? (campaign.hasUnpublishedChanges ? "Publish changes" : "Live and up to date") : "Publish campaign"}
          </Button>
          {live && (
            <Button variant="outline" onClick={onUnpublish} disabled={publishing} className="h-11" data-testid="button-unpublish-campaign">Unpublish</Button>
          )}
        </div>
      </section>
    </div>
  );
}
