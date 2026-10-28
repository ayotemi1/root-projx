import { useState } from "react";
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError("");
    try {
      const result = await requestPasswordReset(email.trim().toLowerCase());
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't request a reset link. Please try again.");
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
          {message ? (
            <div className="space-y-4">
              <p role="status" className="text-sm leading-relaxed" data-testid="password-reset-sent">{message}</p>
              <p className="text-sm text-muted-foreground">
                Open the link in the email to choose a new password, then return here to sign in.
                It works for both organisation and supporter accounts.
              </p>
              <Button variant="outline" className="w-full" onClick={() => { setMessage(""); setError(""); }}>
                Try a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the email you use to sign in. We'll send a secure link so you can choose a new password.
              </p>
              {error && <p role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md px-3 py-2 text-sm">{error}</p>}
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Account email</Label>
                <Input id="reset-email" type="email" autoComplete="email" required maxLength={254}
                  value={email} onChange={e => setEmail(e.target.value)} disabled={loading}
                  placeholder="you@example.com" data-testid="input-reset-email" />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email.trim()} data-testid="button-send-reset">
                {loading ? "Sending…" : "Send reset link"}
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
