export function pinnedPostKeys(user: Record<string, any>): string[] {
  return Array.isArray(user.profileShowcase?.pinnedPosts) ? user.profileShowcase.pinnedPosts.filter(
    (s: unknown) => typeof s === "string" && /^(post|update):[A-Za-z0-9_-]{1,180}$/.test(s)) : [];
}
