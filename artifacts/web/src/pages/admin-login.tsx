import { useState } from "react";
import { useLocation } from "wouter";

const RED_DEEP = "#7A0000";
const RED = "#B50000";
const GOLD = "#F5B800";

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json() as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setError(data.error ?? "Invalid password");
        setLoading(false);
        return;
      }
      localStorage.setItem("admin_token", data.token);
      setLocation("/admin");
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: RED_DEEP, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo-stylised.png" alt="Root ProjX" style={{ height: 44, objectFit: "contain", marginBottom: 16 }} />
          <h1 style={{ margin: 0, color: GOLD, fontSize: 22, fontWeight: 900 }}>Admin Dashboard</h1>
          <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.7)", fontSize: 14 }}>Internal access only</p>
        </div>

        <form onSubmit={handleLogin} style={{ background: "#fff", borderRadius: 16, padding: "36px 40px", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>
            Admin password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            autoFocus
            style={{
              width: "100%", padding: "11px 14px", fontSize: 15,
              border: "1.5px solid #e0d8cc", borderRadius: 8, outline: "none",
              background: "#fafaf8", boxSizing: "border-box", fontFamily: "inherit",
              marginBottom: 8,
            }}
          />
          {error && <p style={{ margin: "0 0 12px", fontSize: 14, color: RED }}>{error}</p>}
          <button
            type="submit"
            disabled={!password || loading}
            style={{
              width: "100%", padding: "12px", fontSize: 15, fontWeight: 700,
              background: !password || loading ? "#ccc" : RED,
              color: "#fff", border: "none", borderRadius: 8,
              cursor: !password || loading ? "not-allowed" : "pointer",
              marginTop: 4,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
