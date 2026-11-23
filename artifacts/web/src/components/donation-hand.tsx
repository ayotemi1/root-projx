/** One artwork source for SVG icons, editor swatches and the canvas wall. */
export const HANDPRINT_URL = `${(import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "")}/campaign-units/handprint.svg`;

export function DonationHand({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 240 240" fill="currentColor" aria-hidden="true">
    <use href={`${HANDPRINT_URL}#handprint`} />
  </svg>;
}
