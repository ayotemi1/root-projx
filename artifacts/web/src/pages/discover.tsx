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

const COUNTRIES = [
  { label: "All Countries", value: "All" },
  { label: "Afghanistan 🇦🇫", value: "Afghanistan" },
  { label: "Albania 🇦🇱", value: "Albania" },
  { label: "Algeria 🇩🇿", value: "Algeria" },
  { label: "Andorra 🇦🇩", value: "Andorra" },
  { label: "Angola 🇦🇴", value: "Angola" },
  { label: "Antigua and Barbuda 🇦🇬", value: "Antigua and Barbuda" },
  { label: "Argentina 🇦🇷", value: "Argentina" },
  { label: "Armenia 🇦🇲", value: "Armenia" },
  { label: "Australia 🇦🇺", value: "Australia" },
  { label: "Austria 🇦🇹", value: "Austria" },
  { label: "Azerbaijan 🇦🇿", value: "Azerbaijan" },
  { label: "Bahamas 🇧🇸", value: "Bahamas" },
  { label: "Bahrain 🇧🇭", value: "Bahrain" },
  { label: "Bangladesh 🇧🇩", value: "Bangladesh" },
  { label: "Barbados 🇧🇧", value: "Barbados" },
  { label: "Belarus 🇧🇾", value: "Belarus" },
  { label: "Belgium 🇧🇪", value: "Belgium" },
  { label: "Belize 🇧🇿", value: "Belize" },
  { label: "Benin 🇧🇯", value: "Benin" },
  { label: "Bhutan 🇧🇹", value: "Bhutan" },
  { label: "Bolivia 🇧🇴", value: "Bolivia" },
  { label: "Bosnia and Herzegovina 🇧🇦", value: "Bosnia and Herzegovina" },
  { label: "Botswana 🇧🇼", value: "Botswana" },
  { label: "Brazil 🇧🇷", value: "Brazil" },
  { label: "Brunei 🇧🇳", value: "Brunei" },
  { label: "Bulgaria 🇧🇬", value: "Bulgaria" },
  { label: "Burkina Faso 🇧🇫", value: "Burkina Faso" },
  { label: "Burundi 🇧🇮", value: "Burundi" },
  { label: "Cabo Verde 🇨🇻", value: "Cabo Verde" },
  { label: "Cambodia 🇰🇭", value: "Cambodia" },
  { label: "Cameroon 🇨🇲", value: "Cameroon" },
  { label: "Canada 🇨🇦", value: "Canada" },
  { label: "Central African Republic 🇨🇫", value: "Central African Republic" },
  { label: "Chad 🇹🇩", value: "Chad" },
  { label: "Chile 🇨🇱", value: "Chile" },
  { label: "China 🇨🇳", value: "China" },
  { label: "Colombia 🇨🇴", value: "Colombia" },
  { label: "Comoros 🇰🇲", value: "Comoros" },
  { label: "Congo (Brazzaville) 🇨🇬", value: "Congo (Brazzaville)" },
  { label: "Congo (Kinshasa) 🇨🇩", value: "Congo (Kinshasa)" },
  { label: "Costa Rica 🇨🇷", value: "Costa Rica" },
  { label: "Côte d'Ivoire 🇨🇮", value: "Côte d'Ivoire" },
  { label: "Croatia 🇭🇷", value: "Croatia" },
  { label: "Cuba 🇨🇺", value: "Cuba" },
  { label: "Cyprus 🇨🇾", value: "Cyprus" },
  { label: "Czech Republic 🇨🇿", value: "Czech Republic" },
  { label: "Denmark 🇩🇰", value: "Denmark" },
  { label: "Djibouti 🇩🇯", value: "Djibouti" },
  { label: "Dominica 🇩🇲", value: "Dominica" },
  { label: "Dominican Republic 🇩🇴", value: "Dominican Republic" },
  { label: "Ecuador 🇪🇨", value: "Ecuador" },
  { label: "Egypt 🇪🇬", value: "Egypt" },
  { label: "El Salvador 🇸🇻", value: "El Salvador" },
  { label: "Equatorial Guinea 🇬🇶", value: "Equatorial Guinea" },
  { label: "Eritrea 🇪🇷", value: "Eritrea" },
  { label: "Estonia 🇪🇪", value: "Estonia" },
  { label: "Eswatini 🇸🇿", value: "Eswatini" },
  { label: "Ethiopia 🇪🇹", value: "Ethiopia" },
  { label: "Fiji 🇫🇯", value: "Fiji" },
  { label: "Finland 🇫🇮", value: "Finland" },
  { label: "France 🇫🇷", value: "France" },
  { label: "Gabon 🇬🇦", value: "Gabon" },
  { label: "Gambia 🇬🇲", value: "Gambia" },
  { label: "Georgia 🇬🇪", value: "Georgia" },
  { label: "Germany 🇩🇪", value: "Germany" },
  { label: "Ghana 🇬🇭", value: "Ghana" },
  { label: "Greece 🇬🇷", value: "Greece" },
  { label: "Grenada 🇬🇩", value: "Grenada" },
  { label: "Guatemala 🇬🇹", value: "Guatemala" },
  { label: "Guinea 🇬🇳", value: "Guinea" },
  { label: "Guinea-Bissau 🇬🇼", value: "Guinea-Bissau" },
  { label: "Guyana 🇬🇾", value: "Guyana" },
  { label: "Haiti 🇭🇹", value: "Haiti" },
  { label: "Honduras 🇭🇳", value: "Honduras" },
  { label: "Hungary 🇭🇺", value: "Hungary" },
  { label: "Iceland 🇮🇸", value: "Iceland" },
  { label: "India 🇮🇳", value: "India" },
  { label: "Indonesia 🇮🇩", value: "Indonesia" },
  { label: "Iran 🇮🇷", value: "Iran" },
  { label: "Iraq 🇮🇶", value: "Iraq" },
  { label: "Ireland 🇮🇪", value: "Ireland" },
  { label: "Israel 🇮🇱", value: "Israel" },
  { label: "Italy 🇮🇹", value: "Italy" },
  { label: "Jamaica 🇯🇲", value: "Jamaica" },
  { label: "Japan 🇯🇵", value: "Japan" },
  { label: "Jordan 🇯🇴", value: "Jordan" },
  { label: "Kazakhstan 🇰🇿", value: "Kazakhstan" },
  { label: "Kenya 🇰🇪", value: "Kenya" },
  { label: "Kiribati 🇰🇮", value: "Kiribati" },
  { label: "Kuwait 🇰🇼", value: "Kuwait" },
  { label: "Kyrgyzstan 🇰🇬", value: "Kyrgyzstan" },
  { label: "Laos 🇱🇦", value: "Laos" },
  { label: "Latvia 🇱🇻", value: "Latvia" },
  { label: "Lebanon 🇱🇧", value: "Lebanon" },
  { label: "Lesotho 🇱🇸", value: "Lesotho" },
  { label: "Liberia 🇱🇷", value: "Liberia" },
  { label: "Libya 🇱🇾", value: "Libya" },
  { label: "Liechtenstein 🇱🇮", value: "Liechtenstein" },
  { label: "Lithuania 🇱🇹", value: "Lithuania" },
  { label: "Luxembourg 🇱🇺", value: "Luxembourg" },
  { label: "Madagascar 🇲🇬", value: "Madagascar" },
  { label: "Malawi 🇲🇼", value: "Malawi" },
  { label: "Malaysia 🇲🇾", value: "Malaysia" },
  { label: "Maldives 🇲🇻", value: "Maldives" },
  { label: "Mali 🇲🇱", value: "Mali" },
  { label: "Malta 🇲🇹", value: "Malta" },
  { label: "Marshall Islands 🇲🇭", value: "Marshall Islands" },
  { label: "Mauritania 🇲🇷", value: "Mauritania" },
  { label: "Mauritius 🇲🇺", value: "Mauritius" },
  { label: "Mexico 🇲🇽", value: "Mexico" },
  { label: "Micronesia 🇫🇲", value: "Micronesia" },
  { label: "Moldova 🇲🇩", value: "Moldova" },
  { label: "Monaco 🇲🇨", value: "Monaco" },
  { label: "Mongolia 🇲🇳", value: "Mongolia" },
  { label: "Montenegro 🇲🇪", value: "Montenegro" },
  { label: "Morocco 🇲🇦", value: "Morocco" },
  { label: "Mozambique 🇲🇿", value: "Mozambique" },
  { label: "Myanmar 🇲🇲", value: "Myanmar" },
  { label: "Namibia 🇳🇦", value: "Namibia" },
  { label: "Nauru 🇳🇷", value: "Nauru" },
  { label: "Nepal 🇳🇵", value: "Nepal" },
  { label: "Netherlands 🇳🇱", value: "Netherlands" },
  { label: "New Zealand 🇳🇿", value: "New Zealand" },
  { label: "Nicaragua 🇳🇮", value: "Nicaragua" },
  { label: "Niger 🇳🇪", value: "Niger" },
  { label: "Nigeria 🇳🇬", value: "Nigeria" },
  { label: "North Korea 🇰🇵", value: "North Korea" },
  { label: "North Macedonia 🇲🇰", value: "North Macedonia" },
  { label: "Norway 🇳🇴", value: "Norway" },
  { label: "Oman 🇴🇲", value: "Oman" },
  { label: "Pakistan 🇵🇰", value: "Pakistan" },
  { label: "Palau 🇵🇼", value: "Palau" },
  { label: "Palestine 🇵🇸", value: "Palestine" },
  { label: "Panama 🇵🇦", value: "Panama" },
  { label: "Papua New Guinea 🇵🇬", value: "Papua New Guinea" },
  { label: "Paraguay 🇵🇾", value: "Paraguay" },
  { label: "Peru 🇵🇪", value: "Peru" },
  { label: "Philippines 🇵🇭", value: "Philippines" },
  { label: "Poland 🇵🇱", value: "Poland" },
  { label: "Portugal 🇵🇹", value: "Portugal" },
  { label: "Qatar 🇶🇦", value: "Qatar" },
  { label: "Romania 🇷🇴", value: "Romania" },
  { label: "Russia 🇷🇺", value: "Russia" },
  { label: "Rwanda 🇷🇼", value: "Rwanda" },
  { label: "Saint Kitts and Nevis 🇰🇳", value: "Saint Kitts and Nevis" },
  { label: "Saint Lucia 🇱🇨", value: "Saint Lucia" },
  { label: "Saint Vincent and the Grenadines 🇻🇨", value: "Saint Vincent and the Grenadines" },
  { label: "Samoa 🇼🇸", value: "Samoa" },
  { label: "San Marino 🇸🇲", value: "San Marino" },
  { label: "São Tomé and Príncipe 🇸🇹", value: "São Tomé and Príncipe" },
  { label: "Saudi Arabia 🇸🇦", value: "Saudi Arabia" },
  { label: "Senegal 🇸🇳", value: "Senegal" },
  { label: "Serbia 🇷🇸", value: "Serbia" },
  { label: "Seychelles 🇸🇨", value: "Seychelles" },
  { label: "Sierra Leone 🇸🇱", value: "Sierra Leone" },
  { label: "Singapore 🇸🇬", value: "Singapore" },
  { label: "Slovakia 🇸🇰", value: "Slovakia" },
  { label: "Slovenia 🇸🇮", value: "Slovenia" },
  { label: "Solomon Islands 🇸🇧", value: "Solomon Islands" },
  { label: "Somalia 🇸🇴", value: "Somalia" },
  { label: "South Africa 🇿🇦", value: "South Africa" },
  { label: "South Korea 🇰🇷", value: "South Korea" },
  { label: "South Sudan 🇸🇸", value: "South Sudan" },
  { label: "Spain 🇪🇸", value: "Spain" },
  { label: "Sri Lanka 🇱🇰", value: "Sri Lanka" },
  { label: "Sudan 🇸🇩", value: "Sudan" },
  { label: "Suriname 🇸🇷", value: "Suriname" },
  { label: "Sweden 🇸🇪", value: "Sweden" },
  { label: "Switzerland 🇨🇭", value: "Switzerland" },
  { label: "Syria 🇸🇾", value: "Syria" },
  { label: "Taiwan 🇹🇼", value: "Taiwan" },
  { label: "Tajikistan 🇹🇯", value: "Tajikistan" },
  { label: "Tanzania 🇹🇿", value: "Tanzania" },
  { label: "Thailand 🇹🇭", value: "Thailand" },
  { label: "Timor-Leste 🇹🇱", value: "Timor-Leste" },
  { label: "Togo 🇹🇬", value: "Togo" },
  { label: "Tonga 🇹🇴", value: "Tonga" },
  { label: "Trinidad and Tobago 🇹🇹", value: "Trinidad and Tobago" },
  { label: "Tunisia 🇹🇳", value: "Tunisia" },
  { label: "Turkey 🇹🇷", value: "Turkey" },
  { label: "Turkmenistan 🇹🇲", value: "Turkmenistan" },
  { label: "Tuvalu 🇹🇻", value: "Tuvalu" },
  { label: "Uganda 🇺🇬", value: "Uganda" },
  { label: "Ukraine 🇺🇦", value: "Ukraine" },
  { label: "United Arab Emirates 🇦🇪", value: "United Arab Emirates" },
  { label: "United Kingdom 🇬🇧", value: "United Kingdom" },
  { label: "United States 🇺🇸", value: "United States" },
  { label: "Uruguay 🇺🇾", value: "Uruguay" },
  { label: "Uzbekistan 🇺🇿", value: "Uzbekistan" },
  { label: "Vanuatu 🇻🇺", value: "Vanuatu" },
  { label: "Vatican City 🇻🇦", value: "Vatican City" },
  { label: "Venezuela 🇻🇪", value: "Venezuela" },
  { label: "Vietnam 🇻🇳", value: "Vietnam" },
  { label: "Yemen 🇾🇪", value: "Yemen" },
  { label: "Zambia 🇿🇲", value: "Zambia" },
  { label: "Zimbabwe 🇿🇼", value: "Zimbabwe" },
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
                  {org.description}
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
        {org.description}
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
          {COUNTRIES.map(({ label, value }) => (
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
