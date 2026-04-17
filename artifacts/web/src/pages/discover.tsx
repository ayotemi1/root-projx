import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api";
import type { Org } from "@/lib/api";

const CATEGORIES = [
  "All",
  "Youth Empowerment",
  "Maternal Health",
  "Environment",
  "Diaspora Support",
  "Education",
  "Mental Health",
  "Arts & Culture",
];

function OrgCard({ org }: { org: Org }) {
  return (
    <Link href={`/organisations/${org._id}`}>
      <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer hover:border-primary/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-foreground text-base leading-tight truncate">
                {org.name}
              </h3>
              {org.verified && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" /> Verified
                </span>
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
          className="mt-3 bg-accent/20 text-accent-foreground border-accent/30 text-xs font-semibold"
        >
          {org.category}
        </Badge>

        <p className="text-foreground text-sm mt-3 leading-relaxed line-clamp-2">
          {org.description}
        </p>

        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{org.followerCount ?? 0}</strong> followers
          </span>
          {(org.totalRaised ?? 0) > 0 && (
            <span>
              <strong className="text-foreground">£{org.totalRaised.toLocaleString()}</strong> raised
            </span>
          )}
        </div>
      </div>
    </Link>
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
    </div>
  );
}

export default function DiscoverPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const { data: orgs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["organisations", category],
    queryFn: () =>
      api.getOrganisations(category !== "All" ? { category } : undefined),
  });

  const filtered = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.city ?? "").toLowerCase().includes(search.toLowerCase()) ||
      o.country.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-foreground">Discover Organisations</h1>
        <p className="text-muted-foreground mt-1">
          Find and support verified grassroots organisations in Jamaica, the UK, and beyond.
        </p>
      </div>

      {/* Search */}
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

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              category === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results */}
      {isError ? (
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
