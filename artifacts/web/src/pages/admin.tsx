import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Clock, Users, FileText, LogOut, RefreshCw } from "lucide-react";

const RED_DEEP = "#7A0000";
const RED = "#B50000";
const GOLD = "#F5B800";

interface OrgApplication {
  _id: string;
  orgName: string;
  contactName: string;
  email: string;
  sectors: string[];
  status: "pending" | "approved" | "declined";
  createdAt: string;
  approvedAt?: string;
  declinedAt?: string;
}

interface Supporter {
  uid: string;
  name: string;
  email: string;
  createdAt: string | null;
  phone: string | null;
}

function StatusBadge({ status }: { status: "pending" | "approved" | "declined" }) {
  const map = {
    pending: { bg: "#FEF9C3", color: "#92400E", label: "Pending" },
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

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"applications" | "supporters">("applications");
  const [applications, setApplications] = useState<OrgApplication[]>([]);
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingSups, setLoadingSups] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "declined">("pending");

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

  useEffect(() => {
    if (!token) { setLocation("/admin/login"); return; }
    fetchApplications();
  }, [token, fetchApplications]);

  useEffect(() => {
    if (tab === "supporters" && supporters.length === 0) fetchSupporters();
  }, [tab]);

  async function handleApprove(id: string) {
    if (!confirm("Approve this application? This will create their organisation account and send an acceptance email.")) return;
    setActionLoading(id + "_approve");
    try {
      const res = await fetch(`/api/admin/applications/${id}/approve`, {
        method: "POST",
        headers: { "x-admin-token": token },
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        alert(data.error ?? "Failed to approve application.");
        return;
      }
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
      const res = await fetch(`/api/admin/applications/${id}/decline`, {
        method: "POST",
        headers: { "x-admin-token": token },
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        alert(data.error ?? "Failed to decline application.");
        return;
      }
      await fetchApplications();
    } catch {
      alert("Network error — please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 700,
    border: "none",
    borderBottom: active ? `3px solid ${GOLD}` : "3px solid transparent",
    background: "none",
    color: active ? GOLD : "rgba(255,255,255,0.7)",
    cursor: "pointer",
    transition: "color 0.15s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f2ede4" }}>
      {/* Top bar */}
      <div style={{ background: RED_DEEP, padding: "0 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <img src="/logo-stylised.png" alt="Root ProjX" style={{ height: 36, objectFit: "contain", padding: "12px 0" }} />
            <div style={{ display: "flex" }}>
              <button style={tabStyle(tab === "applications")} onClick={() => setTab("applications")}>
                <FileText size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                Applications
              </button>
              <button style={tabStyle(tab === "supporters")} onClick={() => setTab("supporters")}>
                <Users size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                Supporters
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

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── Applications tab ─────────────────────────────────────── */}
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

            {error && <p style={{ color: RED, marginBottom: 16 }}>{error}</p>}

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
                  <div
                    key={app._id}
                    style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "flex-start", gap: 20 }}
                  >
                    {/* Avatar */}
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: RED_DEEP, color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                      {app.orgName.slice(0, 1).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: "#1a1a1a" }}>{app.orgName}</span>
                        <StatusBadge status={app.status} />
                      </div>
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

                    {/* Actions */}
                    {app.status === "pending" && (
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => handleApprove(app._id)}
                          disabled={actionLoading !== null}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: "#16a34a", color: "#fff", border: "none",
                            borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700,
                            cursor: actionLoading !== null ? "not-allowed" : "pointer", opacity: actionLoading !== null ? 0.6 : 1,
                          }}
                        >
                          <CheckCircle2 size={14} />
                          {actionLoading === app._id + "_approve" ? "Approving…" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleDecline(app._id, app.orgName)}
                          disabled={actionLoading !== null}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: "#fff", color: RED, border: `1.5px solid ${RED}`,
                            borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700,
                            cursor: actionLoading !== null ? "not-allowed" : "pointer", opacity: actionLoading !== null ? 0.6 : 1,
                          }}
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

        {/* ── Supporters tab ───────────────────────────────────────── */}
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

            {error && <p style={{ color: RED, marginBottom: 16 }}>{error}</p>}

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
                      <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>Name</th>
                      <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</th>
                      <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supporters.map((s, i) => (
                      <tr key={s.uid ?? i} style={{ borderTop: "1px solid #f0ece4" }}>
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: RED_DEEP, color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                              {(s.name ?? "?").slice(0, 1).toUpperCase()}
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{s.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px", fontSize: 14, color: "#555" }}>
                          <a href={`mailto:${s.email}`} style={{ color: RED, textDecoration: "none" }}>{s.email}</a>
                        </td>
                        <td style={{ padding: "14px 20px", fontSize: 13, color: "#888" }}>{formatDate(s.createdAt)}</td>
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
