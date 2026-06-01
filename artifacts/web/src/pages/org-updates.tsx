import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Calendar, Heart, MessageCircle, Share2, ArrowLeft } from "lucide-react";
import * as api from "@/lib/api";
import type { FeedUpdate, Org } from "@/lib/api";

const RED = "#B50000";

// ── Placeholder posts shown when the org has no feed updates ──────────────────

const PLACEHOLDER_UPDATES: FeedUpdate[] = [
  {
    _id: "ph_001", orgId: "", orgName: "",
    type: "milestone", title: "50 young people complete our carpentry programme",
    content: "We are proud to announce that 50 graduates from our 12-week carpentry and joinery programme received their certificates last Friday.",
    mediaUrls: [], imageUrl: null, likes: 87, createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    _id: "ph_002", orgId: "", orgName: "",
    type: "update", title: "Community garden project update",
    content: "The garden is coming along! Thanks to our volunteers and local businesses for the support.",
    mediaUrls: [], imageUrl: null, likes: 45, createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    _id: "ph_003", orgId: "", orgName: "",
    type: "update", title: "Guest speaker session",
    content: "We had an amazing session with entrepreneur David Clarke who shared insights with our youth about business and resilience.",
    mediaUrls: [], imageUrl: null, likes: 60, createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const wks = Math.floor(days / 7);
  if (wks < 5) return `${wks} week${wks === 1 ? "" : "s"} ago`;
  const mos = Math.floor(days / 30);
  return `${mos} month${mos === 1 ? "" : "s"} ago`;
}

function allImages(u: FeedUpdate) {
  const urls: string[] = [];
  if (u.imageUrl) urls.push(u.imageUrl);
  (u.mediaUrls ?? []).forEach((m) => {
    if (!m.endsWith(".mp4") && !m.includes("video") && !urls.includes(m)) urls.push(m);
  });
  return urls;
}

// ── Update card ───────────────────────────────────────────────────────────────

function UpdateCard({ u, location }: { u: FeedUpdate; location: string }) {
  const images = allImages(u);

  return (
    <div className="bg-white border border-[#E0D8CC] rounded-2xl overflow-hidden flex flex-col shadow-sm">
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Top meta row */}
        <div className="flex items-center justify-between text-xs text-[#888]">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {timeAgo(u.createdAt)}
          </span>
          {location && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {location}
            </span>
          )}
        </div>

        {/* Title + body */}
        <div>
          <h3 className="font-bold text-[#1A1A1A] leading-snug mb-1">{u.title}</h3>
          <p className="text-sm text-[#555] line-clamp-3">{u.content}</p>
        </div>

        {/* Image grid */}
        {images.length === 1 && (
          <div className="rounded-xl overflow-hidden aspect-video bg-[#EDE8E0]">
            <img src={images[0]} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        {images.length >= 2 && (
          <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden">
            {images.slice(0, 3).map((src, i) => (
              <div key={i} className="aspect-square bg-[#EDE8E0] overflow-hidden">
                <img src={src} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom action row */}
      <div className="px-4 pb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-[#666] text-sm">
          <button className="flex items-center gap-1 hover:text-red-700 transition-colors">
            <Heart size={15} />
            <span>{u.likes ?? 0}</span>
          </button>
          <button className="flex items-center gap-1 hover:text-red-700 transition-colors">
            <MessageCircle size={15} />
            <span>0</span>
          </button>
          <button className="flex items-center gap-1 hover:text-red-700 transition-colors">
            <Share2 size={15} />
            <span>Share</span>
          </button>
        </div>
        <button
          className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: RED }}
        >
          View Details
        </button>
      </div>
    </div>
  );
}

// ── Red CTA card ──────────────────────────────────────────────────────────────

function CtaCard({ orgId }: { orgId: string }) {
  return (
    <div
      className="rounded-2xl flex flex-col items-center justify-center gap-3 p-8 text-center min-h-[240px]"
      style={{ background: RED }}
    >
      <p className="text-white font-bold text-xl">Want to see more?</p>
      <p className="text-white/80 text-sm">Check out all updates and stories.</p>
      <Link
        href={`/feed`}
        className="mt-2 px-5 py-2 rounded-lg text-sm font-semibold bg-transparent text-white border border-white hover:bg-white/10 transition-colors"
      >
        View All Updates
      </Link>
    </div>
  );
}

// ── Media grid tile ───────────────────────────────────────────────────────────

function MediaGrid({ updates }: { updates: FeedUpdate[] }) {
  const tiles = updates.flatMap((u) => allImages(u));

  if (tiles.length === 0) {
    return (
      <div className="py-20 text-center text-[#999] text-sm">
        No media shared yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-2 rounded-2xl overflow-hidden">
      {tiles.map((src, i) => (
        <div key={i} className="aspect-square bg-[#EDE8E0] overflow-hidden rounded-lg cursor-pointer group">
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgUpdatesPage() {
  const params = useParams<{ id: string }>();
  const orgId = params.id!;
  const [tab, setTab] = useState<"all" | "media">("all");

  const { data: org } = useQuery<Org>({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId),
  });

  const { data: rawUpdates = [], isLoading } = useQuery<FeedUpdate[]>({
    queryKey: ["org-feed", orgId],
    queryFn: () => api.getOrgFeed(orgId),
  });

  const updates = rawUpdates.length > 0 ? rawUpdates : PLACEHOLDER_UPDATES;
  const location = [org?.city, org?.country].filter(Boolean).join(", ");

  // Inject the CTA card at position 4 (index 3) in the grid
  const CTA_POSITION = 3;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
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
        <h1 className="text-3xl font-bold text-[#1A1A1A]">Updates</h1>
        <p className="text-[#666] mt-1 text-sm">
          Stay informed about our latest activities and achievements.
        </p>
      </div>

      {/* All Updates / Media toggle */}
      <div className="flex gap-2 mb-7">
        <button
          onClick={() => setTab("all")}
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
          style={
            tab === "all"
              ? { background: RED, color: "#fff" }
              : { background: "transparent", color: RED, border: `1.5px solid ${RED}` }
          }
        >
          All Updates
        </button>
        <button
          onClick={() => setTab("media")}
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
          style={
            tab === "media"
              ? { background: RED, color: "#fff" }
              : { background: "transparent", color: RED, border: `1.5px solid ${RED}` }
          }
        >
          Media
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-[#F2EDE4] animate-pulse" />
          ))}
        </div>
      ) : tab === "media" ? (
        <MediaGrid updates={updates} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {updates.slice(0, CTA_POSITION).map((u) => (
            <UpdateCard key={u._id} u={u} location={location} />
          ))}
          {/* Red CTA card injected at position 4 */}
          <CtaCard orgId={orgId} />
          {updates.slice(CTA_POSITION).map((u) => (
            <UpdateCard key={u._id} u={u} location={location} />
          ))}
        </div>
      )}
    </div>
  );
}
