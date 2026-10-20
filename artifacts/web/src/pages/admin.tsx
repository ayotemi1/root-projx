import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Clock, Users, FileText, LogOut, RefreshCw, Building2, CreditCard, Pencil, X } from "lucide-react";

const RED_DEEP = "#7A0000";
const RED = "#B50000";
const GOLD = "#F5B800";

interface OrgApplication {
  _id: string;
  orgName: string;
  contactName: string;
  email: string;
  sectors: string[];
  country?: string | null;
  status: "pending" | "approved" | "declined";
  createdAt: string;
  approvedAt?: string;
  declinedAt?: string;
}

interface Supporter {
  _id: string;
  uid: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string | null;
  signedUpAt?: string | null;
}

interface Organisation {
  _id: string;
  name: string;
  category: string;
  country: string | null;
  city: string | null;
  description?: string;
  mission?: string | null;
  logo?: string | null;
  coverImage?: string | null;
  contact?: { email?: string; phone?: string; website?: string };
  socialLinks?: Record<string, string | null>;
  verified: boolean;
  followerCount: number;
  totalRaised: number;
  createdAt: string | null;
  payoutMethod?: "stripe" | "wise" | "bank_transfer" | null;
  payoutManualRequested?: boolean;
  payoutManualApproved?: boolean;
  payoutManualLabel?: string | null;
}

function PayoutCell({ org, onManage }: { org: Organisation; onManage: () => void }) {
  const m = org.payoutMethod ?? null;
  if (m === "bank_transfer" && org.payoutManualRequested) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: org.payoutManualApproved ? "#166534" : "#92400E", background: org.payoutManualApproved ? "#DCFCE7" : "#FEF9C3", borderRadius: 6, padding: "2px 8px" }}>
          Bank transfer · {org.payoutManualApproved ? "Approved" : "Requested"}
        </span>
        {org.payoutManualLabel && <span style={{ fontSize: 12, color: "#666" }}>{org.payoutManualLabel}</span>}
        <button data-testid={`button-manual-payout-${org._id}`} onClick={onManage} style={{ padding: "5px 9px", border: "1px solid #d8d0c5", borderRadius: 7, background: "#fff", color: RED_DEEP, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          {org.payoutManualApproved ? "Edit label" : "Review & approve"}
        </button>
      </div>
    );
  }
  const text = m === "stripe" ? "Stripe" : m === "wise" ? "Wise" : m === "bank_transfer" ? "Bank transfer" : "Not set";
  return <span style={{ fontSize: 13, color: m ? "#555" : "#bbb" }}>{text}</span>;
}

type OrganisationForm = {
  name: string; category: string; country: string; city: string;
  description: string; mission: string; logo: string; coverImage: string;
  email: string; phone: string; website: string;
  instagram: string; facebook: string; twitter: string; linkedin: string; youtube: string; tiktok: string;
};

function formFromOrganisation(org: Organisation): OrganisationForm {
  return {
    name: org.name ?? "", category: org.category ?? "", country: org.country ?? "", city: org.city ?? "",
    description: org.description ?? "", mission: org.mission ?? "", logo: org.logo ?? "", coverImage: org.coverImage ?? "",
    email: org.contact?.email ?? "", phone: org.contact?.phone ?? "", website: org.contact?.website ?? "",
    instagram: org.socialLinks?.instagram ?? "", facebook: org.socialLinks?.facebook ?? "",
    twitter: org.socialLinks?.twitter ?? "", linkedin: org.socialLinks?.linkedin ?? "",
    youtube: org.socialLinks?.youtube ?? "", tiktok: org.socialLinks?.tiktok ?? "",
  };
}

interface Donation {
  _id: string;
  orgName: string;
  intendedGbp?: number;
  chargedGbp?: number;
  platformFeeGbp?: number;
  toOrgGbp?: number;
  grossAmountGbp?: number;
  netAmountGbp?: number;
  amountGbp?: number;
  feeCovered?: boolean;
  feeAmountGbp?: number;
  type: string;
  status: string;
  createdAt: string | null;
  userId?: string;
  guestEmail?: string;
}

function StatusBadge({ status }: { status: "pending" | "approved" | "declined" }) {
  const map = {
    pending:  { bg: "#FEF9C3", color: "#92400E", label: "Pending" },
    approved: { bg: "#DCFCE7", color: "#166534", label: "Approved" },
    declined: { bg: "#FEE2E2", color: "#991B1B", label: "Declined" },
  };
  const s = map[status];
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.trim().split(" ").filter(Boolean).map((w) => w[0]!.toUpperCase()).slice(0, 2).join("") || "?";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: RED_DEEP, color: GOLD,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: size * 0.36, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

const TH: React.CSSProperties = { padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" };
const TD: React.CSSProperties = { padding: "14px 20px", borderTop: "1px solid #f0ece4" };

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"applications" | "supporters" | "organisations" | "donations">("applications");

  const [applications, setApplications]   = useState<OrgApplication[]>([]);
  const [supporters,   setSupporters]     = useState<Supporter[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [donations,    setDonations]      = useState<Donation[]>([]);

  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingSups, setLoadingSups] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingDons, setLoadingDons] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "declined">("pending");
  const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);
  const [orgForm, setOrgForm] = useState<OrganisationForm | null>(null);
  const [savingOrg, setSavingOrg] = useState(false);
  const [payoutOrg, setPayoutOrg] = useState<Organisation | null>(null);
  const [payoutLabel, setPayoutLabel] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState("");

  function openPayout(org: Organisation) {
    setPayoutOrg(org);
    setPayoutLabel(org.payoutManualLabel ?? "");
    setPayoutError("");
  }

  async function saveManualPayout() {
    if (!payoutOrg) return;
    setSavingPayout(true);
    setPayoutError("");
    try {
      const res = await fetch(`/api/admin/organisations/${payoutOrg._id}/manual-payout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ payoutManualApproved: true, payoutManualLabel: payoutLabel.trim() || null }),
      });
      if (res.status === 401) { logout(); return; }
      const data = await res.json() as Organisation & { error?: string };
      if (!res.ok) { setPayoutError(data.error ?? "Failed to save bank transfer approval."); return; }
      setOrganisations((current) => current.map((org) => org._id === data._id ? data : org));
      setPayoutOrg(null);
    } catch {
      setPayoutError("Network error — please try again.");
    } finally {
      setSavingPayout(false);
    }
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") ?? "" : "";

  function logout() {
    localStorage.removeItem("admin_token");
    setLocation("/admin/login");
  }

  const fetchApplications = useCallback(async () => {
    setLoadingApps(true);
    setError("");
    try {
      const url = statusFilter === "all" ? "/api/admin/applications" : `/api/admin/applications?status=${statusFilter}`;
      const res = await fetch(url, { headers: { "x-admin-token": token } });
      if (res.status === 401) { logout(); return; }
      const data = await res.json() as OrgApplication[];
      setApplications(data);
    } catch {
      setError("Failed to load applications.");
    } finally {
      setLoadingApps(false);
    }
  }, [token, statusFilter]);

  const fetchSupporters = useCallback(async () => {
    setLoadingSups(true);
    setError("");
    try {
      const res = await fetch("/api/admin/supporters", { headers: { "x-admin-token": token } });
      if (res.status === 401) { logout(); return; }
      const data = await res.json() as Supporter[];
      setSupporters(data);
    } catch {
      setError("Failed to load supporters.");
    } finally {
      setLoadingSups(false);
    }
  }, [token]);

  const fetchOrganisations = useCallback(async () => {
    setLoadingOrgs(true);
    setError("");
    try {
      const res = await fetch("/api/admin/organisations", { headers: { "x-admin-token": token } });
      if (res.status === 401) { logout(); return; }
      const data = await res.json() as Organisation[];
      setOrganisations(data);
    } catch {
      setError("Failed to load organisations.");
    } finally {
      setLoadingOrgs(false);
    }
  }, [token]);

  const fetchDonations = useCallback(async () => {
    setLoadingDons(true);
    setError("");
    try {
      const res = await fetch("/api/admin/donations", { headers: { "x-admin-token": token } });
      if (res.status === 401) { logout(); return; }
      const data = await res.json() as Donation[];
      setDonations(data);
    } catch {
      setError("Failed to load donations.");
    } finally {
      setLoadingDons(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) { setLocation("/admin/login"); return; }
    fetchApplications();
  }, [token, fetchApplications]);

  useEffect(() => {
    if (tab === "supporters"    && supporters.length    === 0) fetchSupporters();
    if (tab === "organisations" && organisations.length === 0) fetchOrganisations();
    if (tab === "donations"     && donations.length     === 0) fetchDonations();
  }, [tab]);

  async function handleApprove(id: string) {
    if (!confirm("Approve this application? This will create their organisation account and send an acceptance email.")) return;
    setActionLoading(id + "_approve");
    try {
      const res = await fetch(`/api/admin/applications/${id}/approve`, { method: "POST", headers: { "x-admin-token": token } });
      const data = await res.json() as { error?: string };
      if (!res.ok) { alert(data.error ?? "Failed to approve application."); return; }
      await fetchApplications();
    } catch {
      alert("Network error — please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDecline(id: string, orgName: string) {
    if (!confirm(`Decline ${orgName}'s application? This will send them a decline email.`)) return;
    setActionLoading(id + "_decline");
    try {
      const res = await fetch(`/api/admin/applications/${id}/decline`, { method: "POST", headers: { "x-admin-token": token } });
      const data = await res.json() as { error?: string };
      if (!res.ok) { alert(data.error ?? "Failed to decline application."); return; }
      await fetchApplications();
    } catch {
      alert("Network error — please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  function openOrgEditor(org: Organisation) {
    setEditingOrg(org);
    setOrgForm(formFromOrganisation(org));
  }

  async function saveOrganisation() {
    if (!editingOrg || !orgForm) return;
    setSavingOrg(true);
    try {
      const res = await fetch(`/api/admin/organisations/${editingOrg._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({
          name: orgForm.name, category: orgForm.category,
          ...(orgForm.country.trim() ? { country: orgForm.country.trim() } : {}),
          city: orgForm.city,
          description: orgForm.description, mission: orgForm.mission, logo: orgForm.logo, coverImage: orgForm.coverImage,
          contact: { email: orgForm.email, phone: orgForm.phone, website: orgForm.website },
          socialLinks: {
            instagram: orgForm.instagram, facebook: orgForm.facebook, twitter: orgForm.twitter,
            linkedin: orgForm.linkedin, youtube: orgForm.youtube, tiktok: orgForm.tiktok,
          },
        }),
      });
      const data = await res.json() as Organisation & { error?: string };
      if (res.status === 401) { logout(); return; }
      if (!res.ok) { alert(data.error ?? "Failed to save organisation."); return; }
      setOrganisations((current) => current.map((org) => org._id === data._id ? data : org));
      setEditingOrg(null);
      setOrgForm(null);
    } catch {
      alert("Network error — please try again.");
    } finally {
      setSavingOrg(false);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px", fontSize: 14, fontWeight: 700,
    border: "none", borderBottom: active ? `3px solid ${GOLD}` : "3px solid transparent",
    background: "none", color: active ? GOLD : "rgba(255,255,255,0.7)",
    cursor: "pointer", transition: "color 0.15s", display: "flex", alignItems: "center", gap: 6,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f2ede4" }}>

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div style={{ background: RED_DEEP, padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <img src="/logo-stylised.png" alt="Root ProjX" style={{ height: 36, objectFit: "contain", padding: "12px 0" }} />
            <div style={{ display: "flex" }}>
              <button style={tabStyle(tab === "applications")} onClick={() => setTab("applications")}>
                <FileText size={14} />Applications
              </button>
              <button style={tabStyle(tab === "organisations")} onClick={() => setTab("organisations")}>
                <Building2 size={14} />Organisations
              </button>
              <button style={tabStyle(tab === "supporters")} onClick={() => setTab("supporters")}>
                <Users size={14} />Supporters
              </button>
              <button style={tabStyle(tab === "donations")} onClick={() => setTab("donations")}>
                <CreditCard size={14} />Donations
              </button>
            </div>
          </div>
          <button
            onClick={logout}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {error && <p style={{ color: RED, marginBottom: 16 }}>{error}</p>}

        {/* ── Applications tab ──────────────────────────────────────── */}
        {tab === "applications" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}>Organisation Applications</h1>
                <p style={{ margin: "4px 0 0", fontSize: 14, color: "#888" }}>Review and approve or decline incoming applications</p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  style={{ padding: "8px 12px", border: "1.5px solid #e0d8cc", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="declined">Declined</option>
                  <option value="all">All</option>
                </select>
                <button
                  onClick={fetchApplications}
                  style={{ padding: "8px 12px", border: "1.5px solid #e0d8cc", borderRadius: 8, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#555" }}
                >
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>
            </div>

            {loadingApps ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#888" }}>Loading…</div>
            ) : applications.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", background: "#fff", borderRadius: 12 }}>
                <Clock size={40} color="#ccc" style={{ margin: "0 auto 12px" }} />
                <p style={{ color: "#888", fontSize: 15 }}>No {statusFilter === "all" ? "" : statusFilter} applications</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {applications.map((app) => (
                  <div key={app._id} style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "flex-start", gap: 16 }}>
                    <Avatar name={app.orgName} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: "#1a1a1a" }}>{app.orgName}</span>
                        <StatusBadge status={app.status} />
                      </div>
                      <p data-testid={`text-app-country-${app._id}`} style={{ margin: "0 0 4px", fontSize: 13, color: app.country ? "#444" : "#bbb", fontWeight: 600 }}>
                        {app.country || "Not set"}
                      </p>
                      <p style={{ margin: "0 0 6px", fontSize: 13, color: "#666" }}>
                        {app.contactName} · <a href={`mailto:${app.email}`} style={{ color: RED }}>{app.email}</a>
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                        {(app.sectors ?? []).map((s) => (
                          <span key={s} style={{ background: "#f2ede4", color: "#555", borderRadius: 6, padding: "2px 8px", fontSize: 12 }}>{s}</span>
                        ))}
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: "#bbb" }}>Applied {formatDate(app.createdAt)}</p>
                    </div>
                    {app.status === "pending" && (
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => handleApprove(app._id)}
                          disabled={actionLoading !== null}
                          style={{ display: "flex", alignItems: "center", gap: 6, background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: actionLoading !== null ? "not-allowed" : "pointer", opacity: actionLoading !== null ? 0.6 : 1 }}
                        >
                          <CheckCircle2 size={14} />
                          {actionLoading === app._id + "_approve" ? "Approving…" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleDecline(app._id, app.orgName)}
                          disabled={actionLoading !== null}
                          style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", color: RED, border: `1.5px solid ${RED}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: actionLoading !== null ? "not-allowed" : "pointer", opacity: actionLoading !== null ? 0.6 : 1 }}
                        >
                          <XCircle size={14} />
                          {actionLoading === app._id + "_decline" ? "Declining…" : "Decline"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Organisations tab ─────────────────────────────────────── */}
        {tab === "organisations" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}>Organisations</h1>
                <p style={{ margin: "4px 0 0", fontSize: 14, color: "#888" }}>
                  {organisations.length > 0 ? `${organisations.length} active organisations` : "All approved organisations on the platform"}
                </p>
              </div>
              <button
                onClick={fetchOrganisations}
                style={{ padding: "8px 12px", border: "1.5px solid #e0d8cc", borderRadius: 8, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#555" }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {loadingOrgs ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#888" }}>Loading…</div>
            ) : organisations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", background: "#fff", borderRadius: 12 }}>
                <Building2 size={40} color="#ccc" style={{ margin: "0 auto 12px" }} />
                <p style={{ color: "#888", fontSize: 15 }}>No organisations yet</p>
              </div>
            ) : (
              <div style={{ background: "#fff", borderRadius: 12, overflowX: "auto", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9f6f0" }}>
                      <th style={TH}>Organisation</th>
                      <th style={TH}>Category</th>
                      <th style={TH}>Country</th>
                      <th style={TH}>City</th>
                      <th style={TH}>Payout</th>
                      <th style={TH}>Contact</th>
                      <th style={TH}>Followers</th>
                      <th style={TH}>Total Raised</th>
                      <th style={TH}>Joined</th>
                       <th style={TH}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {organisations.map((org) => (
                      <tr key={org._id}>
                        <td style={TD}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Avatar name={org.name} size={32} />
                            <div>
                              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#1a1a1a" }}>{org.name}</p>
                              {org.verified && (
                                <span style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>✓ Verified</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...TD, fontSize: 13, color: "#555" }}>{org.category ?? "—"}</td>
                        <td style={{ ...TD, fontSize: 13, color: "#555" }}>
                          {org.country ? org.country : <span style={{ color: "#bbb" }}>Not set</span>}
                        </td>
                        <td style={{ ...TD, fontSize: 13, color: "#555" }}>{org.city || "—"}</td>
                        <td style={TD}><PayoutCell org={org} onManage={() => openPayout(org)} /></td>
                        <td style={TD}>
                          {org.contact?.email
                            ? <a href={`mailto:${org.contact.email}`} style={{ color: RED, fontSize: 13, textDecoration: "none" }}>{org.contact.email}</a>
                            : <span style={{ color: "#bbb", fontSize: 13 }}>—</span>
                          }
                        </td>
                        <td style={{ ...TD, fontSize: 13, color: "#555", textAlign: "center" as const }}>
                          {(org.followerCount ?? 0).toLocaleString()}
                        </td>
                        <td style={{ ...TD, fontSize: 13, fontWeight: 600, color: RED }}>
                          £{(org.totalRaised ?? 0).toLocaleString()}
                        </td>
                        <td style={{ ...TD, fontSize: 13, color: "#888" }}>{formatDate(org.createdAt)}</td>
                         <td style={TD}>
                           <button onClick={() => openOrgEditor(org)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", border: "1px solid #d8d0c5", borderRadius: 7, background: "#fff", color: RED_DEEP, fontWeight: 700, cursor: "pointer" }}>
                             <Pencil size={13} /> Edit profile
                           </button>
                         </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {editingOrg && orgForm && (
          <div role="dialog" aria-modal="true" aria-labelledby="org-editor-title" style={{ position: "fixed", inset: 0, background: "rgba(20,10,5,0.55)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ width: "min(760px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
              <div style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1, padding: "20px 24px", borderBottom: "1px solid #eee7dd", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div><h2 id="org-editor-title" style={{ margin: 0, fontSize: 20 }}>Edit organisation profile</h2><p style={{ margin: "4px 0 0", color: "#777", fontSize: 13 }}>{editingOrg.name}</p></div>
                <button aria-label="Close editor" onClick={() => setEditingOrg(null)} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 6 }}><X size={20} /></button>
              </div>
              <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
                {([
                  ["name", "Organisation name", true], ["category", "Category", true],
                  ["country", "Country", false], ["city", "City", false],
                  ["email", "Public email", false], ["phone", "Public phone", false],
                  ["website", "Website URL", false], ["logo", "Logo image URL", false],
                  ["coverImage", "Banner image URL", false], ["instagram", "Instagram URL", false],
                  ["facebook", "Facebook URL", false], ["twitter", "X / Twitter URL", false],
                  ["linkedin", "LinkedIn URL", false], ["youtube", "YouTube URL", false],
                  ["tiktok", "TikTok URL", false],
                ] as const).map(([key, label, required]) => (
                  <label key={key} style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700, color: "#444" }}>
                    {label}{required ? " *" : ""}
                    <input required={required} value={orgForm[key]} onChange={(e) => setOrgForm({ ...orgForm, [key]: e.target.value })} style={{ padding: "10px 12px", border: "1.5px solid #ddd5ca", borderRadius: 8, fontSize: 14 }} />
                  </label>
                ))}
                {([["description", "Description"], ["mission", "Mission"]] as const).map(([key, label]) => (
                  <label key={key} style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700, color: "#444" }}>
                    {label}
                    <textarea rows={key === "description" ? 5 : 3} value={orgForm[key]} onChange={(e) => setOrgForm({ ...orgForm, [key]: e.target.value })} style={{ padding: "10px 12px", border: "1.5px solid #ddd5ca", borderRadius: 8, fontSize: 14, resize: "vertical" }} />
                  </label>
                ))}
              </div>
              <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid #eee7dd", padding: "16px 24px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setEditingOrg(null)} disabled={savingOrg} style={{ padding: "10px 16px", border: "1px solid #d8d0c5", borderRadius: 8, background: "#fff", cursor: "pointer" }}>Cancel</button>
                <button onClick={saveOrganisation} disabled={savingOrg || !orgForm.name.trim() || !orgForm.category.trim()} style={{ padding: "10px 18px", border: 0, borderRadius: 8, background: RED_DEEP, color: "#fff", fontWeight: 800, cursor: savingOrg ? "wait" : "pointer", opacity: savingOrg ? .65 : 1 }}>
                  {savingOrg ? "Saving…" : "Save profile"}
                </button>
              </div>
            </div>
          </div>
        )}

        {payoutOrg && (
          <div role="dialog" aria-modal="true" aria-labelledby="payout-editor-title" style={{ position: "fixed", inset: 0, background: "rgba(20,10,5,0.55)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ width: "min(480px, 100%)", background: "#fff", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee7dd", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div><h2 id="payout-editor-title" style={{ margin: 0, fontSize: 20 }}>Bank transfer payout</h2><p style={{ margin: "4px 0 0", color: "#777", fontSize: 13 }}>{payoutOrg.name}</p></div>
                <button aria-label="Close" onClick={() => setPayoutOrg(null)} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 6 }}><X size={20} /></button>
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
                  Status: <strong>{payoutOrg.payoutManualApproved ? "Approved" : "Requested — awaiting approval"}</strong>
                </p>
                <div style={{ background: "#FEF9C3", color: "#92400E", borderRadius: 8, padding: "10px 12px", fontSize: 12, lineHeight: 1.5 }}>
                  Do not enter account numbers, routing numbers, sort codes, IBANs or any bank account details. Those are held with our banking provider, outside the platform.
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700, color: "#444" }}>
                  Provider / payee label (optional)
                  <input data-testid="input-manual-payout-label" maxLength={100} value={payoutLabel} onChange={(e) => setPayoutLabel(e.target.value)} placeholder="e.g. NCB Jamaica — payee saved 20 Oct" style={{ padding: "10px 12px", border: "1.5px solid #ddd5ca", borderRadius: 8, fontSize: 14 }} />
                  <span style={{ fontSize: 11, fontWeight: 400, color: "#999" }}>{payoutLabel.length}/100</span>
                </label>
                {payoutError && <p style={{ margin: 0, color: RED, fontSize: 13 }}>{payoutError}</p>}
              </div>
              <div style={{ borderTop: "1px solid #eee7dd", padding: "16px 24px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setPayoutOrg(null)} disabled={savingPayout} style={{ padding: "10px 16px", border: "1px solid #d8d0c5", borderRadius: 8, background: "#fff", cursor: "pointer" }}>Cancel</button>
                <button data-testid="button-save-manual-payout" onClick={saveManualPayout} disabled={savingPayout || payoutLabel.length > 100} style={{ padding: "10px 18px", border: 0, borderRadius: 8, background: "#16a34a", color: "#fff", fontWeight: 800, cursor: savingPayout ? "wait" : "pointer", opacity: savingPayout ? .65 : 1 }}>
                  {savingPayout ? "Saving…" : payoutOrg.payoutManualApproved ? "Save label" : "Approve bank transfer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Donations tab ─────────────────────────────────────────── */}
        {tab === "donations" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}>Donations</h1>
                <p style={{ margin: "4px 0 0", fontSize: 14, color: "#888" }}>
                  {donations.length > 0 ? `${donations.length} donations (most recent 200)` : "All recorded donations"}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>
                  Missing accounting fields on older donations are shown as —; historical records have not been recalculated.
                </p>
              </div>
              <button
                onClick={fetchDonations}
                style={{ padding: "8px 12px", border: "1.5px solid #e0d8cc", borderRadius: 8, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#555" }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {loadingDons ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#888" }}>Loading…</div>
            ) : donations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", background: "#fff", borderRadius: 12 }}>
                <CreditCard size={40} color="#ccc" style={{ margin: "0 auto 12px" }} />
                <p style={{ color: "#888", fontSize: 15 }}>No donations yet</p>
              </div>
            ) : (
              <div style={{ background: "#fff", borderRadius: 12, overflowX: "auto", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9f6f0" }}>
                      <th style={TH}>Organisation</th>
                      <th style={TH}>Donor</th>
                      <th style={TH}>Intended</th>
                      <th style={TH}>Charged</th>
                      <th style={TH}>Platform fee</th>
                      <th style={TH}>To Org</th>
                      <th style={TH}>Fee covered</th>
                      <th style={TH}>Type</th>
                      <th style={TH}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donations.map((d, i) => {
                      const money = (value: number | undefined) =>
                        typeof value === "number" && Number.isFinite(value) ? `£${value.toFixed(2)}` : "—";
                      return (
                        <tr key={d._id ?? i}>
                          <td style={{ ...TD, fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>
                            {d.orgName || "—"}
                          </td>
                          <td style={{ ...TD, fontSize: 13, color: "#555" }}>
                            {d.guestEmail
                              ? <span style={{ color: "#888" }}>{d.guestEmail} <span style={{ fontSize: 11, background: "#f2ede4", padding: "1px 6px", borderRadius: 4 }}>guest</span></span>
                              : d.userId && d.userId !== "anonymous" && d.userId !== "guest"
                              ? <span style={{ fontFamily: "monospace", fontSize: 11, color: "#888" }}>{d.userId.slice(0, 10)}…</span>
                              : <span style={{ color: "#bbb" }}>anonymous</span>
                            }
                          </td>
                          <td style={{ ...TD, fontSize: 14, fontWeight: 700, color: RED }}>
                            {money(d.intendedGbp)}
                          </td>
                          <td style={{ ...TD, fontSize: 14, fontWeight: 700, color: RED }}>
                            {money(d.chargedGbp)}
                          </td>
                          <td style={{ ...TD, fontSize: 13, color: "#555" }}>
                            {money(d.platformFeeGbp)}
                          </td>
                          <td style={{ ...TD, fontSize: 13, color: "#166534", fontWeight: 600 }}>
                            {money(d.toOrgGbp)}
                          </td>
                          <td style={{ ...TD, textAlign: "center" as const }}>
                            {d.feeCovered ? (
                              <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                                ✓ +£{(d.feeAmountGbp ?? 0).toFixed(2)}
                              </span>
                            ) : (
                              <span style={{ color: "#bbb", fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td style={{ ...TD, fontSize: 12, color: "#888" }}>
                            {(d.type ?? "one_time").replace(/_/g, " ")}
                          </td>
                          <td style={{ ...TD, fontSize: 13, color: "#888" }}>{formatDate(d.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Supporters tab ────────────────────────────────────────── */}
        {tab === "supporters" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}>Supporters</h1>
                <p style={{ margin: "4px 0 0", fontSize: 14, color: "#888" }}>
                  {supporters.length > 0 ? `${supporters.length} supporters registered` : "All registered supporters"}
                </p>
              </div>
              <button
                onClick={fetchSupporters}
                style={{ padding: "8px 12px", border: "1.5px solid #e0d8cc", borderRadius: 8, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#555" }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {loadingSups ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#888" }}>Loading…</div>
            ) : supporters.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", background: "#fff", borderRadius: 12 }}>
                <Users size={40} color="#ccc" style={{ margin: "0 auto 12px" }} />
                <p style={{ color: "#888", fontSize: 15 }}>No supporters yet</p>
              </div>
            ) : (
              <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9f6f0" }}>
                      <th style={TH}>Name</th>
                      <th style={TH}>Email</th>
                      <th style={TH}>Phone</th>
                      <th style={TH}>Date Signed Up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supporters.map((s, i) => (
                      <tr key={s._id ?? s.uid ?? i}>
                        <td style={TD}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Avatar name={s.name ?? "?"} size={32} />
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{s.name}</span>
                          </div>
                        </td>
                        <td style={TD}>
                          <a href={`mailto:${s.email}`} style={{ color: RED, fontSize: 14, textDecoration: "none" }}>{s.email}</a>
                        </td>
                        <td style={{ ...TD, fontSize: 13, color: "#555" }}>
                          {s.phone ?? <span style={{ color: "#bbb" }}>—</span>}
                        </td>
                        <td style={{ ...TD, fontSize: 13, color: "#888" }}>
                          {formatDate(s.signedUpAt ?? s.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
