import { userErrorMessage } from "@/lib/error-feedback";
import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight } from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);

  const prefillEmail = params.get("email") ?? "";
  const nextPath = params.get("next") ?? "/feed";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefillEmail);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name || !email || !password) {
      setError("Name, email and password are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        accountType: "supporter",
      });
      navigate(nextPath);
    } catch (err: unknown) {
      setError(userErrorMessage(err, "create your account"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-16">
      <div className="text-center mb-8">
        <img
          src="/logo-stylised.png"
          alt="Root ProjX"
          className="mx-auto mb-2"
          style={{ height: "120px", width: "auto", objectFit: "contain" }}
        />
      </div>

      <Card className="w-full max-w-sm shadow-md border-border">
        <CardHeader className="pb-4 text-center">
          <CardTitle className="text-2xl font-extrabold text-foreground">Become a Supporter</CardTitle>
          <CardDescription className="text-base text-muted-foreground mt-2">
            Create an account to instantly discover, follow, and fund verified grassroots organisations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md px-3 py-2 text-sm" data-testid="error-message">
                {error}
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" placeholder="Marcus Garvey" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
            </div>
            <div className="space-y-1.5 text-left">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-email" />
            </div>
            <div className="space-y-1.5 text-left">
              <Label htmlFor="phone">Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="phone" type="tel" placeholder="+44 7700 000000" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-phone" />
            </div>
            <div className="space-y-1.5 text-left">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-password" />
            </div>

            <Button type="submit" className="w-full font-bold text-base mt-2" disabled={loading} data-testid="button-submit-register">
              {loading ? "Creating account…" : "Create account"}
            </Button>

            <div className="pt-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-bold hover:underline" data-testid="link-login">
                  Sign in
                </Link>
              </p>

              <div className="h-px bg-border my-2" />

              <p className="text-sm text-muted-foreground">
                Representing an organisation?
              </p>
              <Link href="/onboarding" className="inline-flex items-center gap-1 text-sm font-bold text-[#B50000] hover:text-[#7A0000] transition-colors" data-testid="link-onboarding">
                Apply to join <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
