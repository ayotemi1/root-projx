import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

const COUNTRIES = [
  "Jamaica", "United Kingdom", "United States", "Canada", "Trinidad and Tobago",
  "Barbados", "Guyana", "Grenada", "St Lucia", "Antigua and Barbuda",
  "Bahamas", "Belize", "Dominica", "Haiti", "Nigeria", "Ghana",
  "Kenya", "South Africa", "Other",
];

export default function RegisterPage() {
  const { register } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);

  // Derive form type and pre-fills directly from URL params each render
  // so navigating to/from ?type=org always reflects the current URL.
  const isOrg = params.get("type") === "org";
  const prefillEmail = params.get("email") ?? "";
  const nextPath = params.get("next") ?? "/";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Supporter fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefillEmail);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Organisation extra fields
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [country, setCountry] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [orgPassword, setOrgPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isOrg) {
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
        setError(err instanceof Error ? err.message : "Registration failed.");
      } finally {
        setLoading(false);
      }
    } else {
      if (!orgName || !contactName || !orgEmail || !country || !orgPassword) {
        setError("Organisation name, contact name, email, country and password are required.");
        return;
      }
      if (orgPassword.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      setLoading(true);
      try {
        await register({
          name: contactName.trim(),
          email: orgEmail.trim().toLowerCase(),
          password: orgPassword,
          accountType: "organisation",
          orgName: orgName.trim(),
          country,
          registrationNumber: regNumber.trim() || undefined,
        });
        navigate("/dashboard");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Registration failed.");
      } finally {
        setLoading(false);
      }
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
        <p className="text-muted-foreground mt-2 text-sm">
          {isOrg ? "List your organisation." : "Join the community."}
        </p>
      </div>

      <Card className="w-full max-w-sm shadow-md border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl">
            {isOrg ? "Register your organisation" : "Create account"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md px-3 py-2 text-sm">
                {error}
              </div>
            )}

            {/* Supporter form */}
            {!isOrg && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" placeholder="Marcus Garvey" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="phone" type="tel" placeholder="+44 7700 000000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </>
            )}

            {/* Organisation form */}
            {isOrg && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="orgName">Organisation name</Label>
                  <Input id="orgName" placeholder="e.g. Trench Town Futures" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactName">Contact name</Label>
                  <Input id="contactName" placeholder="Your full name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="orgEmail">Email</Label>
                  <Input id="orgEmail" type="email" autoComplete="email" placeholder="org@example.com" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country">Country</Label>
                  <select
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select country…</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="regNumber">Registration number <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="regNumber" placeholder="Charity / company number" value={regNumber} onChange={(e) => setRegNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="orgPassword">Password</Label>
                  <Input id="orgPassword" type="password" placeholder="Min. 6 characters" value={orgPassword} onChange={(e) => setOrgPassword(e.target.value)} />
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : isOrg ? "Register organisation" : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
