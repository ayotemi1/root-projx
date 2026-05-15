import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, Globe, LayoutGrid, MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api";
import type { Resource } from "@/lib/api";

const CATEGORIES = ["All Categories", "Housing", "Legal", "Mental Health", "Health"];
const COUNTRIES = ["All Countries", "Jamaica", "United Kingdom"];

const COUNTRY_COORDS: Record<string, { center: [number, number]; zoom: number }> = {
  Jamaica:          { center: [18.1096, -77.2975], zoom: 8 },
  "United Kingdom": { center: [55.3781,  -3.4360], zoom: 6 },
};

const DEFAULT_CENTER: [number, number] = [30, -20];
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
    if (country === "All Countries") {
      map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 1 });
    } else {
      const loc = COUNTRY_COORDS[country];
      if (loc) map.flyTo(loc.center, loc.zoom, { duration: 1 });
    }
  }, [country, map]);
  return null;
}

function ResourceMap({ resources, country }: { resources: Resource[]; country: string }) {
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
      {resources.map((item) => {
        const coords = COUNTRY_COORDS[item.country];
        if (!coords) return null;
        const jitter: [number, number] = [
          coords.center[0] + (Math.random() - 0.5) * 0.6,
          coords.center[1] + (Math.random() - 0.5) * 0.6,
        ];
        return (
          <Marker key={item._id} position={jitter} icon={goldIcon}>
            <Popup>
              <div style={{ minWidth: "180px", maxWidth: "220px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>
                  {item.title}
                </div>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>
                  {item.category} · {item.country}
                </div>
                <div style={{ fontSize: "12px", marginBottom: "10px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                  {item.description}
                </div>
                {item.contact?.website && (
                  <a
                    href={item.contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
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
                    Visit
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

function ResourceCard({ item }: { item: Resource }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge
          variant="secondary"
          className="bg-accent/20 text-accent-foreground border-accent/30 text-xs font-bold"
        >
          {item.category}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {item.country}
        </Badge>
      </div>

      <h3 className="font-bold text-foreground text-base">{item.title}</h3>
      <p className="text-foreground/70 text-sm leading-relaxed">{item.description}</p>

      {item.contact && (
        <div className="flex flex-wrap gap-2 pt-1">
          {item.contact.phone && (
            <a
              href={`tel:${item.contact.phone}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline bg-secondary px-3 py-1.5 rounded-lg"
            >
              <Phone className="w-3.5 h-3.5" />
              {item.contact.phone}
            </a>
          )}
          {item.contact.email && (
            <a
              href={`mailto:${item.contact.email}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline bg-secondary px-3 py-1.5 rounded-lg"
            >
              <Mail className="w-3.5 h-3.5" />
              {item.contact.email}
            </a>
          )}
          {item.contact.website && (
            <a
              href={item.contact.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline bg-secondary px-3 py-1.5 rounded-lg"
            >
              <Globe className="w-3.5 h-3.5" />
              Website
            </a>
          )}
        </div>
      )}

      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((t) => (
            <span
              key={t}
              className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex gap-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-20" /></div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

type ViewMode = "grid" | "map";

export default function HelpPage() {
  const [category, setCategory] = useState("All Categories");
  const [country, setCountry] = useState("All Countries");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const { data: resources = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["resources", category, country],
    queryFn: () =>
      api.getResources({
        category: category !== "All Categories" ? category : undefined,
        country: country !== "All Countries" ? country : undefined,
      }),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-foreground">Get Help Directory</h1>
        <p className="text-muted-foreground mt-1">
          Find grassroots support organisations for housing, legal, health, and more.
        </p>
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
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
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

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
            <option key={cat} value={cat}>{cat}</option>
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
        <ResourceMap resources={resources} country={country} />
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-destructive mb-4">Could not load resources.</p>
          <Button onClick={() => refetch()} variant="outline">Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <ResourceSkeleton key={i} />)}
        </div>
      ) : resources.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No resources found for this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {resources.map((r) => <ResourceCard key={r._id} item={r} />)}
        </div>
      )}
    </div>
  );
}
