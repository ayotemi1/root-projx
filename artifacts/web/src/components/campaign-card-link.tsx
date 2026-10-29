import type { ReactNode } from "react";
import { Link } from "wouter";

/** A full-card link, with separate controls layered above it (never nested). */
export function CampaignCardLink({ href, name, children }: {
  href?: string | null;
  name: string;
  children: ReactNode;
}) {
  return <div className="relative border border-border rounded-xl overflow-hidden bg-white">
    {href && <Link href={href} aria-label={`Open campaign: ${name}`}
      className="absolute inset-0 z-[1] rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary" />}
    {children}
  </div>;
}
