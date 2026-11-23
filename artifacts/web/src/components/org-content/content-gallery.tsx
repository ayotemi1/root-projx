import { useMemo, useState } from "react";
import { Play, Image as ImageIcon, ExternalLink, Link2, Film, Images, Pin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { FeedUpdate } from "@/lib/api";
import { summarise, matchesFilter, type FilterKey } from "@/lib/content-media";
import { InlineVideoPlayer } from "@/components/inline-video-player";
import { usePostViewer } from "@/components/post-viewer/PostViewerProvider";

const RED = "#B50000";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "photos", label: "Photos" },
  { key: "videos", label: "Videos" },
  { key: "links", label: "Links" },
];

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Card({ item, onOpen, feed = false }: { item: FeedUpdate; onOpen: (trigger: HTMLElement) => void; feed?: boolean }) {
  const s = summarise(item);
  const cover = item.coverUrl || s.images[0];
  const hasVideo = s.videos.length > 0 || !!s.link?.embedUrl;
  const count = s.images.length + s.videos.length;
  return (
    <div
      onClick={e => { if (!(e.target as HTMLElement).closest("button,a,input")) onOpen(e.currentTarget); }}
      className={`group text-left bg-white border border-border overflow-hidden flex flex-col hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${feed ? "rounded-xl" : "rounded-sm"}`}
      style={{ position: "relative", ["--tw-ring-color" as string]: RED }}
      data-testid={`card-content-${item._id}`}
    >
      {item.pinned && <span className="absolute right-2 top-2 z-10 bg-[#F3EFE5] p-1" aria-label="Pinned post"><Pin size={14} aria-hidden /></span>}
      {feed && <p className="px-3 py-2 text-sm font-bold truncate">{item.orgName}</p>}
      {s.videos[0] && feed ? <div className={`relative ${feed ? "aspect-[4/3]" : "aspect-[4/5]"} w-full bg-secondary overflow-hidden`}>
        <InlineVideoPlayer src={s.videos[0]} poster={cover} label={`${item.orgName || "Organisation"} video`} />
        {count > 1 && <span className="absolute top-2 left-2 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white pointer-events-none">{count} items</span>}
      </div> : <button type="button" onClick={e => onOpen(e.currentTarget)} aria-label={`Open ${item.title || "post"}`}
        className={`relative ${feed ? "aspect-[4/3]" : "aspect-[4/5]"} w-full bg-secondary overflow-hidden`}>
        {cover ? (
          <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
        ) : s.videos[0] ? (
          <video src={`${s.videos[0]}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover pointer-events-none" aria-hidden />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #FFF7E6 0%, #FDE8E8 100%)" }}>
            <p className="text-sm font-bold text-foreground/70 line-clamp-4 text-center">{item.content}</p>
          </div>
        )}
        {hasVideo && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-11 h-11 rounded-full bg-black/60 flex items-center justify-center"><Play className="w-5 h-5 text-white fill-white" /></span>
          </span>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          {count > 1 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white flex items-center gap-1"><Images className="w-3 h-3" />{count}</span>}
          {s.link && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/90 text-foreground">{s.link.label}</span>}
        </div>
      </button>}
      <button type="button" onClick={e => onOpen(e.currentTarget)} className={feed ? "p-3 text-left" : "p-2 text-left text-xs hover:underline"} aria-label={`Open ${item.title || "post"}`}>
        <p className="text-[10px] text-muted-foreground font-semibold">{dateLabel(item.createdAt)}</p>
        <h4 className="font-bold text-sm leading-snug line-clamp-2 mt-0.5">{item.title || item.content || "View post"}</h4>
      </button>
    </div>
  );
}

export function ContentGallery({ items, isLoading, isError, onRetry, feed = false }: {
  items: FeedUpdate[]; isLoading: boolean; isError: boolean; onRetry: () => void; feed?: boolean;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const viewer = usePostViewer();
  const counts = useMemo(() => {
    const sums = items.map(summarise);
    return Object.fromEntries(FILTERS.map((f) => [f.key, sums.filter((s) => matchesFilter(s, f.key)).length])) as Record<FilterKey, number>;
  }, [items]);
  const visible = useMemo(() => items.filter((i) => matchesFilter(summarise(i), filter)), [items, filter]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="status-content-loading">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-xl" />)}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="text-center py-10" role="alert">
        <p className="text-sm font-semibold">We couldn't load these posts.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry} data-testid="button-retry-content">Try again</Button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="text-center py-12 px-4 border border-dashed border-border rounded-xl">
        <Film className="w-6 h-6 mx-auto mb-2" style={{ color: RED }} />
        <p className="font-bold text-sm">No content yet</p>
        <p className="text-xs text-muted-foreground mt-1">Photos, videos, stories and everyday moments will appear here once posted.</p>
      </div>
    );
  }

  const icons: Record<FilterKey, typeof ImageIcon> = { all: Images, photos: ImageIcon, videos: Play, links: Link2 };
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h3 className="font-bold text-foreground text-base">{feed ? "Posts from organisations" : "Posts"}</h3>
        <div role="group" aria-label="Filter content" className="flex flex-wrap gap-1 max-w-full">
          {FILTERS.map((f) => {
            const Icon = icons[f.key];
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.key)}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full border whitespace-nowrap transition-colors"
                style={active ? { backgroundColor: RED, borderColor: RED, color: "#fff" } : undefined}
                data-testid={`filter-content-${f.key}`}
              >
                <Icon className="w-3 h-3" />{f.label}<span className="opacity-70">{counts[f.key]}</span>
              </button>
            );
          })}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="text-center py-10 text-sm text-muted-foreground">Nothing in this filter yet.</p>
      ) : (
        <div className={feed ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "grid grid-cols-3 gap-1"} data-testid="posts-grid">
          {visible.map((u, i) => <Card key={u._id} item={u} feed={feed} onOpen={trigger => {
            // Profile grids open the shared viewer across everything in this filter, videos included.
            viewer.open({ refs: visible.map(v => ({ kind: "update" as const, id: v._id })), index: i, label: u.orgName || undefined, trigger });
          }} />)}
        </div>
      )}
    </div>
  );
}
