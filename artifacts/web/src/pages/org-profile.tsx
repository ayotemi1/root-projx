import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, ArrowLeft, Heart, HeartOff, X,
  MapPin, Tag, Users, TrendingUp, Zap, DollarSign,
  ThumbsUp, MessageCircle, Share2, ChevronRight,

} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import type { FeedUpdate, Review, Org, VolunteerRole } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

const RED = "#B50000";
const GOLD = "#F5B800";

// ── Update card (2-col grid) ──────────────────────────────────────────────────

const TYPE_PILL: Record<string, { label: string; bg: string; color: string }> = {
  milestone: { label: "Milestone", bg: "#ECFDF5", color: "#059669" },
  campaign:  { label: "Campaign",  bg: "#FFFBEB", color: "#D97706" },
  update:    { label: "Update",    bg: "#EFF6FF", color: "#2563EB" },
};

function UpdateCard({ item, org }: { item: FeedUpdate; org: Org }) {
  const pill = TYPE_PILL[item.type] ?? TYPE_PILL.update!;
  const location = [org.city, org.country].filter(Boolean).join(", ");
  const images = (item.mediaUrls ?? []).filter((u) => !u.includes("video") && !u.endsWith(".mp4"));

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Body */}
      <div className="p-4 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
          <span
            className="px-2 py-0.5 rounded-full font-bold text-[10px]"
            style={{ backgroundColor: pill.bg, color: pill.color }}
          >
            {pill.label}
          </span>
          <span>{timeAgo(item.createdAt)}</span>
          {location && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {location}
              </span>
            </>
          )}
        </div>
        <h4 className="font-bold text-foreground text-sm leading-snug mb-1.5 line-clamp-2">
          {item.title}
        </h4>
        <p className="text-foreground/60 text-xs leading-relaxed line-clamp-2">
          {item.content}
        </p>
      </div>

      {/* Media grid */}
      {images.length > 0 && (
        <div className={`grid gap-0.5 mx-3 mb-3 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {images.slice(0, 4).map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="w-full h-24 object-cover rounded-lg"
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-4 flex items-center justify-between border-t border-border pt-3 mt-auto">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <button className="flex items-center gap-1 hover:text-primary transition-colors">
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>{item.likes ?? 0}</span>
          </button>
          <button className="flex items-center gap-1 hover:text-primary transition-colors">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>0</span>
          </button>
          <button className="flex items-center gap-1 hover:text-primary transition-colors">
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
        <button
          className="text-xs font-bold text-white px-3 py-1.5 rounded-md transition-opacity hover:opacity-90"
          style={{ backgroundColor: RED }}
        >
          View Details
        </button>
      </div>
    </div>
  );
}

// ── Campaign card (right column) ──────────────────────────────────────────────

function CampaignCard({ item }: { item: FeedUpdate }) {
  const thumb = (item.mediaUrls ?? []).find((u) => !u.endsWith(".mp4") && !u.includes("video"));
  const pct = Math.min(100, 30 + (item.likes % 70));
  const raised = (item.likes ?? 0) * 150;
  const goal = raised + 3500;

  return (
    <div className="flex gap-3 py-3 border-b border-border last:border-0">
      {thumb ? (
        <img src={thumb} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div
          className="w-16 h-16 rounded-lg flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #B50000 0%, #7A0000 100%)" }}
        />
      )}
      <div className="flex-1 min-w-0">
        <h5 className="font-bold text-sm text-foreground leading-snug line-clamp-1">{item.title}</h5>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.content}</p>
        <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: RED }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">£{raised.toLocaleString()} raised</span>
          <span className="font-bold" style={{ color: RED }}>
            {pct}% of £{goal.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Review row ────────────────────────────────────────────────────────────────

function ReviewRow({ item }: { item: Review }) {
  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-bold text-sm text-foreground">{item.authorName}</span>
        <div className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} style={{ color: i < item.rating ? GOLD : "#d1d5db" }}>★</span>
          ))}
        </div>
      </div>
      <p className="text-foreground/70 text-sm leading-relaxed">{item.content}</p>
      <p className="text-xs text-muted-foreground mt-1.5">{timeAgo(item.createdAt)}</p>
    </div>
  );
}


// ── Guest donate modal ────────────────────────────────────────────────────────

function DonateGuestModal({
  open, onClose, orgId, orgName,
}: {
  open: boolean; onClose: () => void; orgId: string; orgName: string;
}) {
  const [, navigate] = useLocation();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");

  function handleGuestContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    navigate(`/donate/${orgId}?email=${encodeURIComponent(email.trim())}`);
    onClose();
  }

  function handleClose() {
    setShowEmail(false);
    setEmail("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
        <div className="px-6 pt-6 pb-5 text-white" style={{ backgroundColor: RED }}>
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <DialogTitle className="text-lg font-extrabold text-white leading-snug">
            Join Root ProjX to support<br />
            <span style={{ color: GOLD }}>{orgName}</span>
          </DialogTitle>
          <p className="text-white/70 text-sm mt-1">Your support goes straight to the source.</p>
        </div>
        <div className="px-6 py-5 space-y-3 bg-white">
          <Link href="/register" onClick={handleClose}>
            <Button className="w-full font-bold text-black h-11" style={{ backgroundColor: GOLD }}>
              Create an account
            </Button>
          </Link>
          <Link href={`/login?next=${encodeURIComponent(`/donate/${orgId}`)}`} onClick={handleClose}>
            <Button
              variant="outline"
              className="w-full font-semibold h-11 border-2"
              style={{ borderColor: RED, color: RED }}
            >
              Sign in
            </Button>
          </Link>
          <div className="relative flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {!showEmail ? (
            <button
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              onClick={() => setShowEmail(true)}
            >
              Continue as guest →
            </button>
          ) : (
            <form onSubmit={handleGuestContinue} className="space-y-2">
              <Input
                type="email"
                placeholder="Your email address"
                value={email}
                autoFocus
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10"
              />
              <Button
                type="submit"
                variant="outline"
                className="w-full text-sm font-semibold"
                disabled={!email.trim()}
              >
                Continue as guest
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                No account needed — your email is only used for your receipt.
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrgProfilePage() {
  const [, params] = useRoute("/organisations/:id");
  const id = params?.id ?? "";
  const { isAuthenticated, token } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"updates" | "campaigns" | "volunteer" | "about">("updates");
  const [localFollow, setLocalFollow] = useState<boolean | null>(null);
  const [donateModalOpen, setDonateModalOpen] = useState(false);

  const orgQ = useQuery({
    queryKey: ["org", id],
    queryFn: () => api.getOrganisation(id, token),
    enabled: !!id,
  });

  const updatesQ = useQuery({
    queryKey: ["org-feed", id],
    queryFn: () => api.getOrgFeed(id),
    enabled: !!id,
  });

  const reviewsQ = useQuery({
    queryKey: ["org-reviews", id],
    queryFn: () => api.getOrgReviews(id),
    enabled: !!id,
  });

  const rolesQ = useQuery({
    queryKey: ["volunteerRoles", id],
    queryFn: () => api.getOrgVolunteerRoles(id),
  });

  const followsQ = useQuery({
    queryKey: ["follows", "my"],
    queryFn: () => api.getMyFollows(token!),
    enabled: isAuthenticated,
  });

  const followed =
    localFollow !== null
      ? localFollow
      : (followsQ.data ?? []).some((o) => o._id === id);

  const followMut = useMutation({
    mutationFn: async () => {
      if (followed) {
        await api.unfollowOrg(id, token!);
      } else {
        await api.followOrg(id, token!);
      }
    },
    onSuccess: () => {
      setLocalFollow(!followed);
      queryClient.invalidateQueries({ queryKey: ["follows", "my"] });
      queryClient.invalidateQueries({ queryKey: ["org", id] });
    },
  });

  const org = orgQ.data;

  if (orgQ.isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-4">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        Organisation not found.
      </div>
    );
  }

  const initials = org.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const allUpdates = updatesQ.data ?? [];
  const campaigns = allUpdates.filter((u) => u.type === "campaign");
  const updates = allUpdates.filter((u) => u.type !== "campaign");

  function handleDonateClick() {
    if (isAuthenticated) {
      window.location.href = `/donate/${id}`;
    } else {
      setDonateModalOpen(true);
    }
  }

  const TABS = [
    { key: "updates",   label: "Updates",   count: updates.length },
    { key: "campaigns", label: "Campaigns", count: campaigns.length },
    { key: "volunteer", label: "Volunteer",  count: null },
    { key: "about",     label: "About",      count: null },
  ] as const;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <DonateGuestModal
        open={donateModalOpen}
        onClose={() => setDonateModalOpen(false)}
        orgId={id}
        orgName={org.name}
      />

      {/* Back nav */}
      <Link href="/discover">
        <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Discover
        </button>
      </Link>

      {/* Two-column grid */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">

          {/* Hero card */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">

            {/* Banner */}
            <div className="relative">
              {org.coverImage ? (
                <img
                  src={org.coverImage}
                  alt={org.name}
                  className="w-full h-52 object-cover"
                />
              ) : (
                <div
                  className="w-full h-52"
                  style={{
                    background:
                      "linear-gradient(135deg, #B50000 0%, #7A0000 60%, #4a0000 100%)",
                  }}
                />
              )}

              {/* Avatar straddles banner/content boundary */}
              <div className="absolute -bottom-10 left-6">
                {org.logo ? (
                  <img
                    src={org.logo}
                    alt={org.name}
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full border-4 border-white shadow-md flex items-center justify-center text-xl font-extrabold"
                    style={{ backgroundColor: GOLD, color: "#111" }}
                  >
                    {initials}
                  </div>
                )}
              </div>
            </div>

            {/* Identity */}
            <div className="pt-14 px-6 pb-5">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-extrabold text-foreground leading-tight">
                      {org.name}
                    </h1>
                    {org.verified && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border"
                        style={{
                          backgroundColor: "#ECFDF5",
                          color: "#059669",
                          borderColor: "#A7F3D0",
                        }}
                      >
                        <CheckCircle className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
                    {(org.city || org.country) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {[org.city, org.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" />
                      {org.category}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
                    {org.description}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-5">
                {isAuthenticated ? (
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 font-semibold border-2 h-10"
                    style={
                      followed
                        ? { borderColor: RED, backgroundColor: RED, color: "#fff" }
                        : { borderColor: RED, color: RED }
                    }
                    onClick={() => followMut.mutate()}
                    disabled={followMut.isPending}
                  >
                    {followMut.isPending ? (
                      "…"
                    ) : followed ? (
                      <><HeartOff className="w-4 h-4" /> Following</>
                    ) : (
                      <><Heart className="w-4 h-4" /> Follow</>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 font-semibold border-2 h-10"
                    style={{ borderColor: RED, color: RED }}
                    onClick={() => setDonateModalOpen(true)}
                  >
                    <Heart className="w-4 h-4" /> Follow
                  </Button>
                )}
                <Button
                  className="flex-1 gap-2 font-bold h-10 text-white"
                  style={{ backgroundColor: RED }}
                  onClick={handleDonateClick}
                >
                  <Heart className="w-4 h-4" /> Donate
                </Button>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 border-t border-border">
              {[
                { Icon: Users,      label: "Followers", value: (org.followerCount ?? 0).toLocaleString() },
                { Icon: Zap,        label: "Updates",   value: allUpdates.length.toString() },
                { Icon: TrendingUp, label: "Impact",    value: (org.impactScore ?? 0).toString() },
                { Icon: DollarSign, label: "Raised",    value: `£${(org.totalRaised ?? 0).toLocaleString()}` },
              ].map(({ Icon, label, value }) => (
                <div key={label} className="flex flex-col items-center py-4 border-r border-border last:border-0">
                  <Icon className="w-5 h-5 mb-1" style={{ color: RED }} />
                  <span className="text-lg font-extrabold text-foreground">{value}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-border">
              {TABS.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="flex-1 py-3.5 text-sm font-semibold transition-colors relative"
                  style={
                    tab === key
                      ? { color: RED, borderBottom: `2px solid ${RED}` }
                      : { color: "#888" }
                  }
                >
                  {label}
                  {count !== null && count > 0 && (
                    <span
                      className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: tab === key ? RED : "#e5e7eb", color: tab === key ? "#fff" : "#666" }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-5">

              {/* ── Updates ── */}
              {tab === "updates" && (
                updatesQ.isLoading ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                  </div>
                ) : updates.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground text-sm">No updates yet.</p>
                ) : (
                  <>
                    <h3 className="font-bold text-foreground text-base mb-4">Latest Updates</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {updates.map((u) => (
                        <UpdateCard key={u._id} item={u} org={org} />
                      ))}
                    </div>
                  </>
                )
              )}

              {/* ── Campaigns ── */}
              {tab === "campaigns" && (
                updatesQ.isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24" /><Skeleton className="h-24" />
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="text-center py-12">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                      style={{ backgroundColor: "#FEF2F2" }}
                    >
                      <Heart className="w-6 h-6" style={{ color: RED }} />
                    </div>
                    <p className="font-semibold text-foreground mb-1">No active campaigns</p>
                    <p className="text-sm text-muted-foreground">
                      Check back soon — campaigns will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0 divide-y divide-border">
                    {campaigns.map((c) => (
                      <div key={c._id} className="py-4">
                        <CampaignCard item={c} />
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* ── Volunteer ── */}
              {tab === "volunteer" && (
                <div>
                  <h3 className="font-bold text-foreground text-base mb-1">Ways to Volunteer</h3>
                  <p className="text-sm text-muted-foreground mb-5">
                    Help {org.name} make a greater impact.
                  </p>
                  {rolesQ.isLoading ? (
                    <div className="space-y-2">
                      {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-secondary animate-pulse" />)}
                    </div>
                  ) : (rolesQ.data ?? []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(181,0,0,0.08)" }}>
                        <Users className="w-7 h-7" style={{ color: RED }} />
                      </div>
                      <p className="font-bold text-foreground">No volunteer roles listed</p>
                      <p className="text-sm text-muted-foreground max-w-xs">This organisation hasn't listed any volunteer opportunities yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {(rolesQ.data ?? []).map((role: VolunteerRole) => (
                        <div
                          key={role._id}
                          className="flex items-center gap-4 p-4 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer group"
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: GOLD + "33" }}
                          >
                            <Users className="w-5 h-5" style={{ color: "#7A5000" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-foreground">{role.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {role.location} · {role.commitment}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    className="w-full mt-5 py-3 rounded-xl font-bold text-white text-sm transition-opacity hover:opacity-90"
                    style={{ backgroundColor: RED }}
                    onClick={handleDonateClick}
                  >
                    Apply to Volunteer
                  </button>
                </div>
              )}

              {/* ── About ── */}
              {tab === "about" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      About
                    </h3>
                    <p className="text-sm text-foreground/80 leading-relaxed">{org.description}</p>
                  </div>
                  {org.mission && (
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Mission
                      </h3>
                      <p className="text-sm text-foreground/80 leading-relaxed">{org.mission}</p>
                    </div>
                  )}
                  {org.contact && (
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Contact
                      </h3>
                      <div className="space-y-1 text-sm text-foreground/80">
                        {org.contact.email && (
                          <a
                            href={`mailto:${org.contact.email}`}
                            className="flex items-center gap-2 hover:text-primary transition-colors"
                          >
                            ✉ {org.contact.email}
                          </a>
                        )}
                        {org.contact.phone && (
                          <p>📞 {org.contact.phone}</p>
                        )}
                        {org.contact.website && (
                          <a
                            href={org.contact.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 hover:text-primary transition-colors"
                            style={{ color: RED }}
                          >
                            🌐 {org.contact.website}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {org.socialLinks && Object.keys(org.socialLinks).length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Social
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(org.socialLinks).map(([platform, url]) => (
                          <a
                            key={platform}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border hover:border-primary hover:text-primary transition-colors capitalize"
                          >
                            {platform}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-5">

          {/* Active Campaigns card */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="font-bold text-foreground text-base">Active Campaigns</h3>
              <button
                className="text-sm font-semibold"
                style={{ color: RED }}
                onClick={() => setTab("campaigns")}
              >
                View all
              </button>
            </div>

            <div className="px-5 pb-3">
              {updatesQ.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20" /><Skeleton className="h-20" />
                </div>
              ) : campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No active campaigns right now.
                </p>
              ) : (
                campaigns.slice(0, 3).map((c) => <CampaignCard key={c._id} item={c} />)
              )}
            </div>

            <div className="px-5 pb-5">
              <Link
                href={`/organisations/${id}/campaigns`}
                className="block w-full py-2.5 rounded-xl font-bold text-white text-sm text-center hover:opacity-90 transition-opacity"
                style={{ backgroundColor: RED }}
              >
                See All Campaigns
              </Link>
            </div>
          </div>

          {/* Ways to Volunteer card */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="font-bold text-foreground text-base">Ways to Volunteer</h3>
              <button
                className="text-sm font-semibold"
                style={{ color: RED }}
                onClick={() => setTab("volunteer")}
              >
                View all
              </button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 px-5 pb-3 flex-wrap">
              {["Local", "Remote", "Short Term", "Long Term"].map((label, i) => (
                <span
                  key={label}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                  style={
                    i === 0
                      ? { backgroundColor: RED, color: "#fff" }
                      : { backgroundColor: "#F2EDE4", color: "#555" }
                  }
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="px-5 pb-3 space-y-0">
              {rolesQ.isLoading ? (
                <div className="space-y-2 py-2">
                  {[1,2].map(i => <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />)}
                </div>
              ) : (rolesQ.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No volunteer roles listed yet.</p>
              ) : (
                (rolesQ.data ?? []).slice(0, 4).map((role: VolunteerRole) => (
                  <div
                    key={role._id}
                    className="flex items-center gap-3 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-secondary/30 -mx-1 px-1 rounded-lg transition-colors"
                    onClick={() => setTab("volunteer")}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: GOLD + "33" }}
                    >
                      <Users className="w-4 h-4" style={{ color: "#7A5000" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground leading-snug">{role.title}</p>
                      <p className="text-xs text-muted-foreground">{role.location} · {role.commitment}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                ))
              )}
            </div>

            <div className="px-5 pb-5">
              <button
                className="w-full py-2.5 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: RED }}
                onClick={handleDonateClick}
              >
                Apply to Volunteer
              </button>
            </div>
          </div>

          {/* Reviews sidebar snippet */}
          {(reviewsQ.data ?? []).length > 0 && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <h3 className="font-bold text-foreground text-base">Reviews</h3>
              </div>
              <div className="px-5 pb-5">
                {(reviewsQ.data ?? []).slice(0, 2).map((r) => (
                  <ReviewRow key={r._id} item={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
