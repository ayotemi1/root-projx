import { useState } from "react";

export function OrganisationLogo({ name, logo }: { name: string; logo: string | null }) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const src = logo?.trim() || null;
  return (
    <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
      {src && failedLogo !== src ? (
        <img src={src} alt={`${name} logo`} className="w-full h-full object-contain bg-white"
          loading="lazy" onError={() => setFailedLogo(src)} />
      ) : (
        <span className="text-primary font-bold text-sm" aria-label={`${name} logo unavailable`}>
          {name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase()}
        </span>
      )}
    </div>
  );
}
