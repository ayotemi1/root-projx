import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import * as api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Users, MapPin, Search, CheckCircle, Check, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { SupporterPostCard, useSupporterFollow } from "@/components/supporter/SupporterPostCard";
import { getFollowStatus, listPosts, spKey } from "@/lib/supporter-publishing";

function FollowSupporterButton({ publicId }: { publicId: string }) {
  const { isAuthenticated, token, user } = useAuth();
  const [, navigate] = useLocation();
  const follow = useSupporterFollow();
  const own = user?.publicProfileSettings?.publicId === publicId;
  const canQuery = isAuthenticated && user?.accountType === "supporter" && !own;
  const q = useQuery({ queryKey: ["supporter-follow", publicId, token], queryFn: () => getFollowStatus(publicId, token!), enabled: canQuery });
  if (own || (isAuthenticated && user?.accountType !== "supporter")) return null;
  if (!isAuthenticated) {
    return <button type="button" className="rp-btn rp-btn-yellow" onClick={() => navigate("/login")} data-testid="button-follow-supporter"><Plus className="w-4 h-4" /> Follow</button>;
  }
  if (q.isLoading) return <span className="inline-block h-12 w-32 bg-sidebar-foreground/20 animate-pulse" data-testid="status-follow-loading" />;
  if (q.isError) return <button type="button" className="rp-btn rp-btn-ghost !text-sidebar-foreground !border-sidebar-foreground" onClick={() => q.refetch()} data-testid="button-follow-retry">Try again</button>;
  const following = q.data === true;
  return following ? (
    <button type="button" className="rp-btn rp-btn-ghost !text-sidebar-foreground !border-sidebar-foreground" disabled={follow.isPending}
      onClick={() => follow.mutate({ publicId, follow: false })} data-testid="button-unfollow-supporter"><Check className="w-4 h-4" /> Following</button>
  ) : (
    <button type="button" className="rp-btn rp-btn-yellow" disabled={follow.isPending}
      onClick={() => follow.mutate({ publicId, follow: true })} data-testid="button-follow-supporter"><Plus className="w-4 h-4" /> Follow</button>
  );
}

function SupporterPosts({ publicId }: { publicId: string }) {
  const { token } = useAuth();
  const q = useQuery({ queryKey: spKey({ publicId }, token), queryFn: () => listPosts({ publicId }, token) });
  const posts = (q.data ?? []).filter(p => !p.removed);
  return (
    <section className="space-y-6" aria-label="Posts" data-testid="section-supporter-posts">
      <h2 className="text-lg font-bold text-foreground">Posts</h2>
      {q.isLoading ? <div className="aspect-[4/5] max-h-[420px] bg-border animate-pulse" data-testid="status-posts-loading" />
        : q.isError ? (
          <div className="bg-card p-6 border border-border text-center" role="alert">
            <p className="text-sm">We couldn’t load these posts.</p>
            <button type="button" className="rp-btn rp-btn-yellow mt-3" onClick={() => q.refetch()} data-testid="button-retry-posts">Try again</button>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-card p-6 border border-border text-center"><p className="text-muted-foreground text-sm" data-testid="text-empty-posts">No posts yet.</p></div>
        ) : <div className="space-y-14 bg-card border border-border p-5 md:p-8">{posts.map(p => <SupporterPostCard key={p.id} post={p} />)}</div>}
    </section>
  );
}

export default function SupporterProfilePage() {
  const params = useParams();
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["public-supporter-profile", params.publicId],
    queryFn: () => api.getPublicSupporterProfile(params.publicId!),
    enabled: !!params.publicId,
    retry: false
  });
  
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 animate-pulse space-y-8">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-border" />
          <div className="space-y-3 flex-1">
            <div className="h-8 bg-border w-1/3 rounded" />
            <div className="h-4 bg-border w-1/2 rounded" />
          </div>
        </div>
        <div className="h-32 bg-border w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 bg-secondary text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-6">
          <Search className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Profile not found</h1>
        <p className="text-muted-foreground text-sm mb-8">
          This supporter profile is either private or does not exist.
        </p>
        <Link href="/discover" className="inline-flex items-center justify-center h-10 px-6 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
          Discover Organisations
        </Link>
      </div>
    );
  }

  const joinDate = profile.createdAt 
    ? new Date(profile.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-secondary/30 pb-20">
      {/* Header Banner */}
      <div className="bg-sidebar text-sidebar-foreground pt-20 pb-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,var(--color-gold)_0%,transparent_60%)]" />
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-gold text-sidebar flex items-center justify-center text-4xl md:text-5xl font-black border-4 border-sidebar-foreground shadow-xl shrink-0" data-testid="img-avatar">
              {profile.avatarInitials}
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-3" data-testid="text-display-name">
                {profile.displayName}
              </h1>
              <div className="flex items-center justify-center md:justify-start gap-4 text-sidebar-foreground/80 font-medium">
                {joinDate && (
                  <span className="flex items-center gap-1.5" data-testid="text-join-date">
                    <Heart className="w-4 h-4 text-gold" />
                    Supporter since {joinDate}
                  </span>
                )}
              </div>
            </div>
            {params.publicId && <div className="shrink-0"><FollowSupporterButton publicId={params.publicId} /></div>}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-8 relative z-20 space-y-8">
        {profile.bio && (
          <Card className="shadow-lg border-border/50">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">About Me</h2>
              <p className="text-foreground/90 text-lg leading-relaxed whitespace-pre-wrap" data-testid="text-bio">
                {profile.bio}
              </p>
            </CardContent>
          </Card>
        )}

        {params.publicId && <SupporterPosts publicId={params.publicId} />}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Supported Orgs */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Heart className="w-5 h-5 text-primary" />
              Supported Organisations
            </h2>
            {profile.supportedOrganisations.length > 0 ? (
              <div className="flex flex-col gap-3">
                {profile.supportedOrganisations.map(org => (
                  <Link key={org.orgId} href={`/organisations/${org.orgId}`}>
                    <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group hover-elevate">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                          {org.orgName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors" data-testid={`text-supported-org-${org.orgId}`}>
                            {org.orgName}
                          </p>
                          <p className="text-xs text-muted-foreground">On Supporter Wall</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-xl p-6 border border-border text-center">
                <p className="text-muted-foreground text-sm" data-testid="text-empty-supported">
                  Not on any supporter walls yet.
                </p>
              </div>
            )}
          </div>

          {/* Followed Orgs */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Users className="w-5 h-5 text-sidebar" />
              Followed Causes
            </h2>
            {profile.followedOrganisations.length > 0 ? (
              <div className="flex flex-col gap-3">
                {profile.followedOrganisations.map(org => (
                  <Link key={org._id} href={`/organisations/${org._id}`}>
                    <Card className="hover:border-sidebar/50 hover:shadow-md transition-all cursor-pointer group hover-elevate h-full">
                      <CardContent className="p-4 flex flex-col justify-center min-h-[5rem]">
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-semibold text-foreground leading-tight group-hover:text-sidebar transition-colors" data-testid={`text-followed-org-${org._id}`}>
                            {org.name}
                            {org.verified && <span className="text-green-600 ml-1.5 inline-block align-middle" title="Verified"><CheckCircle className="w-3.5 h-3.5" /></span>}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs font-medium bg-secondary text-secondary-foreground border-transparent">
                            <MapPin className="w-3 h-3 mr-1" />
                            {org.country}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-muted-foreground font-medium">
                            {org.category}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-xl p-6 border border-border text-center">
                <p className="text-muted-foreground text-sm" data-testid="text-empty-followed">
                  Not following any organisations yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
