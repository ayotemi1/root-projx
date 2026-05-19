import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { User, LayoutDashboard, LogOut, Edit2, Heart, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";

function EditProfileDialog({
  open,
  onClose,
  token,
  currentName,
  currentPhone,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  currentName: string;
  currentPhone: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [phone, setPhone] = useState(currentPhone);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!name.trim()) { setErr("Name is required."); return; }
    setSaving(true);
    setErr("");
    try {
      await api.updateProfile({ name: name.trim(), phone: phone.trim() || undefined }, token);
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Update failed.");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {err && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{err}</div>
          )}
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AccountPage() {
  const { user, token, isAuthenticated, logout } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);

  const [portalLoading, setPortalLoading] = useState(false);

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.getProfile(token!),
    enabled: isAuthenticated,
  });

  const followsQ = useQuery({
    queryKey: ["follows", "my"],
    queryFn: () => api.getMyFollows(token!),
    enabled: isAuthenticated,
  });

  const donationsQ = useQuery({
    queryKey: ["donations", "my"],
    queryFn: () => api.getMyDonations(token!),
    enabled: isAuthenticated,
  });

  const profile = profileQ.data ?? user;
  const follows = followsQ.data ?? [];
  const donations = donationsQ.data ?? [];

  async function handleManageSubscriptions() {
    if (!token) return;
    setPortalLoading(true);
    try {
      const { url } = await api.createPortalSession(token);
      window.location.href = url;
    } catch {
      setPortalLoading(false);
      toast({
        title: "Could not open subscription management",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <User className="w-14 h-14 text-muted-foreground/40 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Sign in to your account</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Follow organisations, track donations, and manage your profile.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/login">
            <Button>Sign in</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline">Create account</Button>
          </Link>
        </div>
      </div>
    );
  }

  const initials = profile?.avatarInitials ?? profile?.name.slice(0, 2).toUpperCase() ?? "??";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Profile header */}
      <Card className="border-border shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-extrabold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              {profileQ.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-bold text-foreground">{profile?.name}</h1>
                  <p className="text-muted-foreground text-sm">{profile?.email}</p>
                  <Badge
                    variant="secondary"
                    className="mt-2 bg-accent/20 text-accent-foreground border-accent/30 text-xs font-bold"
                  >
                    {profile?.accountType === "organisation" ? "Organisation" : "Supporter"}
                  </Badge>
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0"
              onClick={() => setEditOpen(true)}
            >
              <Edit2 className="w-4 h-4 mr-1.5" /> Edit
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8">
            <div>
              <div className="text-2xl font-extrabold text-foreground">{follows.length}</div>
              <div className="text-sm text-muted-foreground">Following</div>
            </div>
          </div>

          {follows.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Organisations you follow
              </p>
              <div className="flex flex-wrap gap-2">
                {follows.map((org) => (
                  <Link key={org._id} href={`/organisations/${org._id}`}>
                    <span className="inline-flex items-center gap-1.5 bg-secondary text-foreground text-sm px-3 py-1.5 rounded-lg hover:bg-secondary/80 transition-colors cursor-pointer">
                      {org.verified && <span className="text-green-600">✓</span>}
                      {org.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Donation history */}
      {profile?.accountType !== "organisation" && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary" />
              My Donations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {donationsQ.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : donations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No donations yet. Support an organisation to see your history here.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {donations.map((d) => {
                  const date = new Date(d.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  });
                  const amount = `£${d.amountGbp.toFixed(2)}`;
                  return (
                    <div key={d._id} className="flex items-center justify-between py-3 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{d.orgName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold text-foreground">{amount}</span>
                        {d.type === "recurring" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#F5B800] bg-[#F5B800]/10 px-2 py-0.5 rounded-full">
                            <RefreshCw className="w-3 h-3" /> Monthly
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                            One-time
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {donations.some((d) => d.type === "recurring") && (
              <div className="pt-3 mt-1 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleManageSubscriptions}
                  disabled={portalLoading}
                >
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                  {portalLoading ? "Opening…" : "Manage recurring donations"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card className="border-border shadow-sm">
        <CardContent className="pt-4 pb-2 space-y-1">
          {profile?.accountType === "organisation" && (
            <Link href="/dashboard">
              <button className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-foreground hover:bg-secondary rounded-lg transition-colors">
                <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                Organisation Dashboard
              </button>
            </Link>
          )}
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </CardContent>
      </Card>

      {token && profile && (
        <EditProfileDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          token={token}
          currentName={profile.name}
          currentPhone={profile.phone ?? ""}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["profile"] });
          }}
        />
      )}
    </div>
  );
}
