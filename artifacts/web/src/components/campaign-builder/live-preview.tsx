import { useEffect, useRef, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { CampaignPageView } from "@/components/campaign/campaign-page-view";
import type { Campaign, Org } from "@/lib/api";
import { draftToPreviewCampaign, type CampaignDraft } from "./model";

const DEVICE = {
  phone: { w: 390, h: 844 },
  desktop: { w: 1280, h: 900 },
} as const;

export function previewOrganisation(org: Org | null | undefined, fallbackId: string) {
  return {
    _id: org?._id ?? fallbackId, name: org?.name ?? "", country: org?.country ?? "", city: org?.city ?? null,
    category: org?.category ?? "", description: org?.shortDescription || org?.description || "", logo: org?.logo ?? null,
    coverImage: org?.coverImage ?? null, verified: !!org?.verified, shortDescription: org?.shortDescription ?? null,
    team: org?.team ?? null,
  };
}

/**
 * The real shared CampaignPageView at true device width, scaled down to fit
 * the column. Container queries see the device width; fitting hooks measure
 * on-screen rects, so the scale is accounted for.
 */
export function CampaignLivePreview({ d, campaign, org }: { d: CampaignDraft; campaign: Campaign; org?: Org | null }) {
  const [device, setDevice] = useState<"phone" | "desktop">("desktop");
  const frameRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    let last = -1;
    const read = () => {
      const w = el.clientWidth;
      if (Math.abs(w - last) >= 1) { last = w; setAvail(w); }
    };
    read();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(read) : null;
    ro?.observe(el);
    window.addEventListener("resize", read);
    return () => { ro?.disconnect(); window.removeEventListener("resize", read); };
  }, []);

  const { w, h } = DEVICE[device];
  const scale = avail > 0 ? Math.min(1, avail / w) : 0;
  const viewH = Math.min(720, h * scale + (device === "desktop" ? 260 : 0));
  const preview = draftToPreviewCampaign(d, campaign);

  return (
    <div className="@[900px]:sticky @[900px]:top-4 min-w-0" data-testid="block-story-live-preview">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
        <span className="font-mono text-[12px] font-bold uppercase tracking-[0.1em]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Live preview · exactly as donors see it</span>
        <span className="inline-flex border-[1.5px] border-[#17100F]" role="group" aria-label="Preview size">
          {(["phone", "desktop"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setDevice(v)} aria-pressed={device === v}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold ${device === v ? "bg-[#17100F] text-[#FFFDF9]" : "bg-[#FFFDF9] text-[#17100F]"}`}
              data-testid={`button-story-preview-${v}`}>
              {v === "phone" ? <Smartphone className="w-3.5 h-3.5" aria-hidden="true" /> : <Monitor className="w-3.5 h-3.5" aria-hidden="true" />}
              {v === "phone" ? "Phone" : "Desktop"}
            </button>
          ))}
        </span>
      </div>
      <div className="border-[1.5px] border-[#17100F] bg-[#EDE4D6] p-4 overflow-hidden">
        <div ref={frameRef} className="w-full">
          {scale > 0 && (
            <div className="mx-auto border-[1.5px] border-[#17100F] bg-[#F4EFE6] overflow-hidden relative"
              style={{ width: w * scale, height: viewH }}>
              <div className="absolute left-0 top-0 overflow-y-auto overflow-x-hidden"
                style={{ width: w, height: viewH / scale, transform: `scale(${scale})`, transformOrigin: "0 0" }}
                data-testid={`frame-story-preview-${device}`}>
                <CampaignPageView campaign={preview} organisation={previewOrganisation(org, "")} preview layout={device} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
