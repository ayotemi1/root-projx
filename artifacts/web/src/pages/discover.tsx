import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { userErrorMessage } from "@/lib/error-feedback";
import { Link, useLocation } from "wouter";
import { Search, BadgeCheck, LayoutGrid, MapPin, ArrowRight, Plus, ChevronDown, Check } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as api from "@/lib/api";
import type { Org } from "@/lib/api";
import { DISCOVER_COUNTRIES } from "@/lib/countries";
import { OrganisationLogo } from "@/components/organisation-logo";
import SupporterDiscoverPage from "@/components/supporter/SupporterDiscoverPage";

const CATEGORIES = [
  "All Causes",
  "Youth Empowerment",
  "Maternal Health",
  "Environment",
  "Diaspora Support",
  "Education",
  "Mental Health",
  "Arts & Culture",
  "Food Security & Nutrition",
  "Housing & Homelessness",
  "Women & Girls",
  "Elderly Care",
  "Disability & Accessibility",
  "Community Development",
  "Conservation & Wildlife",
  "Sport & Recreation",
  "Economic Empowerment & Livelihoods",
  "Disaster Relief",
  "Religious & Spiritual Community",
  "Children & Family",
  "Health & Wellbeing",
  "Human Rights & Justice",
  "Animal Welfare",
  "Digital Inclusion",
  "Drug & Alcohol Recovery",
  "Refugee & Migrant Support",
  "Prison & Rehabilitation",
  "Clean Water & Sanitation",
  "Agriculture & Farming",
];


const COUNTRY_COORDS: Record<string, { center: [number, number]; zoom: number }> = {
  Jamaica:               { center: [18.1096, -77.2975], zoom: 8 },
  "United Kingdom":      { center: [55.3781, -3.4360],  zoom: 6 },
  Nigeria:               { center: [9.0820,   8.6753],  zoom: 6 },
  Ghana:                 { center: [7.9465,  -1.0232],  zoom: 7 },
  "Trinidad and Tobago": { center: [10.6918, -61.2225], zoom: 9 },
  Barbados:              { center: [13.1939, -59.5432], zoom: 10 },
  Kenya:                 { center: [-1.2864,  36.8172], zoom: 7 },
  "United States":       { center: [37.0902, -95.7129], zoom: 4 },
};

const DEFAULT_CENTER: [number, number] = [20, -30];
const DEFAULT_ZOOM = 3;

const GOLD = "#F3BF2C";

const goldIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;background:${GOLD};border:2.5px solid #333;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -10],
});

function MapController({ country }: { country: string }) {
  const map = useMap();
  useEffect(() => {
    if (country === "All") {
      map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 1 });
    } else {
      const loc = COUNTRY_COORDS[country];
      if (loc) map.flyTo(loc.center, loc.zoom, { duration: 1 });
    }
  }, [country, map]);
  return null;
}

function OrgMap({ orgs, country }: { orgs: Org[]; country: string }) {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height: "min(560px, 70dvh)", width: "100%" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController country={country} />
      {orgs.map((org) => {
        const coords = COUNTRY_COORDS[org.country];
        if (!coords) return null;
        const jitter: [number, number] = [
          coords.center[0] + (Math.random() - 0.5) * 0.8,
          coords.center[1] + (Math.random() - 0.5) * 0.8,
        ];
        return (
          <Marker key={org._id} position={jitter} icon={goldIcon}>
            <Popup>
              <div style={{ minWidth: "180px", maxWidth: "220px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "2px" }}>
                  {org.name}
                </div>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>
                  {[org.city, org.country].filter(Boolean).join(", ")}
                </div>
                <div style={{ fontSize: "12px", marginBottom: "10px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {org.shortDescription?.trim() || org.description}
                </div>
                <a
                  href={`/organisations/${org._id}`}
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    backgroundColor: GOLD,
                    color: "#17100F",
                    border: "1px solid #17100F",
                    borderRadius: "0",
                    fontSize: "12px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  View
                </a>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

type FollowCtl = { mode: "guest" | "supporter" | "organisation"; following: boolean; busy: boolean; onFollow: () => void };

function OrgCard({ org, follow }: { org: Org; follow: FollowCtl }) {
  const [, navigate] = useLocation();
  const place = [org.city, org.country].filter(Boolean).join(", ");
  const blurb = org.shortDescription?.trim() || org.description;
  const followers = org.followerCount ?? 0;

  return (
    <article
      onClick={() => navigate(`/organisations/${org._id}`)}
      className="group border-t-2 border-[#17100F] pt-4 flex flex-col cursor-pointer rp-rise"
      data-testid={`card-org-${org._id}`}
    >
      <div className="flex items-center justify-between gap-3 rp-label !text-[12px] text-[#17100F]/75">
        <span className="inline-flex items-center gap-1.5 truncate"><MapPin className="w-3.5 h-3.5 shrink-0" />{place || "Location to come"}</span>
        {org.verified && (
          <span className="inline-flex items-center gap-1 text-[#1F6B3A] shrink-0"><BadgeCheck className="w-3.5 h-3.5" aria-hidden />Verified</span>
        )}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <OrganisationLogo name={org.name} logo={org.logo} />
        <h3 className="rp-display text-[28px] sm:text-[30px] text-[#17100F]">
          <Link href={`/organisations/${org._id}`} onClick={(e) => e.stopPropagation()} className="group-hover:text-[#CA0813] transition-colors focus:outline-none focus-visible:underline focus-visible:decoration-[#F3BF2C] focus-visible:decoration-4" data-testid={`link-org-${org._id}`}>{org.name}</Link>
        </h3>
      </div>
      {org.category && (
        <span className="mt-4 w-fit rp-label !text-[12px] bg-[#F3BF2C] text-[#17100F] px-2 py-1">{org.category}</span>
      )}
      <p className="mt-4 text-[17px] leading-relaxed text-[#17100F]/80 line-clamp-3 min-h-[3lh]">{blurb}</p>

      <div className="mt-auto pt-6 flex items-baseline gap-6">
        <span className="rp-label !text-[12px] text-[#17100F]/80"><strong className="rp-cond text-[22px] font-bold text-[#17100F] tracking-normal mr-1">{followers}</strong>{followers === 1 ? "Follower" : "Followers"}</span>
        {(org.totalRaised ?? 0) > 0 && (
          <span className="rp-label !text-[12px] text-[#17100F]/80"><strong className="rp-cond text-[22px] font-bold text-[#17100F] tracking-normal mr-1">£{org.totalRaised.toLocaleString()}</strong>Raised</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
        <Link href={`/donate/${org._id}`} className="rp-btn rp-btn-yellow" data-testid={`button-donate-${org._id}`}>
          Donate <ArrowRight className="w-4 h-4" />
        </Link>
        {follow.mode === "organisation" ? (
          <Link href={`/organisations/${org._id}`} className="rp-btn rp-btn-ghost" data-testid={`button-view-${org._id}`}>View profile</Link>
        ) : follow.following ? (
          <span className="rp-btn rp-btn-ghost border-[#17100F]/30 cursor-default hover:bg-transparent hover:text-[#17100F]" data-testid={`status-following-${org._id}`}>
            <Check className="w-4 h-4" /> Following
          </span>
        ) : (
          <button type="button" onClick={follow.onFollow} disabled={follow.busy} className="rp-btn rp-btn-ghost" data-testid={`button-follow-${org._id}`}>
            <Plus className="w-4 h-4" /> {follow.busy ? "Following…" : "Follow"}
          </button>
        )}
      </div>
    </article>
  );
}

function OrgCardSkeleton() {
  return (
    <div className="border-t-2 border-[#17100F]/20 pt-4 space-y-4 animate-pulse">
      <div className="h-3 w-28 bg-[#17100F]/10" />
      <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-full bg-[#17100F]/10" /><div className="h-7 flex-1 bg-[#17100F]/10" /></div>
      <div className="h-4 w-24 bg-[#17100F]/10" />
      <div className="h-12 w-full bg-[#17100F]/10" />
      <div className="grid grid-cols-2 gap-2"><div className="h-11 bg-[#17100F]/10" /><div className="h-11 bg-[#17100F]/10" /></div>
    </div>
  );
}

type ViewMode = "grid" | "map";

export default function DiscoverPage() {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated && user?.accountType === "supporter") return <SupporterDiscoverPage />;
  return <LegacyDiscoverPage />;
}

function LegacyDiscoverPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Causes");
  const [locationFilter, setLocationFilter] = useState("All");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [, navigateTo] = useLocation();
  const { isAuthenticated, token, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isSupporter = isAuthenticated && user?.accountType === "supporter";
  const followsQ = useQuery({
    queryKey: ["follows", "my", token],
    queryFn: () => api.getMyFollows(token!),
    enabled: isSupporter,
  });
  const followedIds = new Set((followsQ.data ?? []).map((o) => o._id));
  const followM = useMutation({
    mutationFn: (orgId: string) => api.followOrg(orgId, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follows", "my", token] });
      qc.invalidateQueries({ queryKey: ["feed", "mine", token] });
      qc.invalidateQueries({ queryKey: ["organisations"] });
      toast({ title: "Following", description: "Their posts will appear in your Following feed." });
    },
    onError: (err) => toast({ title: "Couldn't follow", description: userErrorMessage(err, "follow this organisation"), variant: "destructive" }),
  });
  const followFor = (orgId: string): FollowCtl => ({
    mode: !isAuthenticated ? "guest" : isSupporter ? "supporter" : "organisation",
    following: isSupporter && followedIds.has(orgId),
    busy: (followM.isPending && followM.variables === orgId) || (isSupporter && followsQ.isLoading),
    onFollow: () => (isAuthenticated ? followM.mutate(orgId) : navigateTo("/login")),
  });

  const { data: orgs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["organisations", category],
    queryFn: () =>
      api.getOrganisations(category !== "All Causes" ? { category } : undefined),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const publicOrgs = orgs.filter(
    (o) => typeof o.name === "string" && o.name.trim().length > 0,
  );

  const filtered = publicOrgs.filter((o) => {
    const matchesSearch =
      (o.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (o.city ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (o.country ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesLocation =
      locationFilter === "All" || o.country === locationFilter;
    return matchesSearch && matchesLocation;
  });

  const selectCls = "w-full bg-transparent text-[16px] font-bold text-[#17100F] appearance-none pr-6 cursor-pointer focus:outline-none";
  const toggleCls = (on: boolean) =>
    `h-14 sm:h-[56px] px-5 inline-flex items-center justify-center gap-2 border border-[#17100F] text-[14px] font-bold transition-colors ${
      on ? "bg-[#F3BF2C] text-[#17100F]" : "bg-[#FBF8F2] text-[#17100F] hover:bg-[#17100F] hover:text-[#F4EFE6]"
    }`;

  return (
    <div className="rp-page-shell py-10 sm:py-14">
      <h1 className="rp-display rp-rise text-[clamp(38px,11vw,54px)] sm:text-[96px] lg:text-[124px] text-[#17100F]">Discover<br />organisations</h1>
      <p className="rp-label mt-6 sm:mt-8 text-[#17100F]/85">
        Find and support verified grassroots organisations in Jamaica, the UK, and beyond.
      </p>

      <div className="mt-8 sm:mt-10 grid grid-cols-2 lg:grid-cols-[1.9fr_1fr_1fr_auto_auto] gap-2 mb-10 sm:mb-12">
        <label className="col-span-2 lg:col-span-1 h-14 flex items-center gap-3 px-4 border border-[#17100F] bg-[#FBF8F2] focus-within:outline focus-within:outline-2 focus-within:outline-[#F3BF2C]">
          <Search className="w-4 h-4 text-[#17100F] shrink-0" />
          <span className="sr-only">Search organisations</span>
          <input
            type="search"
            placeholder="Search by name or location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[16px] placeholder:text-[#17100F]/55 focus:outline-none"
            data-testid="input-search"
          />
        </label>
        <label className="relative h-14 px-4 flex flex-col justify-center border border-[#17100F] bg-[#FBF8F2]">
          <span className="rp-label !text-[12px] text-[#17100F]/70">Country</span>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className={selectCls} data-testid="select-country">
            {DISCOVER_COUNTRIES.map(({ label, value }) => <option key={value} value={value}>{label}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 bottom-3 pointer-events-none" />
        </label>
        <label className="relative h-14 px-4 flex flex-col justify-center border border-[#17100F] bg-[#FBF8F2]">
          <span className="rp-label !text-[12px] text-[#17100F]/70">Cause</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls} data-testid="select-cause">
            {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat === "All Causes" ? "All causes" : cat}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 bottom-3 pointer-events-none" />
        </label>
        <button type="button" onClick={() => setViewMode("grid")} aria-pressed={viewMode === "grid"} className={toggleCls(viewMode === "grid")} data-testid="button-view-grid">
          <LayoutGrid className="w-4 h-4" /> Grid
        </button>
        <button type="button" onClick={() => setViewMode("map")} aria-pressed={viewMode === "map"} className={toggleCls(viewMode === "map")} data-testid="button-view-map">
          <MapPin className="w-4 h-4" /> Map
        </button>
      </div>

      {viewMode === "map" ? (
        <div className="border border-[#17100F]"><OrgMap orgs={filtered} country={locationFilter} /></div>
      ) : isError ? (
        <div className="border border-[#17100F] p-10 text-center" role="alert">
          <p className="rp-display text-[28px]">Could not load organisations.</p>
          <button type="button" onClick={() => refetch()} className="rp-btn rp-btn-yellow mt-5" data-testid="button-retry-orgs">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
          {Array.from({ length: 6 }).map((_, i) => <OrgCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-[#17100F]/40 py-16 px-6 text-center">
          <p className="rp-display text-[32px]">No organisations match</p>
          <p className="text-sm text-[#17100F]/70 mt-2">Try a different name, country or cause.</p>
          <button type="button" className="rp-btn rp-btn-ghost mt-5" onClick={() => { setSearch(""); setLocationFilter("All"); setCategory("All Causes"); }} data-testid="button-clear-filters">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
          {filtered.map((org) => <OrgCard key={org._id} org={org} follow={followFor(org._id)} />)}
        </div>
      )}
    </div>
  );
}
