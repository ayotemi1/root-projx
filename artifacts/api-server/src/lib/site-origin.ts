/** Browser return URLs must never point at an inherited workspace host in production. */
export function publicSiteOrigin(env: Record<string, string | undefined>): string {
  if (env.REPLIT_DEPLOYMENT === "1" || env.NODE_ENV === "production") {
    return "https://rootprojx.com";
  }
  return env.REPLIT_DEV_DOMAIN ? `https://${env.REPLIT_DEV_DOMAIN}` : "http://localhost:3000";
}
