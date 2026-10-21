import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Search, BadgeCheck, LayoutGrid, MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api";
import type { Org } from "@/lib/api";
import { DISCOVER_COUNTRIES } from "@/lib/countries";

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

const GOLD = "#F5C000";
const BRAND_RED = "#E31C23";

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
      style={{ height: "520px", width: "100%", borderRadius: "12px" }}
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
                    backgroundColor: BRAND_RED,
                    color: "#fff",
                    borderRadius: "6px",
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

function OrgCard({ org }: { org: Org }) {
  const [, navigate] = useLocation();
  const progressPct = Math.min(100, (org.impactScore ?? 0));

  return (
    <div
      onClick={() => navigate(`/organisations/${org._id}`)}
      className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer hover:border-primary/30 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-bold text-foreground text-base leading-tight truncate">
              {org.name}
            </h3>
            {org.verified && (
              <BadgeCheck
                className="w-4 h-4 flex-shrink-0"
                style={{ color: GOLD }}
                aria-label="Verified"
              />
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            {[org.city, org.country].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="text-primary font-bold text-sm">
            {org.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
        </div>
      </div>

      <Badge
        variant="secondary"
        className="w-fit bg-accent/20 text-accent-foreground border-accent/30 text-xs font-semibold"
      >
        {org.category}
      </Badge>

      <p className="text-foreground text-sm leading-relaxed line-clamp-2">
        {org.shortDescription?.trim() || org.description}
      </p>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          <strong className="text-foreground">{org.followerCount ?? 0}</strong> followers
        </span>
        {(org.totalRaised ?? 0) > 0 && (
          <span>
            <strong className="text-foreground">£{org.totalRaised.toLocaleString()}</strong> raised
          </span>
        )}
      </div>

      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progressPct}%`, backgroundColor: GOLD }}
        />
      </div>

      <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
        <Link href={`/donate/${org._id}`} className="flex-1">
          <button
            className="w-full py-1.5 rounded-md text-sm font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: GOLD, color: "#111" }}
          >
            Donate
          </button>
        </Link>
        <Link href={`/organisations/${org._id}`} className="flex-1">
          <button className="w-full py-1.5 rounded-md text-sm font-semibold border border-border hover:border-primary/40 hover:text-primary transition-colors">
            Follow
          </button>
        </Link>
      </div>
    </div>
  );
}

function OrgCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="flex-1 h-5 rounded" />
        <Skeleton className="w-12 h-12 rounded-full" />
      </div>
      <Skeleton className="h-4 w-24 rounded" />
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-3/4 rounded" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="flex-1 h-8 rounded-md" />
        <Skeleton className="flex-1 h-8 rounded-md" />
      </div>
    </div>
  );
}

type ViewMode = "grid" | "map";

export default function DiscoverPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Causes");
  const [locationFilter, setLocationFilter] = useState("All");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-foreground">Discover Organisations</h1>
        <p className="text-muted-foreground mt-1">
          Find and support verified grassroots organisations in Jamaica, the UK, and beyond.
        </p>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search organisations by name or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Country dropdown */}
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="h-10 px-3 text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            color: "#0f172a",
            borderRadius: "8px",
            width: "180px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          {DISCOVER_COUNTRIES.map(({ label, value }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* Causes dropdown */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 px-3 text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            color: "#0f172a",
            borderRadius: "8px",
            width: "200px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* View toggle */}
        <div className="flex-shrink-0 flex items-center gap-1 border border-border rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all"
            style={
              viewMode === "grid"
                ? { backgroundColor: GOLD, color: "#111" }
                : { backgroundColor: "transparent", color: BRAND_RED, border: "none" }
            }
          >
            <LayoutGrid className="w-4 h-4" />
            Grid
          </button>
          <button
            onClick={() => setViewMode("map")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all"
            style={
              viewMode === "map"
                ? { backgroundColor: GOLD, color: "#111" }
                : { backgroundColor: "transparent", color: BRAND_RED, border: "none" }
            }
          >
            <MapPin className="w-4 h-4" />
            Map
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "map" ? (
        <OrgMap orgs={filtered} country={locationFilter} />
      ) : isError ? (
        <div className="text-center py-20">
          <p className="text-destructive mb-4">Could not load organisations.</p>
          <Button onClick={() => refetch()} variant="outline">Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <OrgCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          No organisations match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((org) => <OrgCard key={org._id} org={org} />)}
        </div>
      )}
    </div>
  );
}
