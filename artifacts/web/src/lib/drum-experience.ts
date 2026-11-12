import type { Campaign } from "@/lib/api";
import { drumsFunded } from "../../../api-server/src/lib/drum-experience";

export const DRUM_COST_USD = 150;
export const DRUM_TOTAL = 50;
export const DRUM_TARGET_USD = DRUM_COST_USD * DRUM_TOTAL;

/** Drums fully paid for, from the campaign's own verified amountRaised (USD), in cents to avoid float drift. */
export function fundedDrums(amountRaised: number | null | undefined): number {
  return drumsFunded(amountRaised ?? 0, "usd");
}

/** True only for an explicitly enabled, USD, fundraising campaign. */
export function isDrumCampaign(c: Pick<Campaign, "drumExperience" | "currency" | "type">): boolean {
  return c.drumExperience?.enabled === true && c.type === "fundraising" && c.currency === "usd";
}

/** Rings around the centre drum: 12 + 16 + 21 = 49. */
export const DRUM_RINGS = [12, 16, 21] as const;

export interface DrumSpot { n: number; x: number; y: number; r: number; ring: number }

/** Positions in percent of a square. Index 0 is drum #1, the centre. */
export const DRUM_SPOTS: DrumSpot[] = (() => {
  const out: DrumSpot[] = [{ n: 1, x: 50, y: 50, r: 10.5, ring: 0 }];
  const radii = [19, 31, 43.5];
  const sizes = [4.6, 4.3, 4.1];
  let n = 2;
  DRUM_RINGS.forEach((count, ring) => {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (i / count) * Math.PI * 2 + (ring % 2 ? Math.PI / count : 0);
      out.push({ n: n++, x: 50 + Math.cos(a) * radii[ring], y: 50 + Math.sin(a) * radii[ring], r: sizes[ring], ring: ring + 1 });
    }
  });
  return out;
})();

export const DRUM_RIMS = ["#D9A21B", "#3F8A3A", "#C9481E", "#7A3A1C"] as const;
