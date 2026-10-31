import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { PlusCircle, Target, ExternalLink, Trash2, CheckCircle, Pencil, AlertCircle, Users, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api";
import type { Campaign, Org } from "@/lib/api";
import { CampaignWizard } from "./campaign-wizard";
import { CampaignEditorCard } from "./campaign-editor-card";

function StatusPills({ c }: { c: Campaign }) {
  const pill = "text-[10px] font-bold px-2 py-0.5 rounded-full";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {c.status === "completed" ? <span className={`${pill} bg-gray-100 text-gray-600`}>Completed</span>
        : c.enabled ? <span className={`${pill} bg-green-50 text-green-700`} data-testid={`status-live-${c._id}`}>Live</span>
        : <span className={`${pill} bg-secondary text-muted-foreground`} data-testid={`status-draft-${c._id}`}>Draft</span>}
      {c.enabled && c.hasUnpublishedChanges && <span className={`${pill} bg-amber-50 text-amber-800`} data-testid={`status-changes-${c._id}`}>Unpublished changes</span>}
      <span className={`${pill} capitalize`} style={{ backgroundColor: "#FFF7E6", color: "#B45309" }}>{c.type}</span>
    </div>
  );
}

function CampaignRow({ c, onEdit, orgId, token }: { c: Campaign; onEdit: () => void; orgId: string; token: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["campaigns", orgId] });
  const livePath = c.sharePath || (c.publicId ? `/campaigns/${c.publicId}` : null);

  async function run(fn: () => Promise<unknown>, fail: string) {
    setBusy(true); setMsg(null);
    try { await fn(); await refresh(); } catch (e) { setMsg(e instanceof Error ? `${fail}: ${e.message}` : fail); } finally { setBusy(false); }
  }

  return (
    <CampaignEditorCard id={c._id} name={c.name} onEdit={!c.enabled && c.status !== "completed" ? onEdit : undefined} disabled={busy}>
      {c.imageUrl ? (
        <img src={c.imageUrl} alt="" className="w-full sm:w-36 h-28 sm:h-auto object-cover shrink-0" />
      ) : (
        <div className="w-full sm:w-36 h-20 sm:h-auto bg-primary/5 flex items-center justify-center shrink-0"><Target className="w-7 h-7 text-primary/50" /></div>
      )}
      <div className="p-4 flex-1 min-w-0 space-y-2">
        <StatusPills c={c} />
        <h4 className="font-bold text-sm text-foreground break-words" data-testid={`text-campaign-name-${c._id}`}>{c.name || "Untitled draft"}</h4>
        {c.tagline && <p className="text-xs text-muted-foreground line-clamp-2">{c.tagline}</p>}
        {c.type === "fundraising" && c.goal > 0 && (
          <p className="text-xs text-muted-foreground">£{(c.amountRaised ?? 0).toLocaleString("en-GB")} raised of £{c.goal.toLocaleString("en-GB")}</p>
        )}
        {c.type === "volunteer" && c.volunteersNeeded > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c.volunteersNeeded} volunteers needed</p>
        )}
        <div className="flex flex-wrap gap-2 pt-1 [&>button]:relative [&>button]:z-10 [&>a]:relative [&>a]:z-10">
          <Button size="sm" className="h-8 font-bold" onClick={onEdit} data-testid={`button-edit-campaign-${c._id}`} data-tour-id="campaign-edit">
            <Pencil className="w-3.5 h-3.5 mr-1" /> {c.enabled ? "Edit" : `Continue${c.editorStep ? ` (step ${c.editorStep})` : ""}`}
          </Button>
          <Link href={`/campaign/preview/${orgId}/${c._id}`} className="inline-flex items-center h-8 px-3 rounded-md border border-input bg-background text-xs font-semibold hover:bg-secondary" data-testid={`link-preview-${c._id}`} data-tour-id="campaign-preview-link">
            <Eye className="w-3.5 h-3.5 mr-1" /> Preview as donor
          </Link>
          {c.enabled && livePath && (
            <Link href={livePath} target="_blank" className="inline-flex items-center h-8 px-3 rounded-md border border-input bg-background text-xs font-semibold hover:bg-accent" data-testid={`link-view-live-${c._id}`}>
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> View live
            </Link>
          )}
          {c.enabled && (
            <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => confirm("Take this page offline? You can publish it again later.") && run(() => api.setCampaignPublished(orgId, c._id, false, token), "Could not unpublish")} data-testid={`button-unpublish-${c._id}`}>Unpublish</Button>
          )}
          {c.status !== "completed" && c.enabled && (
            <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => run(() => api.updateCampaign(orgId, c._id, { status: "completed" }, token), "Could not mark complete")} data-testid={`button-complete-${c._id}`}>
              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Mark complete
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive border-destructive/30" disabled={busy} aria-label={`Delete ${c.name || "draft"}`}
            onClick={() => confirm(`Delete "${c.name || "this draft"}"? This cannot be undone.`) && run(() => api.deleteCampaign(orgId, c._id, token), "Could not delete")} data-testid={`button-delete-${c._id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
        {msg && <p role="alert" className="text-xs text-destructive">{msg}</p>}
      </div>
    </CampaignEditorCard>
  );
}

export function CampaignsManager({ orgId, userId, token, org }: { orgId: string; userId: string; token: string; org: Org | undefined }) {
  const qc = useQueryClient();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const editingId = new URLSearchParams(search).get("campaign");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["campaigns", orgId],
    queryFn: () => api.getManagedCampaigns(orgId, token),
    enabled: !!orgId && !!token,
  });
  const campaigns = q.data ?? [];
  const editing = editingId ? campaigns.find((c) => c._id === editingId) : undefined;

  const open = (id: string | null) =>
    setLocation(id ? `/dashboard?tab=campaigns&campaign=${encodeURIComponent(id)}` : "/dashboard?tab=campaigns");

  async function createDraft() {
    setCreating(true); setCreateError(null);
    try {
      const c = await api.createCampaignDraft(orgId, token);
      qc.setQueryData<Campaign[]>(["campaigns", orgId], (old) => [c, ...(old ?? [])]);
      open(c._id);
    } catch (e) {
      setCreateError(e instanceof Error ? `Could not start a draft: ${e.message}` : "Could not start a draft.");
    } finally { setCreating(false); }
  }

  const drafts = campaigns.filter((c) => !c.enabled && c.status !== "completed");
  const live = campaigns.filter((c) => c.enabled && c.status !== "completed");
  const done = campaigns.filter((c) => c.status === "completed");

  return (
    <Card className="border-border shadow-sm bg-card overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> Campaigns</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Build a donor-ready page in five short steps. Every step saves as you go.</p>
          </div>
          {!editingId && (
            <Button size="sm" onClick={createDraft} disabled={creating} className="font-bold" data-testid="button-new-campaign" data-tour-id="campaign-new">
              <PlusCircle className="w-4 h-4 mr-1.5" /> {creating ? "Starting" : "New campaign"}
            </Button>
          )}
        </div>
        {createError && <p role="alert" className="text-xs text-destructive mt-2">{createError}</p>}
      </CardHeader>
      <CardContent className="pt-6">
        {q.isLoading || (editingId && !org) ? (
          <div className="space-y-4"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /></div>
        ) : q.isError ? (
          <div className="text-center py-10">
            <AlertCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
            <p className="font-semibold">We couldn't load your campaigns.</p>
            <Button variant="outline" className="mt-3" onClick={() => q.refetch()} data-testid="button-retry-campaigns">Try again</Button>
          </div>
        ) : editingId && editing && org ? (
          <CampaignWizard key={editing._id} campaign={editing} org={org} orgId={orgId} userId={userId} token={token} onClose={() => open(null)} />
        ) : editingId && !editing ? (
          <div className="text-center py-10">
            <p className="font-semibold">That campaign could not be found.</p>
            <Button variant="outline" className="mt-3" onClick={() => open(null)}>Back to campaigns</Button>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-14 px-4 bg-secondary/30 rounded-2xl border border-border border-dashed">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary/10 border border-primary/20"><Target className="w-8 h-8 text-primary" /></div>
            <h3 className="font-extrabold text-lg mb-2">Start your first campaign</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">Name it, set a goal, tell the story, add a picture, then preview it exactly as donors will see it.</p>
            <Button onClick={createDraft} disabled={creating} className="font-bold h-11 px-6" data-testid="button-create-first-campaign">
              <PlusCircle className="w-5 h-5 mr-2" /> Start a campaign
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {[["Drafts", drafts], ["Live", live], ["Completed", done]].map(([label, list]) =>
              (list as Campaign[]).length > 0 && (
                <section key={label as string}>
                  <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-3">{label as string}</h4>
                  <div className="grid gap-3">
                    {(list as Campaign[]).map((c) => <CampaignRow key={c._id} c={c} orgId={orgId} token={token} onEdit={() => open(c._id)} />)}
                  </div>
                </section>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
