import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import * as api from "@/lib/api";
import { ContentGallery } from "@/components/org-content/content-gallery";

/** Keep existing /updates links working while displaying the same general posts. */
export default function OrgUpdatesPage() {
  const { id: orgId = "" } = useParams<{ id: string }>();
  const { data: org } = useQuery({
    queryKey: ["org", orgId], queryFn: () => api.getOrganisation(orgId), enabled: !!orgId,
  });
  const posts = useQuery({
    queryKey: ["org-feed", orgId], queryFn: () => api.getOrgFeed(orgId), enabled: !!orgId,
    staleTime: 30_000, refetchOnMount: "always",
  });
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href={`/organisations/${orgId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
        <ArrowLeft size={16} />{org?.name ?? "Organisation profile"}
      </Link>
      <h1 className="text-2xl font-extrabold mb-2">{org?.name ?? "Organisation"} posts</h1>
      <p className="text-sm text-muted-foreground mb-6">Photos, videos, stories and more.</p>
      <ContentGallery items={posts.data ?? []} isLoading={posts.isLoading}
        isError={posts.isError} onRetry={() => posts.refetch()} />
    </div>
  );
}
