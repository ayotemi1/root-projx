import { appFetch as fetch, userErrorMessage, responseError } from "@/lib/error-feedback";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Clock, Users, FileText, LogOut, RefreshCw, Building2, CreditCard, Pencil, X, Wallet, Wrench, MoreHorizontal, ImageOff } from "lucide-react";
import { AdminPayouts } from "@/components/admin-payouts";
import { BankTransferApprovals } from "@/components/bank-transfer-approvals";
import { useQueryClient } from "@tanstack/react-query";
import { adminPayoutsKey } from "@/lib/payouts-api";
import { AdminDeleteOrganisation } from "@/components/admin-delete-organisation";
import { AdminBankDetailsReview } from "@/components/admin-bank-details-review";
import { AdminTestEmail } from "@/components/admin-test-email";
import "@/components/dashboard/operations.css";
import { uploadMedia } from "@/lib/api";

const ADMIN_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ADMIN_IMAGE_MAX = 20 * 1024 * 1024;

/** Uploads via a scoped organisation bearer from POST /admin/organisations/:id/access.
 *  The shared admin token is only sent to that access endpoint, never to uploads. */
async function uploadOrgImageAsAdmin(orgId: string, file: File, adminToken: string): Promise<string> {
  if (!ADMIN_IMAGE_TYPES.includes(file.type)) throw new Error("This image format isn\u2019t supported. Choose JPEG, PNG, WebP or GIF.");
  if (!file.size) throw new Error("This image file is empty. Choose another file.");
  if (file.size > ADMIN_IMAGE_MAX) throw new Error("This image is too large. Choose an image of 20 MB or smaller.");
  const res = await fetch(`/api/admin/organisations/${encodeURIComponent(orgId)}/access`, { method: "POST", headers: { "x-admin-token": adminToken } });
  if (res.status === 401) throw Object.assign(new Error("Your admin session has expired. Sign in again."), { status: 401 });
  const access = await res.json().catch(() => ({})) as { token?: string; error?: string };
  if (!res.ok || !access.token) throw new Error(userErrorMessage({ message: access.error, status: res.status }, "open upload access for this organisation"));
  const [url] = await uploadMedia([file], access.token);
  if (!url) throw new Error("The upload finished without returning an image. Try again.");
  return url;
}

const RED_DEEP = "#17100F";
const RED = "#CA0813";
const GOLD = "#F3BF2C";

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
        <span style={{ fontSize: 12, fontWeight: 700, color: org.payoutManualApproved ? "#166534" : "#92400E", background: org.payoutManualApproved ? "#DCFCE7" : "#FEF9C3", padding: "2px 8px", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: ".04em" }}>
          Bank transfer · {org.payoutManualApproved ? "Approved" : "Requested"}
        </span>
        {org.payoutManualLabel && <span style={{ fontSize: 12, color: "#666" }}>{org.payoutManualLabel}</span>}
        <button data-testid={`button-manual-payout-${org._id}`} onClick={onManage} className="ops-btn ops-btn--sm">
          {org.payoutManualApproved ? "Review bank details" : "Review & approve"}
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

const ORG_FORM_GROUPS: Array<{ title: string; fields: Array<readonly [keyof OrganisationForm, string, "text" | "url" | "image" | "long"]> }> = [
  { title: "Identity", fields: [["name", "Organisation name", "text"], ["category", "Category", "text"], ["description", "Description", "long"], ["mission", "Mission", "long"]] },
  { title: "Location", fields: [["city", "City", "text"], ["country", "Country", "text"]] },
  { title: "Images", fields: [["logo", "Logo image URL", "image"], ["coverImage", "Banner image URL", "image"]] },
  { title: "Public contact", fields: [["email", "Public email", "text"], ["phone", "Public phone", "text"], ["website", "Website URL", "url"]] },
  { title: "Social links", fields: [["instagram", "Instagram URL", "url"], ["facebook", "Facebook URL", "url"], ["twitter", "X / Twitter URL", "url"], ["linkedin", "LinkedIn URL", "url"], ["youtube", "YouTube URL", "url"], ["tiktok", "TikTok URL", "url"]] },
];

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
  currency?: string;
  receiptAccounting?: { chargedGbp: number };
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
    <span className="ops-chip" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Avatar({ name, size = 44 }: { name?: string; size?: number }) {
  const initials = (name ?? "").trim().split(" ").filter(Boolean).map((w) => w[0]!.toUpperCase()).slice(0, 2).join("") || "?";
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

const TH: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 700, color: "#6B5F5A", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1.5px solid #17100F", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "10px 12px", borderTop: "1px solid #DDD5CC", verticalAlign: "top" };

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"applications" | "supporters" | "organisations" | "donations" | "payouts" | "tools">("applications");

  const [applications, setApplications]   = useState<OrgApplication[]>([]);
  const [supporters,   setSupporters]     = useState<Supporter[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [donations,    setDonations]      = useState<Donation[]>([]);

  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingSups, setLoadingSups] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgsError, setOrgsError] = useState("");
  const [loadingDons, setLoadingDons] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "declined">("pending");
  const [editingOrg, setEditingOrgState] = useState<Organisation | null>(null);
  const imageRequest = useRef(0);
  const setEditingOrg = (org: Organisation | null) => {
    imageRequest.current += 1;
    setEditingOrgState(org);
    setImageUpload(null);
  };
  const [orgForm, setOrgForm] = useState<OrganisationForm | null>(null);
  const [savingOrg, setSavingOrg] = useState(false);
  const [imageUpload, setImageUpload] = useState<{ key: "logo" | "coverImage"; busy: boolean; error: string } | null>(null);

  async function handleOrgImage(key: "logo" | "coverImage", file: File | undefined) {
    if (!file || !editingOrg) return;
    const orgId = editingOrg._id;
    const request = ++imageRequest.current;
    setImageUpload({ key, busy: true, error: "" });
    try {
      const url = await uploadOrgImageAsAdmin(orgId, file, token);
      if (request !== imageRequest.current) return;
      // Kept in editor state only; persisted when the admin presses Save profile.
      setOrgForm((current) => current ? { ...current, [key]: url } : current);
      setImageUpload(null);
    } catch (err) {
      if (request !== imageRequest.current) return;
      if ((err as { status?: number }).status === 401) { logout(); return; }
      setImageUpload({ key, busy: false, error: userErrorMessage(err, "upload this image") });
    }
  }
  const [payoutOrg, setPayoutOrg] = useState<Organisation | null>(null);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutNotice, setPayoutNotice] = useState("");

  function openPayout(org: Organisation) {
    setPayoutOrg(org);
    setPayoutBusy(false);
    setPayoutNotice("");
  }

  function handleBankApproved() {
    if (!payoutOrg) return;
    const id = payoutOrg._id, name = payoutOrg.name;
    setOrganisations((current) => current.map((org) => org._id === id ? { ...org, payoutManualApproved: true } : org));
    setPayoutNotice(`Bank details approved for ${name}. No money has been sent.`);
    queryClient.invalidateQueries({ queryKey: adminPayoutsKey });
    setPayoutOrg(null);
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
      if (!res.ok) throw await responseError(res, "load organisation applications");
      const data = await res.json() as OrgApplication[];
      setApplications(data);
    } catch {
      setError("We couldn’t load applications. Check your connection and refresh the list. If it still fails, sign into the admin panel again or contact Root ProjX.");
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
      if (!res.ok) throw await responseError(res, "load supporters");
      const data = await res.json() as Supporter[];
      setSupporters(data);
    } catch {
      setError("We couldn’t load supporters. Check your connection and refresh the list. If it still fails, sign into the admin panel again or contact Root ProjX.");
    } finally {
      setLoadingSups(false);
    }
  }, [token]);

  const fetchOrganisations = useCallback(async () => {
    setLoadingOrgs(true);
    setOrgsError("");
    try {
      const res = await fetch("/api/admin/organisations", { headers: { "x-admin-token": token } });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw new Error("Failed to load organisations.");
      const data = await res.json() as Organisation[];
      if (!Array.isArray(data)) throw new Error("Invalid organisation response.");
      setOrganisations(data);
    } catch {
      setOrgsError("Could not load bank-transfer requests and organisations. Please refresh to try again.");
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
      if (!res.ok) throw await responseError(res, "load donation records");
      const data = await res.json() as Donation[];
      setDonations(data);
    } catch {
      setError("We couldn’t load donations. Refresh the list when your connection is stable. No figures are being estimated. If it continues, contact Root ProjX.");
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
    if (tab === "donations"     && donations.length     === 0) fetchDonations();
  }, [tab]);

  useEffect(() => {
    if (!token || (tab !== "payouts" && tab !== "organisations")) return;
    fetchOrganisations();
    const refresh = () => { fetchOrganisations(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [tab, token, fetchOrganisations]);

  async function handleApprove(id: string) {
    if (!confirm("Approve this application? This will create their organisation account and send an acceptance email.")) return;
    setActionLoading(id + "_approve");
    try {
      const res = await fetch(`/api/admin/applications/${id}/approve`, { method: "POST", headers: { "x-admin-token": token } });
      const data = await res.json() as { error?: string };
      if (!res.ok) { alert(userErrorMessage({ message: data.error, status: res.status }, "approve this application")); return; }
      await fetchApplications();
    } catch {
      alert("We couldn’t confirm the approval. Check your connection and refresh the application status before approving again.");
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
      if (!res.ok) { alert(userErrorMessage({ message: data.error, status: res.status }, "decline this application")); return; }
      await fetchApplications();
    } catch {
      alert("We couldn’t confirm the decision. Check your connection and refresh the application status before trying again.");
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
      if (!res.ok) { alert(userErrorMessage({ message: data.error, status: res.status }, "save this organisation")); return; }
      setOrganisations((current) => current.map((org) => org._id === data._id ? data : org));
      setEditingOrg(null);
      setOrgForm(null);
    } catch {
      alert("We couldn’t confirm your changes were saved. Keep this page open, check your connection and retry. If it continues, contact Root ProjX.");
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
    <div className="ops">

      <div className="ops-adminbar">
        <div className="ops-adminbar-inner">
          <img src="/logo-stylised.png" alt="Root ProjX" style={{ height: 30, objectFit: "contain", padding: "10px 0" }} />
          <span className="ops-label" style={{ color: GOLD }}>Admin</span>
          <nav className="ops-admintabs" role="tablist" aria-label="Admin sections">
              <button type="button" role="tab" aria-selected={tab === "applications"} className="ops-admintab" onClick={() => setTab("applications")}><FileText size={14} />Applications</button>
              <button type="button" role="tab" aria-selected={tab === "organisations"} className="ops-admintab" onClick={() => setTab("organisations")}><Building2 size={14} />Organisations</button>
              <button type="button" role="tab" aria-selected={tab === "supporters"} className="ops-admintab" onClick={() => setTab("supporters")}><Users size={14} />Supporters</button>
              <button type="button" role="tab" aria-selected={tab === "donations"} className="ops-admintab" onClick={() => setTab("donations")}><CreditCard size={14} />Donations</button>
              <button type="button" role="tab" aria-selected={tab === "payouts"} className="ops-admintab" onClick={() => setTab("payouts")} data-testid="tab-payouts"><Wallet size={14} />Payouts</button>
              <button type="button" role="tab" aria-selected={tab === "tools"} className="ops-admintab" onClick={() => setTab("tools")} data-testid="tab-tools"><Wrench size={14} />Tools</button>
          </nav>
          <button type="button" onClick={logout} className="ops-admintab" style={{ marginLeft: "auto" }} data-testid="button-admin-logout"><LogOut size={14} /> Sign out</button>
        </div>
      </div>

      <div className="ops-adminmain">

        {tab === "tools" && (
          <>
            <div className="ops-adminhead"><div><h1>Tools</h1><p>Operational checks for administrators. Nothing here changes organisations or money.</p></div></div>
            <section aria-label="Send test email" style={{ background: "#FBF8F2", borderTop: "1.5px solid #17100F", padding: "4px 0" }}>
              <AdminTestEmail token={token} onUnauthorized={logout} />
            </section>
          </>
        )}
        {error && <p style={{ color: RED, marginBottom: 16 }}>{error}</p>}

        {payoutNotice && <p role="status" style={{ color: RED_DEEP, marginBottom: 16 }}>{payoutNotice}</p>}
        {tab === "payouts" && (
          <>
            <BankTransferApprovals organisations={organisations} loading={loadingOrgs} error={orgsError}
              onRefresh={fetchOrganisations} onReview={(id) => {
                const org = organisations.find(item => item._id === id);
                if (org) openPayout(org);
              }} />
            <AdminPayouts token={token} onUnauthorized={logout} />
          </>
        )}

        {/* ── Applications tab ──────────────────────────────────────── */}
        {tab === "applications" && (
          <>
            <div className="ops-adminhead">
              <div>
                <h1>Organisation Applications</h1>
                <p>Review and approve or decline incoming applications</p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  style={{ minHeight: 32, padding: "0 10px", fontSize: 13 }} aria-label="Filter applications by status"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="declined">Declined</option>
                  <option value="all">All</option>
                </select>
                <button
                  onClick={fetchApplications}
                  className="ops-btn ops-btn--sm"
                >
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>
            </div>

            {loadingApps ? (
              <div className="ops-empty" role="status">Loading…</div>
            ) : applications.length === 0 ? (
              <div className="ops-empty">
                <Clock size={40} color="#ccc" style={{ margin: "0 auto 12px" }} />
                <p style={{ color: "#888", fontSize: 15 }}>No {statusFilter === "all" ? "" : statusFilter} applications</p>
              </div>
            ) : (
              <div className="ops-list">
                {applications.map((app) => (
                  <div key={app._id} className="ops-row" data-testid={`row-application-${app._id}`}>
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
                      <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                        <button
                          onClick={() => handleApprove(app._id)}
                          disabled={actionLoading !== null}
                          className="ops-btn ops-btn--sm ops-btn--ok"
                        >
                          <CheckCircle2 size={14} />
                          {actionLoading === app._id + "_approve" ? "Approving…" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleDecline(app._id, app.orgName)}
                          disabled={actionLoading !== null}
                          className="ops-btn ops-btn--sm" style={{ color: RED, borderColor: RED }}
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
            <div className="ops-adminhead">
              <div>
                <h1>Organisations</h1>
                <p>
                  {organisations.length > 0 ? `${organisations.length} active organisations` : "All approved organisations on the platform"}
                </p>
              </div>
              <button
                onClick={fetchOrganisations}
                className="ops-btn ops-btn--sm"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {orgsError && <p role="alert" style={{ color: RED }}>{orgsError}</p>}
            {loadingOrgs ? (
              <div className="ops-empty" role="status">Loading…</div>
            ) : organisations.length === 0 ? (
              <div className="ops-empty">
                <Building2 size={40} color="#ccc" style={{ margin: "0 auto 12px" }} />
                <p style={{ color: "#888", fontSize: 15 }}>No organisations yet</p>
              </div>
            ) : (
              <div className="ops-table-wrap">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th style={TH}>Organisation</th>
                      <th style={TH}>Category</th>
                      <th style={TH}>Country</th>
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
                              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#1a1a1a" }}>{org.name || "Unnamed organisation"}</p>
                              <p data-testid={`text-org-city-${org._id}`} style={{ margin: "2px 0 0", fontSize: 12, color: org.city ? "#6B5F5A" : "#B5ABA3" }}>{org.city || "City not set"}</p>
                              {org.verified && (
                                <span className="ops-chip" style={{ color: "#1D6B3A", marginTop: 4 }}>Verified</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...TD, fontSize: 13, color: "#555" }}>{org.category ?? "—"}</td>
                        <td style={{ ...TD, fontSize: 13, color: "#555" }}>
                          {org.country ? org.country : <span style={{ color: "#bbb" }}>Not set</span>}
                        </td>
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
                          <span className="ops-num">£{(org.totalRaised ?? 0).toLocaleString()}</span>
                        </td>
                        <td style={{ ...TD, fontSize: 13, color: "#888" }}>{formatDate(org.createdAt)}</td>
                         <td style={TD}>
                           <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "nowrap" }}>
                             <a href={`${import.meta.env.BASE_URL}admin/organisations/${org._id}/manage?tab=overview`} className="ops-btn ops-btn--sm ops-btn--ink" style={{ textDecoration: "none", whiteSpace: "nowrap" }} data-testid={`link-open-dashboard-${org._id}`}>Open dashboard</a>
                             <button type="button" onClick={() => openOrgEditor(org)} className="ops-btn ops-btn--sm" style={{ whiteSpace: "nowrap" }} data-testid={`button-edit-org-${org._id}`}>
                               <Pencil size={13} /> Edit
                             </button>
                             <details className="ops-overflow" data-testid={`menu-org-overflow-${org._id}`}>
                               <summary className="ops-btn ops-btn--sm" aria-label={`More actions for ${org.name || "organisation"}`}><MoreHorizontal size={16} /></summary>
                               <div className="ops-overflow-menu">
                                 <p className="ops-label" style={{ margin: "0 0 4px", color: "#6B5F5A" }}>Danger zone</p>
                                 <AdminDeleteOrganisation org={org} token={token} onUnauthorized={logout} onDeleted={(id) => {
                                   setOrganisations((current) => current.filter((item) => item._id !== id));
                                   queryClient.invalidateQueries();
                                 }} />
                               </div>
                             </details>
                           </div>
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
          <div className="ops-dialog-back" role="dialog" aria-modal="true" aria-labelledby="org-editor-title">
            <form className="ops-dialog" onSubmit={(e) => { e.preventDefault(); void saveOrganisation(); }}>
              <div className="ops-dialog-head">
                <div><p className="ops-label" style={{ margin: 0, color: "#6B5F5A" }}>Edit organisation profile</p><h2 id="org-editor-title" style={{ margin: "4px 0 0", fontSize: 28, lineHeight: 1, textTransform: "uppercase" }}>{editingOrg.name || "Unnamed organisation"}</h2></div>
                <button type="button" aria-label="Close editor" disabled={savingOrg} onClick={() => setEditingOrg(null)} className="ops-btn ops-btn--sm"><X size={18} /></button>
              </div>
              <div className="ops-dialog-body">
                {ORG_FORM_GROUPS.map((group) => (
                  <fieldset key={group.title} className="ops-fieldset">
                    <legend className="ops-label">{group.title}</legend>
                    {group.fields.map(([key, label, kind]) => (
                      <label key={key} className="ops-field" style={kind === "long" ? { gridColumn: "1 / -1" } : undefined}>
                        <span>{label}{key === "name" || key === "category" ? " *" : ""}</span>
                        {kind === "long" ? (
                          <textarea rows={key === "description" ? 5 : 3} value={orgForm[key]} onChange={(e) => setOrgForm({ ...orgForm, [key]: e.target.value })} style={{ resize: "vertical" }} data-testid={`input-org-${key}`} />
                        ) : (
                          <input required={key === "name" || key === "category"} type={kind === "url" || kind === "image" ? "url" : key === "email" ? "email" : "text"} value={orgForm[key]} onChange={(e) => setOrgForm({ ...orgForm, [key]: e.target.value })} data-testid={`input-org-${key}`} />
                        )}
                        {kind === "image" && (
                          <span
                            className="ops-imgprev ops-image-dropzone"
                            role="group"
                            aria-label={`${label}: drop an image here or use Upload`}
                            onDragOver={(event) => {
                              event.preventDefault();
                              event.dataTransfer.dropEffect = imageUpload?.busy || savingOrg ? "none" : "copy";
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              if (!imageUpload?.busy && !savingOrg) void handleOrgImage(key as "logo" | "coverImage", event.dataTransfer.files[0]);
                            }}
                          >
                            {orgForm[key] ? <img src={orgForm[key]} alt={`${label} preview`} data-testid={`img-org-${key}-preview`} /> : <span style={{ width: 72, height: 48, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px dashed #B5ABA3", color: "#B5ABA3" }}><ImageOff size={16} /></span>}
                            <span className="ops-btn ops-btn--sm" style={{ position: "relative", overflow: "hidden", opacity: imageUpload?.busy ? .55 : 1 }}>
                              {imageUpload?.busy && imageUpload.key === key ? "Uploading…" : orgForm[key] ? "Replace" : "Upload"}
                              <input type="file" accept={ADMIN_IMAGE_TYPES.join(",")} disabled={!!imageUpload?.busy || savingOrg} aria-label={`Upload ${label}`}
                                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void handleOrgImage(key as "logo" | "coverImage", f); }}
                                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} data-testid={`input-upload-org-${key}`} />
                            </span>
                            {orgForm[key] && <button type="button" className="ops-btn ops-btn--sm" disabled={!!imageUpload?.busy} onClick={() => setOrgForm({ ...orgForm, [key]: "" })} data-testid={`button-remove-org-${key}`}>Remove</button>}
                          </span>
                        )}
                        {kind === "image" && imageUpload?.key === key && imageUpload.error && (
                          <span role="alert" style={{ color: RED, fontWeight: 400, fontSize: 12 }} data-testid={`error-upload-org-${key}`}>{imageUpload.error}</span>
                        )}
                      </label>
                    ))}
                  </fieldset>
                ))}
                <p style={{ fontSize: 12, color: "#6B5F5A", margin: "12px 0 0" }}>Drop an image into its preview area or use Upload. Uploaded or removed images take effect only when you press Save profile. JPEG, PNG, WebP or GIF, up to 20 MB.</p>
              </div>
              <div className="ops-dialog-foot">
                <button type="button" onClick={() => setEditingOrg(null)} disabled={savingOrg} className="ops-btn">Cancel</button>
                <button type="submit" disabled={savingOrg || !!imageUpload?.busy || !orgForm.name.trim() || !orgForm.category.trim()} className="ops-btn ops-btn--ink" data-testid="button-save-org-profile">
                  {savingOrg ? "Saving…" : "Save profile"}
                </button>
              </div>
            </form>
          </div>
        )}

        {payoutOrg && (
          <div className="ops-dialog-back" role="dialog" aria-modal="true" aria-labelledby="payout-editor-title">
            <div className="ops-dialog" style={{ width: "min(520px, 100%)", overflowY: "auto" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee7dd", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div><h2 id="payout-editor-title" style={{ margin: 0, fontSize: 20 }}>Bank transfer payout</h2><p style={{ margin: "4px 0 0", color: "#777", fontSize: 13 }}>{payoutOrg.name}</p></div>
                <button aria-label="Close" disabled={payoutBusy} onClick={() => setPayoutOrg(null)} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 6 }}><X size={20} /></button>
              </div>
              <div style={{ padding: 24 }}>
                <AdminBankDetailsReview key={payoutOrg._id} orgId={payoutOrg._id} orgName={payoutOrg.name} contactEmail={payoutOrg.contact?.email}
                  token={token} onUnauthorized={logout} onApproved={handleBankApproved} onBusyChange={setPayoutBusy} />
              </div>
              <div style={{ borderTop: "1px solid #eee7dd", padding: "16px 24px", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setPayoutOrg(null)} disabled={payoutBusy} style={{ padding: "10px 16px", border: "1px solid #d8d0c5", borderRadius: 8, background: "#fff", cursor: "pointer" }}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Donations tab ─────────────────────────────────────────── */}
        {tab === "donations" && (
          <>
            <div className="ops-adminhead">
              <div>
                <h1>Donations</h1>
                <p>
                  {donations.length > 0 ? `${donations.length} donations (most recent 200)` : "All recorded donations"}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>
                  Missing accounting fields on older donations are shown as —; historical records have not been recalculated.
                </p>
              </div>
              <button
                onClick={fetchDonations}
                className="ops-btn ops-btn--sm"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {loadingDons ? (
              <div className="ops-empty" role="status">Loading…</div>
            ) : donations.length === 0 ? (
              <div className="ops-empty">
                <CreditCard size={40} color="#ccc" style={{ margin: "0 auto 12px" }} />
                <p style={{ color: "#888", fontSize: 15 }}>No donations yet</p>
              </div>
            ) : (
              <div className="ops-table-wrap">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th style={TH}>Organisation</th>
                      <th style={TH}>Donor</th>
                      <th style={TH}>Intended</th>
                      <th style={TH}>Charged (GBP equivalent)</th>
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
                            {d.currency === "usd" && typeof d.receiptAccounting?.chargedGbp === "number" && (
                              <div style={{ fontSize: 11, color: "#888" }}>US${d.receiptAccounting.chargedGbp.toFixed(2)} charged</div>
                            )}
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
                                +£{(d.feeAmountGbp ?? 0).toFixed(2)}
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
            <div className="ops-adminhead">
              <div>
                <h1>Supporters</h1>
                <p>
                  {supporters.length > 0 ? `${supporters.length} supporters registered` : "All registered supporters"}
                </p>
              </div>
              <button
                onClick={fetchSupporters}
                className="ops-btn ops-btn--sm"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {loadingSups ? (
              <div className="ops-empty" role="status">Loading…</div>
            ) : supporters.length === 0 ? (
              <div className="ops-empty">
                <Users size={40} color="#ccc" style={{ margin: "0 auto 12px" }} />
                <p style={{ color: "#888", fontSize: 15 }}>No supporters yet</p>
              </div>
            ) : (
              <div className="ops-table-wrap">
                <table className="ops-table">
                  <thead>
                    <tr>
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
