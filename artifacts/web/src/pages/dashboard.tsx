import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch, Link } from "wouter";
import { Switch } from "@/components/ui/switch";
import {
  CheckCircle, PlusCircle, Image as ImageIcon, X, ExternalLink,
  AlertCircle, Target, Calendar, Users, Trash2, ChevronDown, ChevronUp,
  Edit3, Check, Upload, Camera, Palette, Link as LinkIcon, Copy, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { PayoutSetup } from "@/components/payout-setup";
import type { FeedUpdate, Campaign, CampaignPhase } from "@/lib/api";

const UPDATE_TYPES = ["update", "milestone", "campaign"] as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

const TYPE_COLORS: Record<string, string> = {
  milestone: "bg-green-50 text-green-700 border-green-200",
  campaign:  "bg-yellow-50 text-yellow-700 border-yellow-200",
  update:    "bg-blue-50 text-blue-700 border-blue-200",
};

// ── Phase row inside campaign form ────────────────────────────────────────────

interface PhaseRow {
  id: string;
  title: string;
  description: string;
  targetAmount: number | null;
  completed: boolean;
}

function newPhase(index: number): PhaseRow {
  return { id: `phase_${Date.now()}_${index}`, title: "", description: "", targetAmount: null, completed: false };
}

// ── Campaign progress bar ─────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 bg-secondary rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Campaign card in dashboard list ──────────────────────────────────────────

function DashCampaignCard({
  campaign,
  orgId,
  token,
  onUpdated,
  onDeleted,
}: {
  campaign: Campaign;
  orgId: string;
  token: string;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editRaised, setEditRaised] = useState(false);
  const [raisedInput, setRaisedInput] = useState(String(campaign.amountRaised ?? 0));
  const [saving, setSaving] = useState(false);

  const [landingEnabled, setLandingEnabled] = useState(campaign.enabled ?? true);
  const [publicId, setPublicId] = useState(campaign.publicId ?? "");
  const [sharePath, setSharePath] = useState(campaign.sharePath ?? "");
  const [theme, setTheme] = useState(campaign.theme ?? {
    primaryColor: "#B50000",
    accentColor: "#F5B800",
    backgroundColor: "#FFF9F2",
    textColor: "#1A1A1A",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [landingFeedback, setLandingFeedback] = useState("");

  useEffect(() => {
    setLandingEnabled(campaign.enabled ?? true);
    setPublicId(campaign.publicId ?? "");
    setSharePath(campaign.sharePath ?? "");
    setTheme(campaign.theme ?? {
      primaryColor: "#B50000",
      accentColor: "#F5B800",
      backgroundColor: "#FFF9F2",
      textColor: "#1A1A1A",
    });
  }, [campaign.enabled, campaign.publicId, campaign.sharePath, campaign.theme]);

  const pct = campaign.goal > 0
    ? Math.min(100, Math.round((campaign.amountRaised / campaign.goal) * 100))
    : 0;

  async function handleSaveRaised() {
    const val = parseFloat(raisedInput);
    if (isNaN(val) || val < 0) return;
    setSaving(true);
    try {
      await api.updateCampaign(orgId, campaign._id, { amountRaised: val }, token);
      onUpdated();
    } finally {
      setSaving(false);
      setEditRaised(false);
    }
  }

  async function togglePhase(phase: CampaignPhase) {
    const newPhases = campaign.phases.map((p) =>
      p.id === phase.id ? { ...p, completed: !p.completed } : p,
    );
    await api.updateCampaign(orgId, campaign._id, { phases: newPhases }, token);
    onUpdated();
  }

  async function markComplete() {
    await api.updateCampaign(orgId, campaign._id, { status: "completed" }, token);
    onUpdated();
  }

  async function handleDelete() {
    if (!confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return;
    await api.deleteCampaign(orgId, campaign._id, token);
    onDeleted();
  }

  async function saveLandingSettings() {
    setSavingSettings(true);
    setLandingFeedback("");
    try {
      const updated = await api.updateCampaign(orgId, campaign._id, {
        enabled: landingEnabled,
        theme,
      }, token);
      setLandingEnabled(updated.enabled ?? true);
      setPublicId(updated.publicId ?? "");
      setSharePath(updated.sharePath ?? "");
      setTheme(updated.theme ?? theme);
      setLandingFeedback(updated.enabled ? "Published and ready to share." : "Saved. This landing page is hidden.");
      onUpdated();
    } catch {
      setLandingFeedback(
        landingEnabled
          ? "Add an organisation name during registration or in your public profile before publishing."
          : "We could not save these landing page settings. Please try again.",
      );
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleCopyLink() {
    const path = sharePath || (publicId ? `/campaigns/${publicId}` : "");
    if (!path) return;
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setLandingFeedback("Share link copied.");
    } catch {
      setLandingFeedback("Copy failed. Please copy the link from Preview instead.");
    }
  }

  const isCompleted = campaign.status === "completed";

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-white">
      {/* Cover image */}
      {campaign.imageUrl && (
        <img src={campaign.imageUrl} alt={campaign.name} className="w-full h-32 object-cover" />
      )}

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          {!campaign.imageUrl && (
            <div
              className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center bg-primary"
            >
              <Target className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm text-foreground leading-snug">{campaign.name}</h4>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isCompleted
                    ? "bg-gray-100 text-gray-600"
                    : "bg-green-50 text-green-700"
                }`}
              >
                {isCompleted ? "Completed" : "Active"}
              </span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#FFF7E6", color: "#B45309" }}
              >
                {campaign.type}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {campaign.description}
            </p>
          </div>
        </div>

        {/* Progress (fundraising) */}
        {campaign.type === "fundraising" && campaign.goal > 0 && (
          <div className="space-y-1.5">
            <ProgressBar value={campaign.amountRaised} max={campaign.goal} />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                £{(campaign.amountRaised ?? 0).toLocaleString()} raised
              </span>
              <span className="font-bold text-primary">
                {pct}% of £{campaign.goal.toLocaleString()}
              </span>
            </div>

            {/* Edit raised amount */}
            {editRaised ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">£</span>
                <Input
                  type="number"
                  min={0}
                  value={raisedInput}
                  onChange={(e) => setRaisedInput(e.target.value)}
                  className="h-8 text-sm flex-1"
                />
                <Button size="sm" className="h-8 px-3" onClick={handleSaveRaised} disabled={saving}>
                  {saving ? "…" : <Check className="w-4 h-4" />}
                </Button>
                <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => setEditRaised(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => { setRaisedInput(String(campaign.amountRaised ?? 0)); setEditRaised(true); }}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" /> Update raised amount
              </button>
            )}
          </div>
        )}

        {/* Volunteer count */}
        {campaign.type === "volunteer" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{campaign.volunteersNeeded} volunteers needed</span>
          </div>
        )}

        {/* Deadline */}
        {campaign.deadline && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>Deadline: {new Date(campaign.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        )}

        {/* Phases */}
        {campaign.phases && campaign.phases.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-foreground"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {campaign.phases.length} phase{campaign.phases.length !== 1 ? "s" : ""}
              {" · "}
              {campaign.phases.filter((p) => p.completed).length} completed
            </button>

            {expanded && (
              <div className="mt-2 space-y-2">
                {campaign.phases.map((phase) => (
                  <div
                    key={phase.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      phase.completed ? "bg-green-50 border-green-200" : "bg-secondary border-border"
                    }`}
                  >
                    <button
                      onClick={() => togglePhase(phase)}
                      className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${
                        phase.completed
                          ? "bg-green-500 border-green-500"
                          : "border-gray-300 hover:border-green-400"
                      }`}
                    >
                      {phase.completed && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${phase.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {phase.title}
                      </p>
                      {phase.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>
                      )}
                      {phase.targetAmount != null && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Target: £{phase.targetAmount.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Landing Page Settings Toggle */}
        <div className="pt-2 border-t border-border mt-3">
          <button
            onClick={() => setShowSettings((v) => !v)}
            data-testid={`button-settings-toggle-${campaign._id}`}
            className="flex items-center justify-between w-full text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            <span className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4" /> Share & Landing Page
            </span>
            {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showSettings && (
            <div className="mt-4 p-3 bg-secondary/30 rounded-xl border border-border space-y-4" data-testid={`panel-settings-${campaign._id}`}>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Publish Landing Page</Label>
                  <p className="text-xs text-muted-foreground">Make this campaign public.</p>
                </div>
                <Switch
                  checked={landingEnabled}
                  onCheckedChange={setLandingEnabled}
                  data-testid={`switch-publish-${campaign._id}`}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Share Link</Label>
                <div className="flex items-center gap-2">
                  {publicId && landingEnabled ? (
                    <>
                      <p className="flex-1 min-w-0 truncate text-xs text-muted-foreground" data-testid={`text-share-link-${campaign._id}`}>
                         {sharePath || `/campaigns/${publicId}`}
                      </p>
                      <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleCopyLink} title="Copy Link" data-testid={`button-copylink-${campaign._id}`}>
                        <Copy className="w-4 h-4" />
                      </Button>
                       <Link href={sharePath || `/campaigns/${publicId}`} target="_blank" className="inline-flex items-center justify-center h-8 px-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md" title="Preview landing page" data-testid={`link-preview-${campaign._id}`}>
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground" data-testid={`text-share-link-pending-${campaign._id}`}>
                      Publish and save to create a secure share link.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="text-xs font-semibold flex items-center gap-1.5"><Palette className="w-3.5 h-3.5"/> Theme Colors</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Primary</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" data-testid={`input-color-primary-${campaign._id}`} value={theme.primaryColor} onChange={e => setTheme(t => ({...t, primaryColor: e.target.value}))} className="w-6 h-6 rounded cursor-pointer" />
                      <Input aria-label="Primary colour value" value={theme.primaryColor} onChange={e => setTheme(t => ({...t, primaryColor: e.target.value}))} className="h-7 text-xs" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Accent</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" data-testid={`input-color-accent-${campaign._id}`} value={theme.accentColor} onChange={e => setTheme(t => ({...t, accentColor: e.target.value}))} className="w-6 h-6 rounded cursor-pointer" />
                      <Input aria-label="Accent colour value" value={theme.accentColor} onChange={e => setTheme(t => ({...t, accentColor: e.target.value}))} className="h-7 text-xs" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Background</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" data-testid={`input-color-bg-${campaign._id}`} value={theme.backgroundColor} onChange={e => setTheme(t => ({...t, backgroundColor: e.target.value}))} className="w-6 h-6 rounded cursor-pointer" />
                      <Input aria-label="Background colour value" value={theme.backgroundColor} onChange={e => setTheme(t => ({...t, backgroundColor: e.target.value}))} className="h-7 text-xs" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Text</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" data-testid={`input-color-text-${campaign._id}`} value={theme.textColor} onChange={e => setTheme(t => ({...t, textColor: e.target.value}))} className="w-6 h-6 rounded cursor-pointer" />
                      <Input aria-label="Text colour value" value={theme.textColor} onChange={e => setTheme(t => ({...t, textColor: e.target.value}))} className="h-7 text-xs" />
                    </div>
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                className="w-full h-8 text-xs font-bold mt-2"
                onClick={saveLandingSettings}
                disabled={savingSettings}
                data-testid={`button-save-settings-${campaign._id}`}
              >
                {savingSettings ? "Saving..." : "Save Settings"}
              </Button>
              {landingFeedback && (
                <p
                  className="text-xs text-muted-foreground text-center"
                  data-testid={`text-landing-feedback-${campaign._id}`}
                  role="status"
                >
                  {landingFeedback}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isCompleted && (
          <div className="flex gap-2 pt-1 border-t border-border mt-3">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs h-8 mt-2"
              onClick={markComplete}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Mark complete
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 mt-2 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={handleDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Campaign creation form ────────────────────────────────────────────────────

function CampaignForm({
  orgId,
  token,
  onSuccess,
  onCancel,
}: {
  orgId: string;
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [campName, setCampName] = useState("");
  const [campDescription, setCampDescription] = useState("");
  const [campType, setCampType] = useState<"fundraising" | "volunteer">("fundraising");
  const [campGoal, setCampGoal] = useState("");
  const [campVolunteers, setCampVolunteers] = useState("");
  const [campDeadline, setCampDeadline] = useState("");
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function addPhase() {
    setPhases((prev) => [...prev, newPhase(prev.length)]);
  }

  function removePhase(id: string) {
    setPhases((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePhaseField(id: string, field: keyof PhaseRow, value: string | number | boolean | null) {
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!campName.trim()) { setError("Campaign name is required."); return; }
    if (!campDescription.trim()) { setError("Description is required."); return; }
    if (campType === "fundraising" && (!campGoal || parseFloat(campGoal) <= 0)) {
      setError("Please enter a fundraising goal greater than 0.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      let imageUrl: string | null = null;
      if (coverFile) {
        setUploadingCover(true);
        const urls = await api.uploadMedia([coverFile], token);
        imageUrl = urls[0] ?? null;
        setUploadingCover(false);
      }

      await api.createCampaign(orgId, {
        name: campName.trim(),
        description: campDescription.trim(),
        type: campType,
        goal: campType === "fundraising" ? parseFloat(campGoal) || 0 : 0,
        volunteersNeeded: campType === "volunteer" ? parseInt(campVolunteers) || 0 : 0,
        deadline: campDeadline || null,
        imageUrl,
        phases: phases.map((p) => ({
          title: p.title,
          description: p.description,
          targetAmount: p.targetAmount,
          completed: false,
        })),
      }, token);

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setSubmitting(false);
      setUploadingCover(false);
    }
  }

  const submitLabel = uploadingCover ? "Uploading cover…" : submitting ? "Creating…" : "Create Campaign";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {error}
        </div>
      )}

      {/* Banner image */}
      <div>
        <Label className="text-sm font-semibold mb-1 block">Banner Image <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <p className="text-xs text-muted-foreground mb-3">Recommended: 1600x1200 pixels (4:3). Keep important content centred for smaller screens.</p>
        {coverPreview ? (
          <div className="relative">
            <img src={coverPreview} alt="banner" className="w-full h-36 object-cover rounded-xl border border-border" />
            <button
              type="button"
              onClick={() => { setCoverFile(null); setCoverPreview(null); }}
              className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleCoverChange}
            />
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors w-full"
            >
              <ImageIcon className="w-4 h-4" /> Upload a banner image
            </button>
          </>
        )}
      </div>

      {/* Name */}
      <div>
        <Label htmlFor="camp-name">Campaign Name</Label>
        <Input
          id="camp-name"
          placeholder="e.g. School Supplies Drive 2025"
          value={campName}
          onChange={(e) => setCampName(e.target.value)}
          className="mt-1"
        />
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="camp-desc">Description</Label>
        <Textarea
          id="camp-desc"
          placeholder="Tell supporters what this campaign is about and what the funds/effort will achieve…"
          value={campDescription}
          onChange={(e) => setCampDescription(e.target.value)}
          rows={4}
          className="mt-1"
        />
      </div>

      {/* Type */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">Campaign Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["fundraising", "volunteer"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setCampType(t)}
              className={`py-2.5 text-sm font-semibold rounded-xl border-2 transition-colors capitalize ${
                campType === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {t === "fundraising" ? "Fundraising" : "Volunteer"}
            </button>
          ))}
        </div>
      </div>

      {/* Goal (fundraising only) */}
      {campType === "fundraising" && (
        <div>
          <Label htmlFor="camp-goal">Fundraising Goal (£)</Label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
            <Input
              id="camp-goal"
              type="number"
              min={1}
              placeholder="10000"
              value={campGoal}
              onChange={(e) => setCampGoal(e.target.value)}
              className="pl-7"
            />
          </div>
        </div>
      )}

      {/* Volunteers needed (volunteer only) */}
      {campType === "volunteer" && (
        <div>
          <Label htmlFor="camp-vol">Volunteers Needed</Label>
          <Input
            id="camp-vol"
            type="number"
            min={1}
            placeholder="20"
            value={campVolunteers}
            onChange={(e) => setCampVolunteers(e.target.value)}
            className="mt-1"
          />
        </div>
      )}

      {/* Deadline */}
      <div>
        <Label htmlFor="camp-deadline">Deadline <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          id="camp-deadline"
          type="date"
          value={campDeadline}
          onChange={(e) => setCampDeadline(e.target.value)}
          className="mt-1"
        />
      </div>

      {/* Phases / milestones */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold">
            Phases / Milestones <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          {phases.length < 10 && (
            <button
              type="button"
              onClick={addPhase}
              className="text-xs font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity text-primary"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add phase
            </button>
          )}
        </div>

        {phases.length === 0 && (
          <p className="text-xs text-muted-foreground bg-secondary rounded-lg p-3">
            Phases help donors follow your progress — e.g. "Phase 1: Purchase supplies", "Phase 2: Distribute to schools". You can mark each phase complete as you go.
          </p>
        )}

        <div className="space-y-3 mt-2">
          {phases.map((phase, i) => (
            <div key={phase.id} className="border border-border rounded-xl p-3 space-y-2 bg-secondary/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Phase {i + 1}</span>
                <button type="button" onClick={() => removePhase(phase.id)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Input
                placeholder="Phase title (e.g. Purchase supplies)"
                value={phase.title}
                onChange={(e) => updatePhaseField(phase.id, "title", e.target.value)}
                className="text-sm h-9"
              />
              <Textarea
                placeholder="Brief description (optional)"
                value={phase.description}
                onChange={(e) => updatePhaseField(phase.id, "description", e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
              {campType === "fundraising" && (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">£</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Target amount for this phase (optional)"
                    value={phase.targetAmount ?? ""}
                    onChange={(e) =>
                      updatePhaseField(
                        phase.id,
                        "targetAmount",
                        e.target.value ? parseFloat(e.target.value) : null,
                      )
                    }
                    className="pl-7 text-sm h-9"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 font-bold text-black bg-accent hover:bg-accent/90"
          disabled={submitting}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ── Profile Images card ───────────────────────────────────────────────────────

function ProfileImagesCard({
  org,
  orgId,
  token,
  onUpdated,
}: {
  org: import("@/lib/api").Org | undefined;
  orgId: string;
  token: string;
  onUpdated: () => void;
}) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleUploadError(err: unknown, fallback: string) {
    const raw = err instanceof Error ? err.message : "";
    return /load failed|failed to fetch|networkerror/i.test(raw)
      ? "Upload failed — please check your connection and try again"
      : raw || fallback;
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    setError(null);
    setLogoUploading(true);
    try {
      // Single call: upload + save to org doc atomically
      await api.uploadOrgProfileImage(file, orgId, "logo", token);
      onUpdated();
    } catch (err) {
      setError(handleUploadError(err, "Failed to upload logo"));
      setLogoPreview(null);
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverPreview(URL.createObjectURL(file));
    setError(null);
    setCoverUploading(true);
    try {
      // Single call: upload + save to org doc atomically
      await api.uploadOrgProfileImage(file, orgId, "cover", token);
      onUpdated();
    } catch (err) {
      setError(handleUploadError(err, "Failed to upload cover photo"));
      setCoverPreview(null);
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  const currentLogo = logoPreview ?? org?.logo ?? null;
  const currentCover = coverPreview ?? org?.coverImage ?? null;
  const initials = (org?.name ?? "").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "??";

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" /> Profile Images
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Banner */}
        <div>
          <Label className="text-sm font-semibold mb-1 block">Banner</Label>
          <p className="text-xs text-muted-foreground mb-3">Recommended: 1200x400 pixels.</p>
          <div className="relative rounded-xl overflow-hidden border border-border">
            {currentCover ? (
              <img src={currentCover} alt="banner" className="w-full h-36 object-cover" />
            ) : (
              <div
                className="w-full h-36 flex items-center justify-center bg-primary"
              >
                <ImageIcon className="w-8 h-8 text-white/40" />
              </div>
            )}
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverUploading}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white disabled:cursor-wait"
            >
              {coverUploading ? (
                <span className="text-sm font-semibold">Uploading…</span>
              ) : (
                <>
                  <Upload className="w-6 h-6" />
                  <span className="text-sm font-semibold">Change banner</span>
                </>
              )}
            </button>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleCoverChange}
          />
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={coverUploading}
            className="mt-2 text-xs font-semibold flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {coverUploading ? "Uploading…" : currentCover ? "Replace banner" : "Upload banner"}
          </button>
        </div>

        {/* Logo */}
        <div>
          <Label className="text-sm font-semibold mb-1 block">Logo</Label>
          <p className="text-xs text-muted-foreground mb-3">Recommended: 400x400 pixels.</p>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              {currentLogo ? (
                <img
                  src={currentLogo}
                  alt="logo"
                  className="w-20 h-20 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full border-2 border-border flex items-center justify-center text-xl font-extrabold bg-accent text-accent-foreground"
                >
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity disabled:cursor-wait"
              >
                {logoUploading ? (
                  <span className="text-white text-xs font-semibold">…</span>
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-2">
                Your logo appears as a circular avatar on your public profile page.
              </p>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {logoUploading ? "Uploading…" : currentLogo ? "Replace logo" : "Upload logo"}
              </button>
            </div>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main dashboard page ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const search = useSearch();

  // Update form state
  const [showForm, setShowForm] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postType, setPostType] = useState<typeof UPDATE_TYPES[number]>("update");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done">("idle");
  const [formError, setFormError] = useState("");

  // Campaign form state
  const [showCampForm, setShowCampForm] = useState(false);


  // Funds usage form state
  const [fundsUsageInput, setFundsUsageInput] = useState({
    operations: 0, materials: 0, staff: 0, events: 0, other: 0,
  });
  const [fundsUsageSaving, setFundsUsageSaving] = useState(false);
  const [fundsUsageError, setFundsUsageError] = useState("");
  const [fundsUsageSaved, setFundsUsageSaved] = useState(false);

  const orgId = user?.id ?? "";
  const connectComplete = new URLSearchParams(search).get("connect") === "complete";

  const orgQ = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId, token),
    enabled: !!orgId,
  });


  // Sync funds usage form from org data when it loads
  useEffect(() => {
    const fu = orgQ.data?.fundsUsage;
    if (fu) {
      setFundsUsageInput({
        operations: fu.operations ?? 0,
        materials:  fu.materials  ?? 0,
        staff:      fu.staff      ?? 0,
        events:     fu.events     ?? 0,
        other:      fu.other      ?? 0,
      });
    }
  }, [orgQ.data?._id]);


  const updatesQ = useQuery({
    queryKey: ["org-feed", orgId],
    queryFn: () => api.getOrgFeed(orgId),
    enabled: !!orgId,
  });

  const campaignsQ = useQuery({
    queryKey: ["campaigns", orgId],
    queryFn: () => api.getManagedCampaigns(orgId, token!),
    enabled: !!orgId && !!token,
  });

  const postMut = useMutation({
    mutationFn: async () => {
      let mediaUrls: string[] = [];
      if (selectedFiles.length > 0) {
        setUploadProgress("uploading");
        mediaUrls = await api.uploadMedia(selectedFiles, token!);
        setUploadProgress("done");
      }
      return api.postUpdate(
        { title: postTitle.trim(), content: postContent.trim(), type: postType, mediaUrls },
        token!,
      );
    },
    onSuccess: () => {
      setPostTitle(""); setPostContent(""); setPostType("update");
      setSelectedFiles([]); setPreviewUrls([]); setUploadProgress("idle");
      setShowForm(false); setFormError("");
      queryClient.invalidateQueries({ queryKey: ["org-feed", orgId] });
      queryClient.invalidateQueries({ queryKey: ["feed", "public"] });
    },
    onError: (e: Error) => {
      setUploadProgress("idle");
      setFormError(e.message);
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length + selectedFiles.length > 5) { setFormError("You can attach up to 5 files per update."); return; }
    setFormError("");
    const newFiles = [...selectedFiles, ...files].slice(0, 5);
    setSelectedFiles(newFiles);
    setPreviewUrls(newFiles.map((f) => f.type.startsWith("video/") ? "" : URL.createObjectURL(f)));
  }

  function removeFile(index: number) {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setPreviewUrls(newFiles.map((f) => f.type.startsWith("video/") ? "" : URL.createObjectURL(f)));
  }

  function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!postTitle.trim()) { setFormError("Title is required."); return; }
    if (!postContent.trim()) { setFormError("Content is required."); return; }
    setFormError("");
    postMut.mutate();
  }

  function resetForm() {
    setShowForm(false); setPostTitle(""); setPostContent(""); setPostType("update");
    setSelectedFiles([]); setPreviewUrls([]); setUploadProgress("idle"); setFormError("");
  }

  async function saveFundsUsage() {
    const total = Object.values(fundsUsageInput).reduce((s, v) => s + v, 0);
    if (total !== 100) {
      setFundsUsageError(`Percentages must add up to 100 (currently ${total})`);
      return;
    }
    setFundsUsageError("");
    setFundsUsageSaving(true);
    try {
      await api.updateOrganisation(orgId, { fundsUsage: fundsUsageInput } as Partial<api.Org>, token!);
      queryClient.invalidateQueries({ queryKey: ["org", orgId] });
      setFundsUsageSaved(true);
      setTimeout(() => setFundsUsageSaved(false), 3000);
    } catch (e) {
      setFundsUsageError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setFundsUsageSaving(false);
    }
  }

  const org = orgQ.data;
  const updates = updatesQ.data ?? [];
  const campaigns = (campaignsQ.data ?? []).filter((c) => c.status !== "deleted");
  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const completedCampaigns = campaigns.filter((c) => c.status === "completed");

  const isSubmitting = postMut.isPending;
  const uploadLabel =
    uploadProgress === "uploading" ? "Uploading media…" :
    uploadProgress === "done" ? "Publishing…" : "Publish Update";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Hero */}
      <div className="bg-primary rounded-2xl p-6 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-extrabold flex-shrink-0 shadow-sm border-2 border-white/20">
            {(org?.name ?? user?.name ?? "").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "??"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white">{org?.name ?? user?.name ?? "Your Organisation"}</h1>
              {org?.verified && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-accent border border-accent/30 px-2 py-0.5 rounded-full bg-accent/10 shadow-sm">
                  <CheckCircle className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            {org && (
              <p className="text-white/80 text-sm font-medium">
                {[org.city, org.country].filter(Boolean).join(", ")} &middot; {org.category}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-6 bg-white/10 rounded-xl p-4 border border-white/10 shadow-sm">
          {[
            { label: "Followers",  value: org?.followerCount ?? 0 },
            { label: "Updates",    value: updates.length },
            { label: "Campaigns",  value: campaigns.length },
            { label: "Raised",     value: `£${(org?.totalRaised ?? 0).toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-lg font-extrabold text-white">{value}</div>
              <div className="text-xs text-white/70 mt-0.5 font-medium">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-secondary rounded-lg">
          <TabsTrigger value="profile" className="rounded-md font-bold text-sm">Profile & Settings</TabsTrigger>
          <TabsTrigger value="campaigns" className="rounded-md font-bold text-sm">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-2">

          <ProfileImagesCard
            org={org}
            orgId={orgId}
            token={token!}
            onUpdated={() => queryClient.invalidateQueries({ queryKey: ["org", orgId] })}
          />

          <PayoutSetup key={orgId} orgId={orgId} token={token!} totalRaised={org?.totalRaised ?? 0} connectComplete={connectComplete} />

          <details className="group border border-border shadow-sm rounded-xl bg-card overflow-hidden">
            <summary className="flex items-center justify-between p-4 cursor-pointer font-semibold text-base hover:bg-secondary/30 transition-colors">
              <span className="flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Funds usage breakdown (optional)</span>
              <span className="text-muted-foreground group-open:rotate-180 transition-transform"><ChevronDown className="w-4 h-4" /></span>
            </summary>
            <div className="p-4 pt-0 border-t border-border mt-1">
              <div className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  Show supporters how you allocate funds. Percentages must add up to 100.
                  This is self-reported and displayed on your public profile.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(
                    [
                      { key: "operations", label: "Operations" },
                      { key: "materials",  label: "Materials & Supplies" },
                      { key: "staff",      label: "Staff & Volunteers" },
                      { key: "events",     label: "Community Events" },
                      { key: "other",      label: "Other" },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={fundsUsageInput[key]}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                            setFundsUsageInput((prev) => ({ ...prev, [key]: val }));
                            setFundsUsageError("");
                            setFundsUsageSaved(false);
                          }}
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 flex-wrap pt-2">
                  {(() => {
                    const total = Object.values(fundsUsageInput).reduce((s, v) => s + v, 0);
                    const ok = total === 100;
                    return (
                      <div
                        className={`flex items-center px-3 py-1.5 rounded-lg border ${
                          ok ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
                        }`}
                      >
                        <span className={`text-xs font-bold ${ok ? "text-green-700" : "text-amber-700"}`}>
                          Total: {total}% {ok ? "✓" : total < 100 ? `(${100 - total}% remaining)` : `(over by ${total - 100}%)`}
                        </span>
                      </div>
                    );
                  })()}

                  {fundsUsageError && (
                    <div className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-2 py-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {fundsUsageError}
                    </div>
                  )}

                  {fundsUsageSaved && (
                    <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> Saved.
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button
                    className="font-bold text-white bg-primary hover:bg-primary/90"
                    disabled={
                      fundsUsageSaving ||
                      Object.values(fundsUsageInput).reduce((s, v) => s + v, 0) !== 100
                    }
                    onClick={saveFundsUsage}
                  >
                    {fundsUsageSaving ? "Saving…" : "Save breakdown"}
                  </Button>
                  {org?.fundsUsage && (
                    <Button
                      variant="outline"
                      className="font-semibold"
                      disabled={fundsUsageSaving}
                      onClick={async () => {
                        await api.updateOrganisation(orgId, { fundsUsage: null } as Partial<api.Org>, token!);
                        setFundsUsageInput({ operations: 0, materials: 0, staff: 0, events: 0, other: 0 });
                        queryClient.invalidateQueries({ queryKey: ["org", orgId] });
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </details>

          {/* ── Updates ────────────────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start pt-6">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base">Post an Update</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handlePost} className="space-y-5">
                  {formError && (
                    <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md font-medium">{formError}</div>
                  )}
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Type</Label>
                    <div className="flex gap-2">
                      {UPDATE_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setPostType(t)}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg border-2 transition-colors capitalize ${
                            postType === t
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="title" className="font-semibold">Title</Label>
                    <Input id="title" placeholder="Update title…" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} className="mt-1.5 bg-secondary/30" />
                  </div>
                  <div>
                    <Label htmlFor="content" className="font-semibold">Content</Label>
                    <Textarea id="content" placeholder="Tell your supporters what's happening…" value={postContent} onChange={(e) => setPostContent(e.target.value)} rows={4} className="mt-1.5 bg-secondary/30" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Photos &amp; Videos <span className="text-muted-foreground font-normal ml-1">(up to 5)</span></Label>
                    {selectedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-3">
                        {selectedFiles.map((file, i) => (
                          <div key={i} className="relative group">
                            {file.type.startsWith("video/") ? (
                              <div className="w-16 h-16 bg-secondary rounded-lg flex items-center justify-center border border-border">
                                <Video className="w-6 h-6 text-muted-foreground" />
                              </div>
                            ) : (
                              <img src={previewUrls[i]} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-border shadow-sm" />
                            )}
                            <button type="button" onClick={() => removeFile(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedFiles.length < 5 && (
                      <>
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm" multiple className="hidden" onChange={handleFileChange} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 h-16 w-full border-2 border-dashed border-border rounded-lg text-sm font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors hover:bg-primary/5"><ImageIcon className="w-4 h-4" /> {selectedFiles.length === 0 ? "Add media" : `Add more (${selectedFiles.length}/5)`}</button>
                      </>
                    )}
                  </div>
                  <div className="pt-2">
                    <Button type="submit" className="w-full bg-primary text-white hover:bg-primary/90 font-bold h-11 text-base shadow-sm" disabled={isSubmitting}>{isSubmitting ? uploadLabel : "Publish Update"}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center justify-between">
                  Recent Updates <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{updates.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {updatesQ.isLoading ? (
                  <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
                ) : updates.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-10 px-4">No updates yet. Your published updates will appear here.</p>
                ) : (
                  <div className="space-y-4">
                    {updates.map((u: FeedUpdate) => (
                      <div key={u._id} className="border border-border rounded-xl p-4 bg-card/50 shadow-sm relative overflow-hidden group">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors"></div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLORS[u.type] ?? TYPE_COLORS.update}`}>{u.type.toUpperCase()}</span>
                          <span className="text-xs text-muted-foreground font-medium">{timeAgo(u.createdAt)}</span>
                        </div>
                        <h4 className="font-bold text-foreground text-sm leading-tight mb-1">{u.title}</h4>
                        <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">{u.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-2">

          <Card className="border-border shadow-sm bg-card">
            <CardHeader className="pb-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" /> Campaigns
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Manage your active fundraising and volunteer drives.</p>
                </div>
                {!showCampForm && (
                  <Button size="sm" onClick={() => setShowCampForm(true)} className="bg-primary text-white hover:bg-primary/90 font-bold shadow-sm">
                    <PlusCircle className="w-4 h-4 mr-1.5" /> New Campaign
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {showCampForm && (
                <div className="mb-8 pb-8 border-b border-border animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-extrabold text-xl text-foreground">Create New Campaign</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowCampForm(false)} className="text-muted-foreground font-semibold">Cancel</Button>
                  </div>
                  <CampaignForm
                    orgId={orgId}
                    token={token!}
                    onSuccess={() => {
                      setShowCampForm(false);
                      queryClient.invalidateQueries({ queryKey: ["campaigns", orgId] });
                    }}
                    onCancel={() => setShowCampForm(false)}
                  />
                </div>
              )}

              {campaignsQ.isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-40 rounded-xl" />
                  <Skeleton className="h-40 rounded-xl" />
                </div>
              ) : campaigns.length === 0 && !showCampForm ? (
                <div className="text-center py-16 px-4 bg-secondary/30 rounded-2xl border border-border border-dashed">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary/10 shadow-sm border border-primary/20">
                    <Target className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-extrabold text-lg text-foreground mb-2">Launch your first campaign</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
                    Set a fundraising goal, run a volunteer drive, and add progress phases so donors can follow your impact.
                  </p>
                  <Button onClick={() => setShowCampForm(true)} className="bg-primary text-white font-bold h-11 px-6 shadow-sm hover:bg-primary/90">
                    <PlusCircle className="w-5 h-5 mr-2" /> Create Campaign
                  </Button>
                </div>
              ) : (
                <div className="space-y-8">
                  {activeCampaigns.length > 0 && (
                    <div>
                      <h4 className="font-bold text-sm text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span> Active Campaigns
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        {activeCampaigns.map((c) => (
                          <DashCampaignCard
                            key={c._id}
                            campaign={c}
                            orgId={orgId}
                            token={token!}
                            onUpdated={() => queryClient.invalidateQueries({ queryKey: ["campaigns", orgId] })}
                            onDeleted={() => queryClient.invalidateQueries({ queryKey: ["campaigns", orgId] })}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {completedCampaigns.length > 0 && (
                    <div className={activeCampaigns.length > 0 ? "pt-8 border-t border-border/50" : ""}>
                      <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground"></span> Completed
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2 opacity-80">
                        {completedCampaigns.map((c) => (
                          <DashCampaignCard
                            key={c._id}
                            campaign={c}
                            orgId={orgId}
                            token={token!}
                            onUpdated={() => queryClient.invalidateQueries({ queryKey: ["campaigns", orgId] })}
                            onDeleted={() => queryClient.invalidateQueries({ queryKey: ["campaigns", orgId] })}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );

}