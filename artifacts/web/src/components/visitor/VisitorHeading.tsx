export function VisitorHeading({ label, title, intro }: { label: string; title: string; intro?: string }) {
  return (
    <header className="rp-rise" data-testid="visitor-heading">
      <p className="rp-label !text-[12px] text-[#CA0813]">{label}</p>
      <h1 className="rp-display text-[48px] md:text-[88px] text-[#17100F] mt-3">{title}</h1>
      {intro && <p className="mt-5 text-[16px] md:text-[17px] leading-relaxed text-[#17100F]/70 max-w-[720px]">{intro}</p>}
    </header>
  );
}
