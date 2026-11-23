import { useState } from "react";
import { Check } from "lucide-react";
import * as api from "@/lib/api";

export function NewsletterForm({ dark = false, button = "Sign up", id }: { dark?: boolean; button?: string; id: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setStatus("loading");
    try { await api.subscribeNewsletter({ email }); setStatus("success"); setEmail(""); }
    catch { setStatus("error"); }
  }
  if (status === "success") return (
    <p className={`inline-flex items-center gap-2 border px-4 py-3 text-[15px] font-bold ${dark ? "border-[#F3BF2C] text-[#F3BF2C]" : "border-[#17100F] bg-[#FBF8F2]"}`} role="status" data-testid={`status-${id}-success`}>
      <Check className="w-4 h-4" /> You're on the list. Thank you.
    </p>
  );
  return (
    <div>
      <form onSubmit={submit} className="flex gap-2 max-w-[460px]">
        <label htmlFor={id} className="sr-only">Email address</label>
        <input id={id} type="email" required value={email} onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }} placeholder="you@example.com"
          className={`flex-1 min-w-0 h-12 px-4 text-[16px] focus:outline-none ${dark ? "bg-transparent border border-[#F4EFE6]/40 text-[#F4EFE6] placeholder:text-[#F4EFE6]/45 focus:border-[#F3BF2C]" : "bg-[#FBF8F2] border border-[#17100F] focus:outline-2 focus:outline-[#F3BF2C]"}`} data-testid={`input-${id}`} />
        <button type="submit" disabled={status === "loading" || !email} className="rp-btn rp-btn-yellow h-12 shrink-0 whitespace-nowrap" data-testid={`button-${id}`}>
          {status === "loading" ? "Sending…" : button}
        </button>
      </form>
      {status === "error" && <p className={`mt-3 text-[14px] ${dark ? "text-[#F3BF2C]" : "text-[#CA0813]"}`} role="alert">We couldn't sign you up just now. Please try again in a moment.</p>}
    </div>
  );
}
