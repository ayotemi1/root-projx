import { fsGet, fsQuery } from "./firebase-rest.js";
import { canSeePost, postDto, POSTS, FOLLOWERS } from "./supporter-posts.js";
import { campaignPresentation } from "./campaign-presentation.js";

type Doc = Record<string, any>;
export const ACTIVITY_TYPES = ["Volunteered", "Visited", "Went to an event", "Fundraised", "Gave", "Other"] as const;
export const text = (value: unknown) => typeof value === "string" ? value : "";
export const entries = (showcase: Doc) => Array.isArray(showcase.entries) ? showcase.entries as Doc[] : [];

/** Strict projection: private account data, unshared gifts and private interests
 * never enter the public profile. Being the owner does not privilege Preview. */
export async function supporterShowcase(user: Doc, uid: string, token: string, owner: boolean) {
  const details = user.profileShowcase ?? {};
  const publicProfile = user.publicProfile ?? {};
  const availableInterests: string[] = Array.isArray(user.interests) ? user.interests.filter((i: unknown) => typeof i === "string") : [];
  const visibleInterests = Array.isArray(details.visibleInterests)
    ? details.visibleInterests.filter((i: unknown) => typeof i === "string" && availableInterests.includes(i)) as string[] : [];
  const [rows, people, organisationsFollowed] = await Promise.all([
    fsQuery(POSTS, [{ field: "author_id", op: "EQUAL", value: uid }], token),
    fsQuery(FOLLOWERS, [{ field: "follower_id", op: "EQUAL", value: uid }], token),
    fsQuery("follows", [{ field: "userId", op: "EQUAL", value: uid }], token),
  ]);
  const viewer = owner ? uid : null;
  const visibleRows = rows.filter(p => canSeePost(p, user, viewer))
    .sort((a, b) => text(b.created_at).localeCompare(text(a.created_at)));
  const posts = await Promise.all(visibleRows.map(p => postDto(p, viewer, token, user)));
  const orgCache = new Map<string, Promise<Doc | null>>();
  const org = (id: string) => {
    if (!orgCache.has(id)) orgCache.set(id, fsGet("organisations", id, token));
    return orgCache.get(id)!;
  };
  const manual = await Promise.all(entries(details).filter(e => owner || e.shared === true).map(async e => {
    const linked = e.organisationId ? await org(e.organisationId) : null;
    const giftCampaign = e.activity === "Gave" && Array.isArray(linked?.campaigns)
      ? linked.campaigns.find((c: Doc) => c._id === e.campaignId || e.details === `Supporter · ${c.name}`) : null;
    return {
      ...(giftCampaign ? { donationPresentation: campaignPresentation(giftCampaign) } : {}),
      id: e.id, source: "manual" as const,
      organisationId: linked ? e.organisationId : null,
      projectName: linked ? text(linked.name) : text(e.projectName),
      logo: linked ? text(linked.logo) || null : null,
      sector: linked ? text(linked.category) || null : null,
      location: linked ? [linked.city, linked.country].filter(Boolean).join(", ") || null : null,
      activity: text(e.activity), details: text(e.details), when: text(e.when),
      shared: e.shared === true, href: null,
    };
  }));
  const linkedPosts = await Promise.all(visibleRows.filter(p => p.organisation_id).map(async p => {
    const tag = p.tag as Doc | undefined;
    const linked = await org(text(p.organisation_id));
    // A removed organisation must not expose private drafts via a profile.
    if (!linked) return null;
    const donationCampaign = p.donation_post === true && Array.isArray(linked.campaigns)
      ? linked.campaigns.find((c: Doc) => c._id === p.campaign_id) : null;
    return {
      ...(p.donation_post === true ? { donationPresentation: campaignPresentation(donationCampaign) } : {}),
      id: `post_${p.id}`, source: "post" as const, organisationId: p.organisation_id,
      projectName: text(linked.name), logo: text(linked.logo) || null,
      sector: text(linked.category) || null,
      location: [linked.city, linked.country].filter(Boolean).join(", ") || null,
      activity: p.type === "text" && tag?.type === "community" &&
        ({ volunteers: "Volunteered", visitors: "Visited", fundraisers: "Fundraised" } as Record<string, string>)[tag.value]
        || ((ACTIVITY_TYPES as readonly unknown[]).includes(p.activity_type) ? String(p.activity_type) : "Posted"),
      // A donation post can opt into an amount in its caption, but Involvement
      // is always an amount-free record, never a copy of the post text.
      details: p.donation_post === true ? `Supporter · ${text(donationCampaign?.name) || "Campaign"}` : text(p.caption),
      when: text(p.created_at),
      shared: !owner || publicProfile.enabled === true, href: `#post-${p.id}`,
    };
  }));
  const involvement = [...linkedPosts.filter((p): p is NonNullable<typeof p> => p !== null), ...manual];
  const organisationCount = new Set(involvement.map(i => i.organisationId
    ? `org:${i.organisationId}` : `outside:${i.projectName.trim().toLowerCase()}`)).size;
  const displayName = text(publicProfile.displayName) || text(user.name) || "Supporter";
  return {
    displayName, bio: text(publicProfile.bio),
    avatarInitials: displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase(),
    avatarUrl: typeof user.avatarUrl === "string" && /^(https?:\/\/|\/api\/)/.test(user.avatarUrl) ? user.avatarUrl : null,
    // No persisted expiring supporter-story source exists yet. Ordinary posts
    // and following an organisation must never manufacture a story ring.
    storyExpiresAt: null,
    location: text(details.location), visibleInterests,
    availableInterests: owner ? availableInterests : [], createdAt: text(user.createdAt) || null,
    publicId: text(publicProfile.publicId) || null,
    isPublic: publicProfile.enabled === true, isOwner: owner,
    counts: { posts: posts.length, following: new Set([
      ...people.map(p => `supporter:${text(p.author_id)}`),
      ...organisationsFollowed.map(o => `organisation:${text(o.orgId)}`),
    ]).size, organisations: organisationCount },
    posts, involvement,
    sources: { saved: true, reposts: false, sharedGifts: false },
  };
}
