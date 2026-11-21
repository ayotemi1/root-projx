import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Redirect, useLocation } from "wouter";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { SECTORS } from "@/lib/sectors";
import { userErrorMessage } from "@/lib/error-feedback";
import "./interests.css";

export const ONBOARDING_INTERESTS_FLAG = "rp_onboarding_interests";

function SectorPicker({ selected, onToggle, disabled }: {
  selected: string[]; onToggle: (s: string) => void; disabled?: boolean;
}) {
  return (
    <div className="rpi-grid" role="group" aria-labelledby="rpi-title">
      {SECTORS.map(s => {
        const on = selected.includes(s);
        return (
          <button key={s} type="button" className="rpi-chip" aria-pressed={on} disabled={disabled}
            onClick={() => onToggle(s)} data-testid={`button-interest-${s.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
            {on && <Check size={14} aria-hidden />} {s}
          </button>
        );
      })}
    </div>
  );
}

function toggle(list: string[], s: string) {
  return list.includes(s) ? list.filter(x => x !== s) : [...list, s];
}

export function OnboardingInterestsPage() {
  const { token, isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { sessionStorage.removeItem(ONBOARDING_INTERESTS_FLAG); }, []);
  if (!isAuthenticated || !token) return <Redirect to="/login" />;
  if (user?.accountType !== "supporter") return <Redirect to="/dashboard" />;

  const onContinue = async () => {
    setError(""); setSaving(true);
    try { await api.saveSupporterInterests(selected, token);
      await queryClient.invalidateQueries({ queryKey: ["interests", token] });
      navigate("/onboarding/follows"); }
    catch (e) { setError(userErrorMessage(e, "save your interests")); }
    finally { setSaving(false); }
  };

  return (
    <section className="rpi-page rp-rise" data-testid="page-onboarding-interests">
      <p className="rpi-kicker">Optional · Step 1 of 2</p>
      <h1 id="rpi-title" className="rpi-title">What kind of work are you interested in?</h1>
      <p className="rpi-lede">Pick as many as you like, or skip for now. Next, we will suggest a few organisations doing this work. Your interests are private, and you can change them any time in Settings.</p>
      <SectorPicker selected={selected} onToggle={s => setSelected(l => toggle(l, s))} disabled={saving} />
      {error && <p className="rpi-error" role="alert" data-testid="error-interests">{error}</p>}
      <div className="rpi-actions">
        <button type="button" className="rp-btn rp-btn-yellow rpi-btn" onClick={onContinue} disabled={saving} data-testid="button-continue-interests">
          {saving ? "Saving…" : "Continue"} {!saving && <ArrowRight size={16} aria-hidden />}
        </button>
        <button type="button" className="rp-link-u rpi-skip" disabled={saving} onClick={() => navigate("/onboarding/follows?interests=skipped")} data-testid="link-skip-interests">Skip</button>
      </div>
    </section>
  );
}

export function SettingsInterestsPage() {
  const { token, isAuthenticated, user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setStatus("loading"); setMsg(null);
    try { const r = await api.getSupporterInterests(token); setSelected(r.interests ?? []); setStatus("ready"); }
    catch { setStatus("error"); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  if (!isAuthenticated || !token) return <Redirect to="/login" />;
  if (user?.accountType !== "supporter") return <Redirect to="/dashboard" />;

  const onSave = async () => {
    setMsg(null); setSaving(true);
    try { const r = await api.saveSupporterInterests(selected, token); setSelected(r.interests ?? selected); setMsg({ ok: true, text: "Interests saved." }); }
    catch (e) { setMsg({ ok: false, text: userErrorMessage(e, "save your interests") }); }
    finally { setSaving(false); }
  };

  return (
    <section className="rpi-page" data-testid="page-settings-interests">
      <nav className="rpi-crumb" aria-label="Breadcrumb">
        <Link href="/settings" data-testid="link-back-settings">Settings</Link> <ChevronRight size={14} aria-hidden /> <span>Interests</span>
      </nav>
      <h1 id="rpi-title" className="rpi-title">What kind of work are you interested in?</h1>
      <p className="rpi-lede">Pick as many as you like, or none at all. You can change them here any time. Your interests are private.</p>
      {status === "loading" ? (
        <div className="rpi-grid" aria-busy="true" aria-label="Loading interests">
          {SECTORS.map(s => <span key={s} className="rpi-skel" />)}
        </div>
      ) : status === "error" ? (
        <div className="rpi-error" role="alert">
          <p>We couldn't load your saved interests.</p>
          <button type="button" className="rp-btn rp-btn-ghost rpi-btn" onClick={load} data-testid="button-retry-interests">Retry</button>
        </div>
      ) : (
        <>
          <SectorPicker selected={selected} onToggle={s => { setMsg(null); setSelected(l => toggle(l, s)); }} disabled={saving} />
          <div className="rpi-actions">
            <button type="button" className="rp-btn rp-btn-yellow rpi-btn" onClick={onSave} disabled={saving} data-testid="button-save-interests">
              {saving ? "Saving…" : "Save"}
            </button>
            <span className="rpi-count" data-testid="text-interest-count">{selected.length} selected</span>
          </div>
          {msg && <p className={msg.ok ? "rpi-ok" : "rpi-error"} role={msg.ok ? "status" : "alert"} data-testid="status-save-interests">{msg.text}</p>}
        </>
      )}
    </section>
  );
}

export function SettingsPage() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return (
    <section className="rpi-page" data-testid="page-settings">
      <h1 className="rpi-title">Settings</h1>
      <ul className="rpi-list">
        <li><Link href="/settings/interests" className="rpi-row" data-testid="link-settings-interests">
          <span><strong>Interests</strong><small>The kinds of work you want to see. Private to you.</small></span><ChevronRight size={18} aria-hidden />
        </Link></li>
        <li><Link href="/account" className="rpi-row" data-testid="link-settings-account">
          <span><strong>Account</strong><small>Name, phone and public profile.</small></span><ChevronRight size={18} aria-hidden />
        </Link></li>
      </ul>
    </section>
  );
}
