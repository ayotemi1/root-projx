import { BadgeCheck } from "lucide-react";

export function VerifiedTick({ small = false }: { small?: boolean }) {
  return (
    <span className="pv-tick" title="Verified organisation" style={{ marginLeft: small ? 3 : 0, verticalAlign: "-2px" }}>
      <BadgeCheck size={small ? 13 : 15} aria-hidden />
      <span className="sr-only">Verified</span>
    </span>
  );
}
