export const API_BASE = "/api";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  accountType: "supporter" | "organisation";
  avatarInitials: string;
  createdAt: string | null;
  publicProfileSettings?: PublicProfileSettings;
}

export interface PublicProfileSettings {
  enabled: boolean;
  displayName: string;
  bio: string;
  publicId: string | null;
}

export type PublicProfileUpdate = Omit<PublicProfileSettings, "publicId">;

export interface PublicOrganisationSummary {
  _id: string;
  name: string;
  country: string;
  category: string;
  verified: boolean;
}

export interface PublicSupporterProfile {
  displayName: string;
  bio: string;
  avatarInitials: string;
  createdAt: string | null;
  followedOrganisations: PublicOrganisationSummary[];
  supportedOrganisations: Array<{ orgId: string; orgName: string }>;
}

export interface FundsUsage {
  operations: number;
  materials: number;
  staff: number;
  events: number;
  other: number;
}

export interface Org {
  _id: string;
  name: string;
  country: string;
  city: string | null;
  category: string;
  description: string;
  mission: string | null;
  verified: boolean;
  followerCount: number;
  totalRaised: number;
  impactScore: number;
  coverImage: string | null;
  logo: string | null;
  contact: { email?: string; phone?: string; website?: string } | null;
  socialLinks: Record<string, string> | null;
  createdAt: string;
  lastPostAt: string | null;
  fundsUsage: FundsUsage | null;
}

export interface WiseStatus {
  wise_email: string | null;
  wise_recipient_id: number | null;
  wise_verified: boolean;
}

export interface FeedUpdate {
  _id: string;
  orgId: string;
  orgName: string;
  type: "update" | "milestone" | "campaign";
  title: string;
  content: string;
  mediaUrls: string[];
  imageUrl: string | null;
  likes: number;
  createdAt: string;
}

export interface Review {
  _id: string;
  orgId: string;
  authorName: string;
  rating: number;
  content: string;
  verified: boolean;
  createdAt: string;
}

export interface Resource {
  _id: string;
  title: string;
  category: string;
  country: string;
  description: string;
  contact: { phone?: string; email?: string; website?: string };
  tags: string[];
  createdAt: string;
}

export interface Donation {
  _id: string;
  userId: string;
  orgId: string;
  orgName: string;
  amountGbp: number;
  currency: string;
  type: "one_time" | "recurring";
  note: string;
  status: string;
  createdAt: string;
}

// ── Core fetch helper ─────────────────────────────────────────────────────────

async function req<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const register = (data: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  accountType: string;
  orgName?: string;
  country?: string;
  registrationNumber?: string;
}) =>
  req<{ token: string; user: ApiUser }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const login = (email: string, password: string) =>
  req<{ token: string; user: ApiUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const logout = (token: string) =>
  req<{ message: string }>("/auth/logout", { method: "POST" }, token);

export const getMe = (token: string) => req<ApiUser>("/auth/me", {}, token);

// ── Organisations ─────────────────────────────────────────────────────────────

export const getOrganisations = (params?: { category?: string; country?: string }) => {
  const qs = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => !!v)
        .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
        .join("&")
    : "";
  return req<Org[]>(`/organisations${qs}`);
};

export const getOrganisation = (id: string, token?: string | null) =>
  req<Org>(`/organisations/${id}`, {}, token);

export const getOrg = getOrganisation;

export interface CreateOrgProfileInput {
  name: string;
  country: string;
  city?: string;
  category: string;
  description: string;
  mission?: string;
  whoYouServe?: string;
  yearsOperating?: string;
  registrationNumber?: string;
  contact?: { email?: string; phone?: string; website?: string };
  socialLinks?: Record<string, string>;
}

export const createOrgProfile = (data: CreateOrgProfileInput, token: string) =>
  req<Org>("/organisations", { method: "POST", body: JSON.stringify(data) }, token);

export const updateOrganisation = (id: string, data: Partial<Org>, token: string) =>
  req<Org>(`/organisations/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token);

// ── Feed ──────────────────────────────────────────────────────────────────────

export const getPublicFeed = () => req<FeedUpdate[]>("/feed/public");
export const getMyFeed = (token: string) => req<FeedUpdate[]>("/feed", {}, token);
export const getOrgFeed = (orgId: string) => req<FeedUpdate[]>(`/feed/org/${orgId}`);
export const postUpdate = (
  data: { title: string; content: string; type: string; mediaUrls?: string[] },
  token: string,
) =>
  req<FeedUpdate>("/feed", { method: "POST", body: JSON.stringify(data) }, token);

// ── Media uploads ─────────────────────────────────────────────────────────────

/** Upload media files for a feed update. Returns download URLs. */
export async function uploadMedia(files: File[], token: string): Promise<string[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  const response = await fetch(`${API_BASE}/uploads/media?type=media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Upload failed" })) as { error?: string };
    throw new Error(err.error ?? "Upload failed");
  }

  const result = await response.json() as { urls: string[] };
  return result.urls;
}

/**
 * Upload a logo or cover photo — single call that writes to storage AND
 * updates the org document. Returns the updated org.
 */
export async function uploadOrgProfileImage(
  file: File,
  orgId: string,
  type: "logo" | "cover",
  token: string,
): Promise<Org> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/organisations/${orgId}/images?type=${type}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Upload failed" })) as { error?: string };
    throw new Error(err.error ?? "Upload failed");
  }

  return response.json() as Promise<Org>;
}

// ── Follows ───────────────────────────────────────────────────────────────────

export const followOrg = (orgId: string, token: string) =>
  req<{ _id: string; userId: string; orgId: string }>(
    "/follows",
    { method: "POST", body: JSON.stringify({ orgId }) },
    token,
  );

export const unfollowOrg = (orgId: string, token: string) =>
  req<{ message: string }>(`/follows/${orgId}`, { method: "DELETE" }, token);

export const getMyFollows = (token: string) => req<Org[]>("/follows/my", {}, token);

// ── Help ──────────────────────────────────────────────────────────────────────

export const getResources = (params?: { category?: string; country?: string }) => {
  const qs = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => !!v)
        .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
        .join("&")
    : "";
  return req<Resource[]>(`/help/orgs${qs}`);
};

export const getOrgReviews = (orgId: string) => req<Review[]>(`/help/reviews/${orgId}`);

export interface CampaignPhase {
  id: string;
  title: string;
  description: string;
  targetAmount: number | null;
  completed: boolean;
}

export interface CampaignTheme {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
}

export interface Campaign {
  _id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  amountRaised: number;
  goal: number;
  status: "active" | "completed" | "deleted";
  type: "fundraising" | "volunteer";
  volunteersNeeded: number;
  deadline: string | null;
  phases: CampaignPhase[];
  createdAt: string;
  updatedAt: string;
  enabled?: boolean;
  publicId?: string;
  theme?: CampaignTheme;
}

export interface PublicCampaignLanding {
  campaign: Campaign;
  organisation: {
    _id: string;
    name: string;
    country: string;
    city: string | null;
    category: string;
    description: string;
    logo: string | null;
    coverImage: string | null;
    verified: boolean;
  };
}

export const getPublicCampaignLanding = (publicId: string) =>
  req<PublicCampaignLanding>(`/campaigns/landing/${encodeURIComponent(publicId)}`);

export type CreateCampaignData = {
  name: string;
  description: string;
  type: "fundraising" | "volunteer";
  goal: number;
  volunteersNeeded: number;
  deadline: string | null;
  imageUrl: string | null;
  phases: Omit<CampaignPhase, "id">[];
};

export const getCampaigns = (orgId: string) =>
  req<Campaign[]>(`/organisations/${orgId}/campaigns`).then((cs) =>
    cs.filter((c) => c.status !== "deleted"),
  );

export const getManagedCampaigns = (orgId: string, token: string) =>
  req<Campaign[]>(`/organisations/${orgId}/campaigns/manage`, {}, token).then((cs) =>
    cs.filter((c) => c.status !== "deleted"),
  );

export const createCampaign = (orgId: string, data: CreateCampaignData, token: string) =>
  req<Campaign>(`/organisations/${orgId}/campaigns`, { method: "POST", body: JSON.stringify(data) }, token);

export const updateCampaign = (
  orgId: string,
  campId: string,
  data: Partial<Campaign>,
  token: string,
) =>
  req<Campaign>(
    `/organisations/${orgId}/campaigns/${campId}`,
    { method: "PATCH", body: JSON.stringify(data) },
    token,
  );

export const deleteCampaign = (orgId: string, campId: string, token: string) =>
  req<{ ok: boolean }>(
    `/organisations/${orgId}/campaigns/${campId}`,
    { method: "DELETE" },
    token,
  );

export function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...rest } = options;
  return req<T>(path, rest, token);
}

export const postReview = (
  data: { orgId: string; rating: number; content: string },
  token: string,
) =>
  req<Review>("/help/reviews", { method: "POST", body: JSON.stringify(data) }, token);

// ── Profile ───────────────────────────────────────────────────────────────────

export const getProfile = (token: string) => req<ApiUser>("/profile", {}, token);

export const updateProfile = (
  data: { name?: string; phone?: string },
  token: string,
) =>
  req<ApiUser>("/profile", { method: "PATCH", body: JSON.stringify(data) }, token);

export const updatePublicProfile = (
  data: PublicProfileUpdate,
  token: string,
) =>
  req<PublicProfileSettings>(
    "/profile/public",
    { method: "PATCH", body: JSON.stringify(data) },
    token,
  );

export const getPublicSupporterProfile = (publicId: string) =>
  req<PublicSupporterProfile>(`/supporters/${encodeURIComponent(publicId)}`);

// ── Donations ─────────────────────────────────────────────────────────────────

export const getStripePublishableKey = () =>
  req<{ publishableKey: string }>("/donations/publishable-key");

export const createPaymentIntent = (
  data: { orgId: string; amountGbp: number; note?: string },
  token: string,
) =>
  req<{ clientSecret: string; paymentIntentId: string; amountGbp: number; feePence: number }>(
    "/donations/payment-intent",
    { method: "POST", body: JSON.stringify(data) },
    token,
  );

export const createSubscription = (
  data: { orgId: string; amountGbp: number; note?: string },
  token: string,
) =>
  req<{ subscriptionId: string; clientSecret: string; amountGbp: number; feePence: number }>(
    "/donations/subscription",
    { method: "POST", body: JSON.stringify(data) },
    token,
  );

export const getMyDonations = (token: string) => req<Donation[]>("/donations/my", {}, token);

export const createPortalSession = (token: string) =>
  req<{ url: string }>("/donations/portal", { method: "POST" }, token);

export const createDonationCheckout = (
  data: {
    orgId: string;
    amountPence: number;
    guestEmail?: string;
    feeCovered?: boolean;
    originalAmountPence?: number;
    feeAmountPence?: number;
    wallOptIn?: boolean;
  },
  token?: string,
) =>
  req<{ url: string; sessionId: string }>(
    "/donations/checkout",
    { method: "POST", body: JSON.stringify(data) },
    token,
  );

export const confirmDonation = (sessionId: string) =>
  req<{
    orgId: string;
    orgName: string;
    amountGbp: number;
    feePence: number;
    donorEmail: string | null;
  }>(`/donations/confirm?session_id=${encodeURIComponent(sessionId)}`);

// ── Supporter Wall ─────────────────────────────────────────────────────────────

export interface SupporterEntry {
  displayName: string;
}

export interface SupportersResponse {
  supporters: SupporterEntry[];
  totalCount: number;
}

export interface MySupporterEntry {
  orgId: string;
  orgName: string;
  optedIn: boolean;
  displayName: string;
}

export const getOrgSupporters = (orgId: string) =>
  req<SupportersResponse>(`/organisations/${orgId}/supporters`);

export const getMySupporter = (orgId: string, token: string) =>
  req<{ optedIn: boolean; displayName: string | null }>(
    `/organisations/${orgId}/supporters/me`,
    {},
    token,
  );

export const updateMySupporter = (
  orgId: string,
  data: { optedIn: boolean },
  token: string,
) =>
  req<{ optedIn: boolean; displayName: string }>(
    `/organisations/${orgId}/supporters/me`,
    { method: "PATCH", body: JSON.stringify(data) },
    token,
  );

export const getMySupporterEntries = (token: string) =>
  req<MySupporterEntry[]>("/supporters/my", {}, token);

// ── Stripe Connect ─────────────────────────────────────────────────────────────

export const getConnectStatus = (token: string) =>
  req<{ stripe_account_id: string | null; payouts_enabled: boolean; charges_enabled: boolean }>(
    "/stripe/connect/status",
    {},
    token,
  );

export const getConnectDashboardLink = (token: string) =>
  req<{ url: string }>("/stripe/connect/dashboard-link", {}, token);

// ── Wise Connect ───────────────────────────────────────────────────────────────

export const getWiseStatus = (token: string) =>
  req<WiseStatus>("/wise/connect/status", {}, token);

export const connectWise = (email: string, token: string) =>
  req<WiseStatus>("/wise/connect", {
    method: "PUT",
    body: JSON.stringify({ email }),
  }, token);

export const disconnectWise = (token: string) =>
  req<{ disconnected: boolean }>("/wise/connect", { method: "DELETE" }, token);

// ── Newsletter ─────────────────────────────────────────────────────────────────

export const subscribeNewsletter = (data: { email: string; name?: string }) =>
  req<{ message: string }>("/newsletter/subscribe", {
    method: "POST",
    body: JSON.stringify(data),
  });

// ── Shop ───────────────────────────────────────────────────────────────────────

export interface ShopProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
}

export const getShopProducts = () =>
  req<{ products: ShopProduct[] }>("/shop/products");

export const createShopCheckout = (items: Array<{ id: string; quantity: number }>) =>
  req<{ url: string }>("/shop/checkout", {
    method: "POST",
    body: JSON.stringify({ items }),
  });

// ── Volunteer roles ────────────────────────────────────────────────────────────

export interface VolunteerRole {
  _id: string;
  title: string;
  description: string;
  commitment: string;
  location: string;
  skills: string[];
  iconType?: string;
}

export const getOrgVolunteerRoles = (orgId: string) =>
  req<VolunteerRole[]>(`/organisations/${orgId}/volunteerRoles`);

// ── Org analytics ─────────────────────────────────────────────────────────────

export interface OrgAnalytics {
  profileViews?: number;
  profileViewsTrend?: number;
  engagement?: number;
  engagementTrend?: number;
  donations?: number;
  donationsTrend?: number;
}

export const getOrgAnalytics = (orgId: string, token: string) =>
  req<OrgAnalytics>(`/organisations/${orgId}/analytics`, {}, token);

// ── Org notifications ─────────────────────────────────────────────────────────

export interface OrgNotification {
  _id: string;
  type: "follower" | "donation" | "volunteer" | "system";
  message: string;
  read: boolean;
  createdAt: string;
}

export const getOrgNotifications = (orgId: string, token: string) =>
  req<OrgNotification[]>(`/organisations/${orgId}/notifications`, {}, token);

export const markOrgNotificationsRead = (orgId: string, token: string) =>
  req<{ updated: number }>(`/organisations/${orgId}/notifications/read-all`, { method: "PATCH" }, token);
