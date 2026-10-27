import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users } from "lucide-react";
import * as api from "@/lib/api";
import type { Campaign, Org } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { GuestDonateSheet } from "@/components/GuestDonateSheet";
import { CampaignDonateButton } from "@/components/campaign-donate-button";

const RED = "#B50000";

function fmt(n: number) {
  return "£" + n.toLocaleString("en-GB");
}

function CampaignCard({
  c, orgId, completed, onGuestDonate,
}: {
  c: Campaign; orgId: string; completed: boolean; onGuestDonate: (campaign: Campaign) => void;
}) {
  const pct = c.goal > 0 ? Math.min(100, Math.round((c.amountRaised / c.goal) * 100)) : 0;

  return (
    <div
      className="bg-white border border-[#E0D8CC] rounded-2xl overflow-hidden flex"
      style={{ opacity: completed ? 0.72 : 1 }}
    >
      {/* Thumbnail — hidden on very small screens */}
      <div className="hidden sm:block flex-shrink-0 w-44 self-stretch bg-[#EDE8E0] overflow-hidden">
        {c.imageUrl ? (
          <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center min-h-[11rem]">
            <span className="text-4xl font-black select-none" style={{ color: RED, opacity: 0.18 }}>
              {c.name[0]}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-5 flex flex-col gap-3">
        {/* Top row: title + mobile thumb */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-bold text-lg leading-tight text-[#1A1A1A]">{c.name}</h3>
            <p className="text-sm text-[#555] mt-1 line-clamp-2">{c.description}</p>
          </div>
          {/* Mobile-only thumbnail */}
          <div className="sm:hidden flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-[#EDE8E0]">
            {c.imageUrl ? (
              <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-black text-xl" style={{ color: RED, opacity: 0.25 }}>{c.name[0]}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status / progress */}
        {completed ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#ECEAE6] text-[#777]">
              ✓ Completed
            </span>
            {c.type === "fundraising" && c.amountRaised > 0 && (
              <span className="text-sm font-semibold text-[#777]">{fmt(c.amountRaised)} raised</span>
            )}
          </div>
        ) : c.type === "fundraising" ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-[#E8E0D5] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: RED }}
                />
              </div>
              <span className="text-sm font-semibold text-[#444] w-10 text-right shrink-0">{pct}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold" style={{ color: RED }}>{fmt(c.amountRaised)} raised</span>
              <span className="text-[#888]">{fmt(c.goal)} goal</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold flex items-center gap-1.5" style={{ color: RED }}>
              <Users size={14} />
              {c.volunteersNeeded} volunteers needed
            </span>
            <span className="text-[#999] text-xs">Ongoing</span>
          </div>
        )}

        {/* Action button */}
        {!completed && (
          <div className="flex justify-end mt-auto pt-1">
            {c.type === "fundraising" ? (
              <CampaignDonateButton
                campaign={c} onDonate={onGuestDonate}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: RED }}
              >
                Donate
              </CampaignDonateButton>
            ) : (
              <button
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: RED }}
              >
                Get Involved
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrgCampaignsPage() {
  const params = useParams<{ id: string }>();
  const orgId = params.id!;
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [donationCampaign, setDonationCampaign] = useState<Campaign | null>(null);

  const { data: org } = useQuery<Org>({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId),
  });

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns", orgId],
    queryFn: () => api.getCampaigns(orgId),
  });

  const active = campaigns.filter((c) => c.status === "active");
  const completed = campaigns.filter((c) => c.status === "completed");
  const shown = tab === "active" ? active : completed;

  function handleDonate() {
    setDonationCampaign(null);
    if (isAuthenticated) {
      navigate(`/donate/${orgId}`);
    } else {
      setSheetOpen(true);
    }
  }
  function handleCampaignDonate(campaign: Campaign) {
    setDonationCampaign(campaign);
    setSheetOpen(true);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <GuestDonateSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        orgId={orgId}
        orgName={org?.name ?? "this organisation"}
        campaignId={donationCampaign?._id}
        campaignName={donationCampaign?.name}
        partnerFunding={donationCampaign?.partnerFunding}
        partnerFundingMatchedGbp={donationCampaign?.partnerFundingMatchedGbp}
      />
      {/* Back link */}
      <Link
        href={`/organisations/${orgId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[#666] hover:text-[#333] mb-6"
      >
        <ArrowLeft size={16} />
        {org?.name ?? "Organisation profile"}
      </Link>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-[#1A1A1A]">Campaigns</h1>
        <p className="text-[#666] mt-1 text-sm">
          Support our ongoing initiatives and help us make a greater impact.
        </p>
      </div>

      {/* Active / Completed toggle */}
      <div className="flex gap-2 mb-7">
        <button
          onClick={() => setTab("active")}
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
          style={
            tab === "active"
              ? { background: RED, color: "#fff" }
              : { background: "transparent", color: RED, border: `1.5px solid ${RED}` }
          }
        >
          Active{active.length > 0 ? ` (${active.length})` : ""}
        </button>
        <button
          onClick={() => setTab("completed")}
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
          style={
            tab === "completed"
              ? { background: RED, color: "#fff" }
              : { background: "transparent", color: RED, border: `1.5px solid ${RED}` }
          }
        >
          Completed{completed.length > 0 ? ` (${completed.length})` : ""}
        </button>
      </div>

      {/* Section heading */}
      <h2 className="font-bold text-base text-[#1A1A1A] mb-4">
        {tab === "active" ? "Active Campaigns" : "Completed Campaigns"}
      </h2>

      {/* Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-[#F2EDE4] animate-pulse" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="py-16 text-center text-[#999] text-sm">
          No {tab} campaigns at the moment.
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((c) => (
            <CampaignCard key={c._id} c={c} orgId={orgId} completed={tab === "completed"} onGuestDonate={handleCampaignDonate} />
          ))}
        </div>
      )}

      {/* Full-width CTA */}
      {tab === "active" && shown.length > 0 && (
        <div className="mt-6">
          <button
            onClick={handleDonate}
            className="block w-full py-3.5 rounded-xl text-center text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: RED }}
          >
            Donate to {org?.name ?? "this organisation"}
          </button>
        </div>
      )}
    </div>
  );
}
