import { useState } from "react";

/** Real photo when present, otherwise black circle with yellow initials. No story ring. */
export function SupporterAvatar({ avatarUrl, initials, size = 22, className = "", testId }: {
  avatarUrl?: string | null; initials?: string | null; size?: number; className?: string; testId?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const showImg = !!avatarUrl && failed !== avatarUrl;
  return (
    <span className={`rp-sav ${className}`} aria-hidden data-testid={testId}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.36)) }}>
      {showImg ? <img src={avatarUrl!} alt="" onError={() => setFailed(avatarUrl!)} /> : (initials || "").slice(0, 2).toUpperCase()}
    </span>
  );
}
