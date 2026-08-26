import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Megaphone, Users, FolderOpen, BarChart2, FileText,
  User, Settings, ChevronRight, Bell, PencilLine, Plus, TrendingUp,
  TrendingDown, ExternalLink, Heart,
} from "lucide-react";
import * as api from "@/lib/api";
import type { Org, FeedUpdate, Campaign } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const RED = "#B50000";
const GOLD = "#F5B800";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} week${Math.floor(d / 7) > 1 ? "s" : ""} ago`;
  return `${Math.floor(d / 30)} month${Math.floor(d / 30) > 1 ? "s" : ""} ago`;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "??";
}


// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, value, label, color = RED }: {
  icon: React.ElementType; value: string | number; label: string; color?: string;
}) {
  return (
    <div className="bg-white border border-[#E0D8CC] rounded-2xl p-5 flex flex-col items-center gap-2 shadow-sm flex-1 min-w-0">
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#FFE4E4" }}>
        <Icon size={18} color={color} />
      </div>
      <p className="text-2xl font-extrabold text-[#1A1A1A]">{value}</p>
      <p className="text-xs text-[#888] font-medium">{label}</p>
    </div>
  );
}

function ActionButton({ icon: Icon, label, iconBg, href, onClick }: {
  icon: React.ElementType; label: string; iconBg: string;
  href?: string; onClick?: () => void;
}) {
  const inner = (
    <div className="bg-[#F9F6F0] border border-[#E0D8CC] rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-[#F2EDE4] transition-colors cursor-pointer">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
        <Icon size={15} color={RED} />
      </div>
      <span className="text-sm font-semibold text-[#333] flex-1">{label}</span>
      <ChevronRight size={14} className="text-[#BBB]" />
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div onClick={onClick}>{inner}</div>;
}

function MetricCard({ label, value, trend }: { label: string; value: string | number; trend: number | null }) {
  return (
    <div className="bg-white border border-[#E0D8CC] rounded-xl p-3 flex flex-col gap-1 shadow-sm">
      <p className="text-xs text-[#888] font-medium">{label}</p>
      <p className="text-xl font-extrabold text-[#1A1A1A]">{value}</p>
      {trend !== null && (
        <span className={`text-xs font-semibold flex items-center gap-0.5 ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
          {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {trend >= 0 ? "+" : ""}{trend}%
        </span>
      )}
    </div>
  );
}

function NotificationBell({ orgId, token }: { orgId: string; token: string | null }) {
  const [open, setOpen] = useState(false);
  const { data: notifs = [] } = useQuery({
    queryKey: ["org-notifications", orgId],
    queryFn: () => api.getOrgNotifications(orgId, token!),
    enabled: !!orgId && !!token,
  });
  const unread = notifs.filter((n) => !n.read).length;

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center bg-[#F9F6F0] border border-[#E0D8CC] hover:bg-[#F2EDE4] transition-colors"
      >
        <Bell size={16} className="text-[#555]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ background: RED }}>
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-72 bg-white border border-[#E0D8CC] rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E0D8CC]">
              <p className="font-bold text-sm text-[#1A1A1A]">Notifications</p>
            </div>
            {notifs.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[#999]">No notifications yet</div>
            ) : (
              notifs.map((n) => (
                <div key={n._id} className={`px-4 py-3 border-b border-[#F2EDE4] hover:bg-[#F9F6F0] transition-colors ${!n.read ? "bg-[#FFF8F8]" : ""}`}>
                  <p className="text-sm text-[#333]">{n.message}</p>
                  <p className="text-xs text-[#999] mt-0.5">{timeAgo(n.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

const NAV = [
  { section: "Manage", items: [
    { key: "dashboard",  label: "Dashboard",  icon: LayoutDashboard, href: "/org-dashboard" },
    { key: "campaigns",  label: "Campaigns",  icon: Megaphone,       href: null },
    { key: "volunteers", label: "Volunteers", icon: Users,           href: null },
    { key: "projects",   label: "Projects",   icon: FolderOpen,      href: null },
  ]},
  { section: "Analytics", items: [
    { key: "overview", label: "Overview", icon: BarChart2, href: null },
    { key: "reports",  label: "Reports",  icon: FileText,  href: null },
  ]},
  { section: "Settings", items: [
    { key: "profile",   label: "Profile",   icon: User,     href: null },
    { key: "settings",  label: "Settings",  icon: Settings, href: null },
  ]},
];

function Sidebar({ org, orgId }: { org: Org | undefined; orgId: string }) {
  const [, navigate] = useLocation();
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-[#E0D8CC] min-h-full py-5">
      {/* Org identity */}
      <div className="px-4 mb-5">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-extrabold text-white flex-shrink-0"
            style={{ background: RED }}
          >
            {initials(org?.name ?? "")}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-[#888]">Welcome back,</p>
            <p className="text-sm font-bold text-[#1A1A1A] leading-tight line-clamp-2">{org?.name ?? "Your Org"}</p>
          </div>
        </div>
        <Link
          href={`/organisations/${orgId}`}
          className="block text-center text-xs font-semibold border rounded-lg py-1.5 px-3 transition-colors hover:bg-[#FFF4F4]"
          style={{ color: RED, borderColor: RED }}
        >
          View Public Profile
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2">
        {NAV.map(({ section, items }) => (
          <div key={section} className="mb-4">
            <p className="text-[10px] font-bold text-[#AAA] uppercase tracking-wider px-3 mb-1">{section}</p>
            {items.map(({ key, label, icon: Icon, href }) => {
              const active = key === "dashboard";
              return (
                <button
                  key={key}
                  onClick={() => href && navigate(href)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                    active
                      ? "text-[#B50000] bg-[#FFF0F0] border-l-2 border-[#B50000]"
                      : "text-[#555] hover:bg-[#F5F3EF]"
                  }`}
                >
                  <Icon size={15} />
                  {label}
                  {active && <ChevronRight size={13} className="ml-auto" style={{ color: RED }} />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

// ── Mobile tab bar ────────────────────────────────────────────────────────────

function MobileTabBar({ orgId }: { orgId: string }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E0D8CC] flex">
      {[
        { icon: LayoutDashboard, label: "Dashboard", href: "/org-dashboard" },
        { icon: Megaphone,       label: "Campaigns", href: `/organisations/${orgId}/campaigns` },
        { icon: Users,           label: "Volunteers", href: `/organisations/${orgId}/volunteer` },
        { icon: User,            label: "Profile", href: `/organisations/${orgId}` },
      ].map(({ icon: Icon, label, href }) => (
        <Link key={label} href={href} className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[#888] hover:text-[#B50000] transition-colors">
          <Icon size={18} />
          <span className="text-[9px] font-semibold">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgDashboardPage() {
  const { user, token } = useAuth();
  const orgId = user?.id ?? "";

  const { data: org } = useQuery<Org>({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId, token),
    enabled: !!orgId,
  });

  const { data: updates = [] } = useQuery<FeedUpdate[]>({
    queryKey: ["org-feed", orgId],
    queryFn: () => api.getOrgFeed(orgId),
    enabled: !!orgId,
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["campaigns", orgId],
    queryFn: () => api.getManagedCampaigns(orgId, token!),
    enabled: !!orgId && !!token,
  });

  const { data: roles = [] } = useQuery<unknown[]>({
    queryKey: ["volunteerRoles", orgId],
    queryFn: () => api.apiFetch(`/organisations/${orgId}/volunteerRoles`),
    enabled: !!orgId,
  });

  const activeCampaigns = (campaigns as Campaign[]).filter((c) => c.status === "active");
  const recentUpdates = updates.slice(0, 5);

  return (
    <div className="flex bg-[#F5F3EF] min-h-[calc(100vh-4rem)] pb-14 md:pb-0">
      <Sidebar org={org} orgId={orgId} />

      {/* Main content */}
      <main className="flex-1 min-w-0 p-4 md:p-6 space-y-6">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-[#1A1A1A]">Dashboard</h2>
          <div className="flex items-center gap-2">
            <NotificationBell orgId={orgId} token={token} />
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold text-white flex-shrink-0"
              style={{ background: RED }}
            >
              {initials(org?.name ?? "")}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 overflow-x-auto pb-1">
          <StatCard icon={FolderOpen} value={activeCampaigns.length} label="Projects" />
          <StatCard icon={Users} value={roles.length} label="Volunteers" color={GOLD} />
          <StatCard icon={User} value={org?.followerCount ?? 0} label="Followers" />
          <StatCard icon={Heart} value={`£${(org?.totalRaised ?? 0).toLocaleString("en-GB")}`} label="Raised" color="#2D7A2D" />
        </div>

        {/* Two-column section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Create & Manage */}
          <div className="bg-white border border-[#E0D8CC] rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-[#1A1A1A] mb-4">Create &amp; Manage</h3>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton icon={PencilLine} label="Create Update"     iconBg="#FFE4E4" href="/dashboard" />
              <ActionButton icon={Plus}       label="Add Campaign"      iconBg="#FFF3CD" href={`/organisations/${orgId}/campaigns`} />
              <ActionButton icon={Users}      label="Manage Volunteers" iconBg="#E4EEFF" href={`/organisations/${orgId}/volunteer`} />
              <ActionButton icon={FolderOpen} label="Manage Projects"   iconBg="#E8F4E8" href={`/organisations/${orgId}/campaigns`} />
            </div>
          </div>

          {/* Analytics Overview */}
          <div className="bg-white border border-[#E0D8CC] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#1A1A1A]">Analytics Overview</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="Active Projects" value={activeCampaigns.length} trend={null} />
              <MetricCard label="Followers"       value={(org?.followerCount ?? 0).toLocaleString("en-GB")} trend={null} />
              <MetricCard label="Total Raised"    value={`£${(org?.totalRaised ?? 0).toLocaleString("en-GB")}`} trend={null} />
            </div>
            <p className="text-xs text-[#999] mt-4 text-center">Detailed analytics — coming soon</p>
          </div>
        </div>

        {/* Recent Updates */}
        <div className="bg-white border border-[#E0D8CC] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#1A1A1A]">Recent Updates</h3>
            <Link href={`/organisations/${orgId}/updates`} className="text-xs font-semibold hover:underline flex items-center gap-1" style={{ color: RED }}>
              View all <ExternalLink size={11} />
            </Link>
          </div>

          {recentUpdates.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#999]">
              No updates yet. <Link href="/dashboard" className="font-semibold hover:underline" style={{ color: RED }}>Create your first update →</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#F2EDE4]">
              {recentUpdates.map((u) => {
                const thumb = u.imageUrl ?? (u.mediaUrls ?? [])[0] ?? null;
                return (
                  <div key={u._id} className="py-3 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#EDE8E0] flex-shrink-0">
                      {thumb ? (
                        <img src={thumb} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-lg font-black" style={{ color: RED, opacity: 0.2 }}>{u.title[0]}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1A1A1A] truncate">{u.title}</p>
                      <p className="text-xs text-[#999] mt-0.5">{timeAgo(u.createdAt)}</p>
                    </div>
                    <span className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                      Published
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <MobileTabBar orgId={orgId} />
    </div>
  );
}
