import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Heart, Share2, MapPin, CheckCircle, Clock, 
  Target, Users, ArrowRight, ShieldCheck, ChevronRight
} from "lucide-react";
import { getPublicCampaignLanding, getPublicCampaignLandingBySlug } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { GuestDonateSheet } from "@/components/GuestDonateSheet";
import { Skeleton } from "@/components/ui/skeleton";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 864e5);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
  return `${Math.floor(d / 30)} months ago`;
}

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
    refetchOnWindowFocus: "always",
  });

  useEffect(() => {
    if (!landing) return;
    const { campaign, organisation } = landing;
    const title = `${campaign.name} — ${organisation.name}`;
    const description = campaign.description.slice(0, 180);
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
  
  // Theme application
  const theme = campaign.theme ?? {
    primaryColor: "#E31C23", // Root ProjX Red
    accentColor: "#F5C200",  // Root ProjX Gold
    backgroundColor: "#ffffff",
    textColor: "#111111",
  };

  const isFundraising = campaign.type === "fundraising";
  const pct = isFundraising && campaign.goal > 0 
    ? Math.min(100, Math.round((campaign.amountRaised / campaign.goal) * 100)) 
    : 0;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: campaign.name,
          text: campaign.description,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard");
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col font-sans transition-colors duration-500"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      <GuestDonateSheet
        open={donateOpen}
        onClose={() => setDonateOpen(false)}
        orgId={org._id}
        orgName={org.name}
        campaignId={campaign._id}
      />

      {/* Floating Header */}
      <header 
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
          scrolled ? "bg-white/90 backdrop-blur-md shadow-sm py-3" : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 md:px-8 flex items-center justify-between">
          <Link href={`/organisations/${org._id}`} data-testid="link-organisation-profile" className="flex items-center gap-3 group">
            {org.logo ? (
              <img src={org.logo} alt={org.name} className="w-9 h-9 rounded-full object-cover border border-gray-200 shadow-sm" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold border border-gray-200 text-gray-700">
                {org.name.charAt(0) || "O"}
              </div>
            )}
            <div className="font-semibold text-sm text-gray-900 transition-colors">
              {org.name}
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              data-testid="button-share-campaign"
              className={`p-2.5 rounded-full transition-colors ${
                scrolled 
                  ? "bg-gray-100 hover:bg-gray-200 text-gray-700" 
                  : "bg-white/60 hover:bg-white/80 text-gray-900 backdrop-blur-sm"
              }`}
              aria-label="Share campaign"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <Button
              className="rounded-full px-6 font-bold shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: theme.primaryColor, color: "#fff" }}
              onClick={() => isFundraising ? setDonateOpen(true) : setLocation(`/organisations/${org._id}/volunteer`)}
              data-testid="button-header-campaign-action"
            >
              {isFundraising ? "Donate Now" : "Get Involved"}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="relative pt-24 pb-12 md:pt-32 md:pb-20 px-4 md:px-8 max-w-5xl mx-auto">
          {/* Background decoration */}
          <div 
            className="absolute top-0 left-0 w-full h-96 -z-10 opacity-20"
            style={{ 
              background: `linear-gradient(180deg, ${theme.primaryColor}33 0%, ${theme.backgroundColor} 100%)` 
            }}
          />

          <div className="grid md:grid-cols-[1.2fr_1fr] gap-10 md:gap-16 items-start">
            
            {/* Left Column: Story */}
            <div className="space-y-6 md:space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span 
                    className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                    style={{ backgroundColor: `${theme.accentColor}22`, color: theme.accentColor === "#FFFFFF" ? theme.textColor : theme.accentColor }}
                  >
                    {campaign.type}
                  </span>
                  {campaign.status === "completed" && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                      Completed
                    </span>
                  )}
                </div>
                <h1 data-testid="text-campaign-name" className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-gray-900" style={{ color: theme.textColor }}>
                  {campaign.name}
                </h1>
                
                <div data-testid="text-campaign-meta" className="flex items-center gap-4 text-sm text-gray-600 font-medium pt-2">
                  {org.city && org.country && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 opacity-70" />
                      {org.city}, {org.country}
                    </div>
                  )}
                  {campaign.deadline && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 opacity-70" />
                      Ends {new Date(campaign.deadline).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              {campaign.imageUrl && (
                <div className="rounded-3xl overflow-hidden shadow-2xl md:hidden">
                  <img src={campaign.imageUrl} alt="Campaign cover" data-testid="img-campaign-cover-mobile" className="w-full h-auto aspect-[4/3] object-cover" />
                </div>
              )}

              <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed" style={{ color: `${theme.textColor}CC` }}>
                <p data-testid="text-campaign-description" className="whitespace-pre-wrap">{campaign.description}</p>
              </div>

              {/* Organisation Trust block */}
              <div className="mt-10 p-6 rounded-2xl bg-gray-50 border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ShieldCheck className={`w-5 h-5 ${org.verified ? "text-green-600" : "text-gray-400"}`} />
                  {org.verified ? "Verified Organisation" : "About the organisation"}
                </h3>
                <div className="flex items-center gap-4">
                  {org.logo ? (
                    <img src={org.logo} alt={org.name} className="w-14 h-14 rounded-full object-cover shadow-sm" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-xl font-bold shadow-sm text-gray-700 border border-gray-200">
                        {org.name.charAt(0) || "O"}
                    </div>
                  )}
                  <div>
                    <h4 data-testid="text-organisation-name" className="font-bold text-gray-900">{org.name}</h4>
                    <p className="text-sm text-gray-500 line-clamp-1">{org.description}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Action Card */}
            <div className="md:sticky md:top-28 space-y-6">
              
              {campaign.imageUrl && (
                <div className="hidden md:block rounded-3xl overflow-hidden shadow-2xl mb-8 transform -rotate-1 hover:rotate-0 transition-transform duration-500">
                  <img src={campaign.imageUrl} alt="Campaign cover" data-testid="img-campaign-cover-desktop" className="w-full h-auto aspect-[4/3] object-cover" />
                </div>
              )}

              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100">
                {isFundraising ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-end justify-between" data-testid="text-campaign-progress">
                        <div className="text-4xl font-extrabold text-gray-900">
                          £{campaign.amountRaised.toLocaleString()}
                        </div>
                        <div className="text-gray-500 font-medium mb-1">
                          raised of £{campaign.goal.toLocaleString()}
                        </div>
                      </div>
                      <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${pct}%`, backgroundColor: theme.primaryColor }}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full py-6 text-lg font-bold rounded-xl shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5 group"
                      style={{ backgroundColor: theme.primaryColor, color: "#fff" }}
                      onClick={() => setDonateOpen(true)}
                      data-testid="button-donate-campaign"
                    >
                      Donate Now
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                    
                    <div className="text-center text-sm font-medium text-gray-500 flex items-center justify-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-green-600" />
                      Secure payment processed by Stripe
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 bg-blue-50 text-blue-900 p-4 rounded-2xl">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-extrabold">{campaign.volunteersNeeded}</div>
                        <div className="text-sm font-medium opacity-80">Volunteers Needed</div>
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full py-6 text-lg font-bold rounded-xl shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5 group"
                      style={{ backgroundColor: theme.primaryColor, color: "#fff" }}
                      onClick={() => setLocation(`/organisations/${org._id}/volunteer`)}
                      data-testid="button-volunteer-campaign"
                    >
                      Apply to Volunteer
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Phases */}
              {campaign.phases && campaign.phases.length > 0 && (
                <div className="bg-white rounded-3xl p-6 md:p-8 shadow-md border border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-6 text-lg">Campaign Milestones</h3>
                   <div className="space-y-0" data-testid="list-campaign-milestones">
                    {campaign.phases.map((phase, i) => (
                         <div key={phase.id} data-testid={`card-campaign-milestone-${phase.id}`} className="relative flex gap-4 pb-6 last:pb-0">
                        {/* Timeline line */}
                        {i !== campaign.phases.length - 1 && (
                          <div className="absolute top-8 left-3.5 bottom-0 w-[2px] bg-gray-100 -ml-[1px]" />
                        )}
                        
                        <div className="relative z-10 shrink-0 mt-1">
                          {phase.completed ? (
                            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center border-4 border-white shadow-sm">
                              <CheckCircle className="w-4 h-4 text-white" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow-sm" />
                          )}
                        </div>
                        
                        <div className="flex-1 pt-1">
                          <h4 className={`font-bold text-sm ${phase.completed ? 'text-gray-900' : 'text-gray-600'}`}>
                            {phase.title}
                          </h4>
                          {phase.description && (
                            <p className="text-sm text-gray-500 mt-1">{phase.description}</p>
                          )}
                          {phase.targetAmount != null && (
                            <p className="text-xs font-semibold text-gray-400 mt-2">
                              Target: £{phase.targetAmount.toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
          </div>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="py-8 text-center text-gray-500 text-sm border-t border-gray-100 bg-gray-50 mt-auto">
        <p>Powered by <span className="font-bold text-gray-900">Root ProjX</span></p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <Link href="/terms" className="hover:text-gray-900 hover:underline">Terms</Link>
          <Link href="/privacy" className="hover:text-gray-900 hover:underline">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
