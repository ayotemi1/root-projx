import { userErrorMessage } from "@/lib/error-feedback";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestPasswordReset } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [retryIn, setRetryIn] = useState(0);

  useEffect(() => {
    if (!retryIn) return;
    const timer = window.setTimeout(() => setRetryIn(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [retryIn]);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (loading || retryIn > 0) return;
    setLoading(true); setError("");
    try {
      const result = await requestPasswordReset(email.trim().toLowerCase());
      setMessage(result.message);
      setRetryIn(60);
    } catch (err) {
      setError(userErrorMessage(err, "request a new password reset link"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-16">
      <div className="text-center mb-8">
        <img src="/logo-stylised.png" alt="Root ProjX" className="h-24 w-auto object-contain mx-auto" />
      </div>
      <Card className="w-full max-w-sm shadow-md border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl">Reset your password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md px-3 py-2 text-sm">{error}</p>}
          {message ? (
            <div className="space-y-4">
              <p role="status" className="text-sm leading-relaxed" data-testid="password-reset-sent">{message}</p>
              <p className="text-sm text-muted-foreground">
                Open the link in the email to choose a new password, then return here to sign in.
                It works for both organisation and supporter accounts.
              </p>
              <p className="text-sm text-muted-foreground">
                Link expired or already used? Request a fresh one below. Check your spam folder and use the newest email.
              </p>
              <Button className="w-full" disabled={loading || retryIn > 0} onClick={() => void submit()} data-testid="button-resend-reset">
                {loading ? "Sending…" : retryIn > 0 ? `Resend in ${retryIn}s` : "Send a new reset link"}
              </Button>
              <Button variant="outline" className="w-full" disabled={loading} onClick={() => { setMessage(""); setError(""); }}>
                Try a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the email you use to sign in. We'll send a secure link so you can choose a new password.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Account email</Label>
                <Input id="reset-email" type="email" autoComplete="email" required maxLength={254}
                  value={email} onChange={e => setEmail(e.target.value)} disabled={loading}
                  placeholder="you@example.com" data-testid="input-reset-email" />
              </div>
              <Button type="submit" className="w-full" disabled={loading || retryIn > 0 || !email.trim()} data-testid="button-send-reset">
                {loading ? "Sending…" : retryIn > 0 ? `Resend in ${retryIn}s` : "Send reset link"}
              </Button>
            </form>
          )}
          <p className="text-center text-sm">
            <Link href="/login" className="text-primary font-semibold hover:underline">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
