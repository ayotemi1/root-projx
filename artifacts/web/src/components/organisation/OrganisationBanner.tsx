import { useState } from "react";
import "./organisation-banner.css";

/** Reuses the saved cover in public, donor-preview and dashboard profiles. */
export function OrganisationBanner({ src, name }: { src?: string | null; name: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div className="organisation-banner" data-testid="org-profile-banner">
      {src && failedUrl !== src && (
        <img src={src} alt={`${name} banner`} onError={() => setFailedUrl(src)} data-testid="img-org-banner" />
      )}
    </div>
  );
}
