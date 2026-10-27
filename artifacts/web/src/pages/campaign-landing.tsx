import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { getPublicCampaignLanding, getPublicCampaignLandingBySlug } from "@/lib/api";
import { CampaignPageView } from "@/components/campaign/campaign-page-view";
import { GuestDonateSheet } from "@/components/GuestDonateSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { consumeConfirmedReceipt } from "@/lib/donor-identity";

export default function CampaignLandingPage() {
  const params = useParams<{ publicId?: string; organisationSlug?: string; campaignSlug?: string }>();
  const [, setLocation] = useLocation();
  const [donateOpen, setDonateOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const { data: landing, isLoading, isError } = useQuery({
    queryKey: ["campaign-landing", params?.publicId, params?.organisationSlug, params?.campaignSlug],
    queryFn: () =>
      params?.organisationSlug && params?.campaignSlug
        ? getPublicCampaignLandingBySlug(params.organisationSlug, params.campaignSlug)
        : getPublicCampaignLanding(params?.publicId ?? ""),
    enabled: !!params?.publicId || (!!params?.organisationSlug && !!params?.campaignSlug),
    staleTime: 0,
    refetchOnMount: "always",
    // Live matching pool: keep the available amount fresh while matching is still open.
    refetchInterval: (q) => {
      const c = q.state.data?.campaign;
      const pf = c?.partnerFunding;
      if (pf?.type !== "matching") return false;
      const cap = pf.matchCap && pf.matchCap > 0 ? pf.matchCap : pf.amount;
      return (c?.partnerFundingMatchedGbp ?? 0) < cap ? 5000 : false;
    },
    refetchOnWindowFocus: "always",
  });

  useEffect(() => {
    if (!landing) return;
    const { campaign, organisation } = landing;
    const title = `${campaign.name} — ${organisation.name}`;
    const description = (campaign.tagline || campaign.description).slice(0, 180);
    document.title = title;

    const previous = new Map<string, string | null>();
    const setMeta = (selector: string, attr: "name" | "property", key: string, content: string) => {
      let tag = document.head.querySelector<HTMLMetaElement>(selector);
      previous.set(selector, tag?.getAttribute("content") ?? null);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, key);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };
    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[property="og:description"]', "property", "og:description", description);
    setMeta('meta[property="og:type"]', "property", "og:type", "website");
    setMeta('meta[property="og:url"]', "property", "og:url", window.location.href);
    if (campaign.imageUrl) {
      setMeta('meta[property="og:image"]', "property", "og:image", new URL(campaign.imageUrl, window.location.origin).href);
    }

    return () => {
      document.title = "Root ProjX";
      previous.forEach((content, selector) => {
        const tag = document.head.querySelector<HTMLMetaElement>(selector);
        if (!tag) return;
        if (content === null) tag.remove();
        else tag.setAttribute("content", content);
      });
    };
  }, [landing]);

  const [highlight, setHighlight] = useState(false);
  const campaignIdForReceipt = landing?.campaign._id;
  useEffect(() => {
    if (campaignIdForReceipt && consumeConfirmedReceipt(campaignIdForReceipt)) setHighlight(true);
  }, [campaignIdForReceipt]);

  useEffect(() => {
    const readablePath = landing?.campaign.sharePath;
    if (params?.publicId && readablePath && window.location.pathname !== readablePath) {
      window.history.replaceState(null, "", readablePath);
    }
  }, [landing?.campaign.sharePath, params?.publicId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Skeleton className="h-64 w-full rounded-3xl mb-8" />
          <div className="space-y-4 max-w-2xl mx-auto">
            <Skeleton className="h-10 w-3/4 rounded-lg" />
            <Skeleton className="h-6 w-1/2 rounded-lg" />
            <Skeleton className="h-4 w-full rounded-lg mt-8" />
            <Skeleton className="h-4 w-5/6 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !landing || !landing.campaign.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Campaign Unavailable</h1>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            This campaign may have been unpublished, deleted, or the link is incorrect.
          </p>
            <Link href="/" data-testid="link-return-discover" className="inline-flex items-center justify-center h-10 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium">
            Return to Discover
          </Link>
        </div>
      </div>
    );
  }

  const { campaign, organisation: org } = landing;

  return (
    <>
      <GuestDonateSheet
        open={donateOpen}
        onClose={() => setDonateOpen(false)}
        orgId={org._id}
        orgName={org.name}
        campaignId={campaign._id}
        campaignName={campaign.name}
        partnerFunding={campaign.partnerFunding ?? null}
        partnerFundingMatchedGbp={campaign.partnerFundingMatchedGbp ?? 0}
      />
      <CampaignPageView
        campaign={campaign}
        organisation={org}
        scrolled={scrolled}
        highlightNewest={highlight}
        onDonate={() => setDonateOpen(true)}
        onVolunteer={() => setLocation(`/organisations/${org._id}/volunteer`)}
      />
    </>
  );
}
