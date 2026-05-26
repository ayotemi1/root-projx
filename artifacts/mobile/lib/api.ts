const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
export const BASE_URL = DOMAIN ? `https://${DOMAIN}/api` : "/api";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  accountType: "supporter" | "organisation";
  avatarInitials: string;
  createdAt: string | null;
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
  contact: { email?: string; phone?: string; website?: string } | null;
  socialLinks: Record<string, string> | null;
  createdAt: string;
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
  orgName?: string;
  authorName: string;
  authorId?: string;
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

// ── Core fetch helper ────────────────────────────────────────────────────────

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
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      // ignore parse error
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

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

export const createOrgProfile = (
  token: string,
  data: {
    name: string;
    country: string;
    category: string;
    description: string;
    city?: string;
    mission?: string;
  },
) =>
  req<{ _id: string }>("/organisations", {
    method: "POST",
    body: JSON.stringify(data),
  }, token);

export const login = (email: string, password: string) =>
  req<{ token: string; user: ApiUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const logout = (token: string) =>
  req<{ message: string }>("/auth/logout", { method: "POST" }, token);

export const getMe = (token: string) => req<ApiUser>("/auth/me", {}, token);

// ── Organisations ─────────────────────────────────────────────────────────────

export const getOrganisations = (params?: {
  category?: string;
  country?: string;
}) => {
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

export const createOrganisation = (data: Partial<Org>, token: string) =>
  req<Org>("/organisations", { method: "POST", body: JSON.stringify(data) }, token);

export const updateOrganisation = (
  id: string,
  data: Partial<Org>,
  token: string,
) =>
  req<Org>(
    `/organisations/${id}`,
    { method: "PATCH", body: JSON.stringify(data) },
    token,
  );

// ── Feed ──────────────────────────────────────────────────────────────────────

export const getPublicFeed = () => req<FeedUpdate[]>("/feed/public");
export const getMyFeed = (token: string) => req<FeedUpdate[]>("/feed", {}, token);
export const getOrgFeed = (orgId: string) =>
  req<FeedUpdate[]>(`/feed/org/${orgId}`);
export const postUpdate = (
  data: { title: string; content: string; type: string; mediaUrls?: string[] },
  token: string,
) =>
  req<FeedUpdate>("/feed", { method: "POST", body: JSON.stringify(data) }, token);

// ── Media uploads ─────────────────────────────────────────────────────────────

/**
 * Upload media files to Firebase Storage via the API proxy.
 * `files` is an array of { uri, name, mimeType } objects (from expo-image-picker).
 */
export async function uploadMedia(
  files: Array<{ uri: string; name: string; mimeType: string }>,
  token: string,
): Promise<string[]> {
  const formData = new FormData();
  files.forEach((f) => {
    formData.append("files", {
      uri: f.uri,
      name: f.name,
      type: f.mimeType,
    } as unknown as Blob);
  });

  const response = await fetch(`${BASE_URL}/uploads/media`, {
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

// ── Follows ───────────────────────────────────────────────────────────────────

export const followOrg = (orgId: string, token: string) =>
  req<{ _id: string; userId: string; orgId: string }>(
    "/follows",
    { method: "POST", body: JSON.stringify({ orgId }) },
    token,
  );

export const unfollowOrg = (orgId: string, token: string) =>
  req<{ message: string }>(
    `/follows/${orgId}`,
    { method: "DELETE" },
    token,
  );

export const getMyFollows = (token: string) =>
  req<Org[]>("/follows/my", {}, token);

// ── Help ──────────────────────────────────────────────────────────────────────

export const getResources = (params?: {
  category?: string;
  country?: string;
}) => {
  const qs = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => !!v)
        .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
        .join("&")
    : "";
  return req<Resource[]>(`/help/orgs${qs}`);
};

export const getOrgReviews = (orgId: string) =>
  req<Review[]>(`/help/reviews/${orgId}`);

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
  req<ApiUser>(
    "/profile",
    { method: "PATCH", body: JSON.stringify(data) },
    token,
  );

// ── Donations ─────────────────────────────────────────────────────────────────

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

export const getMyDonations = (token: string) =>
  req<Donation[]>("/donations/my", {}, token);

export const createPortalSession = (token: string) =>
  req<{ url: string }>("/donations/portal", { method: "POST" }, token);

// ── Shop ──────────────────────────────────────────────────────────────────────

export interface ShopProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  sizes: string[];
  emoji: string;
  image: string | null;
}

export const getShopProducts = () =>
  req<{ products: ShopProduct[] }>("/shop/products");

export const createGuestPaymentIntent = (data: {
  orgId: string;
  amountGbp: number;
  guestEmail: string;
  note?: string;
}) =>
  req<{ clientSecret: string; amountGbp: number; feePence: number }>(
    "/donations/guest-payment-intent",
    { method: "POST", body: JSON.stringify(data) },
  );

export const createShopPaymentIntent = (
  items: Array<{ id: string; qty: number; size?: string }>,
) =>
  req<{ clientSecret: string; amountGbp: number }>("/shop/payment-intent", {
    method: "POST",
    body: JSON.stringify({ items }),
  });

// ── Newsletter ─────────────────────────────────────────────────────────────────

export const subscribeNewsletter = (data: { email: string; name?: string }) =>
  req<{ message: string }>("/newsletter/subscribe", {
    method: "POST",
    body: JSON.stringify(data),
  });
