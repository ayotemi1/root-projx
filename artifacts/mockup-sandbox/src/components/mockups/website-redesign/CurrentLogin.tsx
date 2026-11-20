import "./_group.css";
import { useState } from "react";
import { MockupLink as Link } from "@/lib/mockup-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function useAuth() {
  return {
    login: async (_email: string, _password: string) => ({ accountType: "individual" }),
  };
}

function useLocation(): [string, (path: string) => void] {
  return ["/login", () => undefined];
}

function userErrorMessage(_error: unknown, _action: string) {
  return "We couldn't sign you in. Please try again.";
}

export function CurrentLogin() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Email and password are required."); return; }
    setLoading(true);
    setError("");
    try {
      const loggedInUser = await login(email.trim().toLowerCase(), password);
      if (loggedInUser.accountType === "organisation") {
        navigate("/dashboard");
      } else {
        navigate("/feed");
      }
    } catch (err: unknown) {
      setError(userErrorMessage(err, "sign in"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-16">
      {/* Logo header */}
      <div className="text-center mb-8">
        <img src="/images/logo-stylised.png" alt="Root ProjX" className="h-24 w-auto object-contain mx-auto" />
        <p className="text-muted-foreground mt-2 text-sm">Connecting diaspora with grassroots change.</p>
      </div>

      <Card className="w-full max-w-sm shadow-md border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl">Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md px-3 py-2 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-primary font-semibold hover:underline" data-testid="link-forgot-password">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary font-semibold hover:underline">
                Create one
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
