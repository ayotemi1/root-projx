import { appFetch as fetch, userErrorMessage } from "@/lib/error-feedback";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE } from "@/lib/api";

type Stage = "checking" | "ready" | "invalid" | "unavailable" | "done";

export default function ResetPasswordPage() {
  // Keep the action code only in component memory; never storage or analytics.
  const [code] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "resetPassword" ? params.get("oobCode") ?? "" : "";
  });
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function action(newPassword?: string) {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oobCode: code, ...(newPassword !== undefined ? { newPassword } : {}) }),
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || "Please try again."), { code: data.code });
  }

  function fail(err: unknown, verifying: boolean) {
    const value = err as { message?: string; code?: string };
    setError(userErrorMessage(value, "reset your password"));
    if (value.code === "RESET_LINK_EXPIRED" || value.code === "RESET_LINK_INVALID") setStage("invalid");
    else if (verifying) setStage("unavailable");
  }

  async function verify() {
    if (!code) {
      setStage("invalid");
      setError("This reset link is missing or invalid. Request a new one.");
      return;
    }
    setStage("checking"); setError("");
    try { await action(); setStage("ready"); } catch (err) { fail(err, true); }
  }

  useEffect(() => {
    // Remove sensitive query parameters before subsequent navigation/telemetry.
    window.history.replaceState(window.history.state, "", window.location.pathname);
    void verify();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (password !== confirmation) { setError("The passwords don't match."); return; }
    setBusy(true);
    try {
      await action(password);
      setPassword(""); setConfirmation(""); setStage("done");
    } catch (err) { fail(err, false); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <Card className="w-full max-w-sm shadow-md border-border">
        <CardHeader><CardTitle className="text-2xl">
          {stage === "done" ? "Password changed" : stage === "invalid" ? "You need a new reset link" : "Choose a new password"}
        </CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {stage === "checking" && <p role="status">Checking your reset link…</p>}
          {stage === "invalid" && <>
            <p className="text-sm text-muted-foreground">Reset links expire for your security and can only be used once. You can request another email and try again.</p>
            <Link href="/forgot-password" className="block text-primary font-semibold">Send a new reset link</Link>
          </>}
          {stage === "unavailable" && <Button onClick={() => void verify()}>Try again</Button>}
          {stage === "ready" && <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" minLength={6} maxLength={4096}
                required disabled={busy} value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground">Use at least 6 characters. A longer, unique password is safer.</p>
            <div className="space-y-1.5"><Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" minLength={6} maxLength={4096}
                required disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
            </div>
            <Button className="w-full" type="submit" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
          </form>}
          {stage === "done" && <p role="status">Your password has been changed. Sign in with your new password.</p>}
          <Link href="/login" className="block text-center text-sm text-primary font-semibold">Back to sign in</Link>
        </CardContent>
      </Card>
    </div>
  );
}
