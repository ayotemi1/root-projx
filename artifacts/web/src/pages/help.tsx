import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api";
import type { Resource } from "@/lib/api";

const CATEGORIES = ["All", "Housing", "Legal", "Mental Health", "Health"];
const COUNTRIES = ["All", "Jamaica", "United Kingdom"];

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

export default function HelpPage() {
  const [category, setCategory] = useState("All");
  const [country, setCountry] = useState("All");

  const { data: resources = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["resources", category, country],
    queryFn: () =>
      api.getResources({
        category: category !== "All" ? category : undefined,
        country: country !== "All" ? country : undefined,
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

      {/* Filters */}
      <div className="space-y-3 mb-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Category
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  category === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Country
          </p>
          <div className="flex flex-wrap gap-2">
            {COUNTRIES.map((c) => (
              <button
                key={c}
                onClick={() => setCountry(c)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  country === c
                    ? "bg-sidebar text-sidebar-foreground border-sidebar"
                    : "bg-background text-muted-foreground border-border hover:border-sidebar/40"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {isError ? (
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
