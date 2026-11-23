import { useEffect } from "react";
import { Link } from "wouter";
import { EyeOff } from "lucide-react";

export function ShowcaseSkeleton() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-10 animate-pulse" data-testid="status-profile-loading">
      <div className="flex gap-6 items-start">
        <div className="w-24 h-24 sm:w-[124px] sm:h-[124px] rounded-full bg-[#17100F]/10" />
        <div className="flex-1 space-y-3"><div className="h-10 w-2/3 bg-[#17100F]/10" /><div className="h-10 w-48 bg-[#17100F]/10" /><div className="h-6 w-64 bg-[#17100F]/10" /></div>
      </div>
      <div className="h-4 w-1/2 bg-[#17100F]/10 mt-8" />
      <div className="h-12 bg-[#17100F]/5 border-b border-[#17100F]/20 mt-8" />
      <div className="aspect-[4/3] max-h-[360px] bg-[#17100F]/10 mt-6" />
    </div>
  );
}

export function ShowcaseError({ onRetry, what = "this profile" }: { onRetry: () => void; what?: string }) {
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center" role="alert" data-testid="status-profile-error">
      <h1 className="rp-display text-[40px]">Couldn’t load {what}</h1>
      <p className="text-[#17100F]/70 mt-3">Check your connection and try again.</p>
      <button type="button" className="rp-btn rp-btn-yellow mt-6" onClick={onRetry} data-testid="button-retry-profile">Try again</button>
    </div>
  );
}

export function HiddenProfile({ preview, onExitPreview }: { preview?: boolean; onExitPreview?: () => void }) {
  useEffect(() => { document.title = "Profile not available · Root ProjX"; }, []);
  return (
    <div className="max-w-md mx-auto px-4 py-24 pb-32 text-center" data-testid="status-profile-hidden-screen">
      {preview && <p className="rp-label !text-[11px] bg-[#17100F] text-[#FBF8F2] inline-block px-2 py-1 mb-6">Preview</p>}
      <div className="w-16 h-16 rounded-full border border-[#17100F] grid place-items-center mx-auto mb-6"><EyeOff className="w-7 h-7" /></div>
      <h1 className="rp-display text-[40px]">This profile isn’t public</h1>
      <p className="text-[#17100F]/70 mt-3">
        {preview ? "Your profile is hidden, so visitors see exactly this. Turn on your public profile in your account to share it."
          : "The supporter has kept this profile private, or the link is no longer in use."}
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-7">
        {preview ? <>
          <button type="button" className="rp-btn rp-btn-ghost" onClick={onExitPreview} data-testid="button-exit-preview">Exit preview</button>
          <Link href="/account" className="rp-btn rp-btn-yellow" data-testid="link-make-public">Open account settings</Link>
        </> : <Link href="/discover" className="rp-btn rp-btn-yellow" data-testid="link-discover">Discover organisations</Link>}
      </div>
    </div>
  );
}
