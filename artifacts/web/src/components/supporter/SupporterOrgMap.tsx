import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "wouter";
import type { Org } from "@/lib/api";

const pin = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;background:#F3BF2C;border:2.5px solid #17100F;border-radius:50%;box-shadow:0 2px 6px rgba(23,16,15,.35)"></div>',
  iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -10],
});

export type MappedOrg = { org: Org; position: [number, number] };

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const sig = points.map(p => p.join(",")).join("|");
  useEffect(() => {
    if (points.length === 0) { map.setView([20, -30], 2); return; }
    if (points.length === 1) map.setView(points[0], 10);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, map]);
  return null;
}

/** Pins only organisations with real stored coordinates. No geocoding, no jitter. */
export function SupporterOrgMap({ items }: { items: MappedOrg[] }) {
  return (
    <MapContainer center={[20, -30]} zoom={2} style={{ height: "min(520px, 62dvh)", width: "100%" }} className="z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={items.map(i => i.position)} />
      {items.map(({ org, position }) => (
        <Marker key={org._id} position={position} icon={pin}>
          <Popup>
            <div style={{ minWidth: 170, maxWidth: 220 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{org.name}</div>
              <div style={{ fontSize: 12, opacity: .7, margin: "2px 0 8px" }}>{[org.city, org.country].filter(Boolean).join(", ")}</div>
              <Link href={`/organisations/${encodeURIComponent(org._id)}`} className="rpd-pop-link" data-testid={`link-map-org-${org._id}`}>View profile</Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
