import { uploadVideo } from "./video-upload";
import { appFetch, userErrorMessage, responseError } from "./error-feedback";
export const API_BASE = "/api";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  accountType: "supporter" | "organisation";
  approvalStatus?: "pending" | "approved" | "declined" | null;
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
  payoutMethod: "stripe_connect" | "wise" | "manual" | "none";
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
  /** One-line card description (max 120). Falls back to description when absent. */
  shortDescription?: string | null;
  /** Multi-select sectors; `category` stays the primary (first) sector. */
  categories?: string[] | null;
  impactMetrics?: ImpactMetrics | null;
  team?: TeamMember[] | null;
}

export interface ImpactMetric {
  label: string;
  value: number;
  /** Server-owned timestamp. */
  updatedAt: string;
}

export type ImpactMetricKey = "peopleReached" | "groundCovered" | "resourcesDelivered";

export type ImpactMetrics = Partial<Record<ImpactMetricKey, ImpactMetric>>;

export interface TeamMember {
  name: string;
  role: string;
  photoUrl: string | null;
}

/** Shape accepted by PATCH for impact metrics: server stamps updatedAt. */
export type ImpactMetricsInput = Partial<Record<ImpactMetricKey, { label: string; value: number }>>;

export type OrgProfilePatch = Partial<Omit<Org, "impactMetrics">> & {
  impactMetrics?: ImpactMetricsInput | null;
};

export interface WiseStatus {
  wise_email: string | null;
  wise_recipient_id: number | null;
  wise_verified: boolean;
  lastDisbursementAt?: string | null;
  lastDisbursementAmountGbp?: number | null;
  lastDisbursementTransferId?: number | null;
}

export interface FeedUpdate {
  status?: "published" | "archived" | "deleted";
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
  /** Optional HTTPS Instagram / YouTube / Vimeo link. */
  externalUrl?: string | null;
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
  howToAccess?: string;
  city?: string;
}

export interface Donation {
  receiptAccounting?: import("../../../api-server/src/lib/donation-accounting").DonationAccounting;
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

export interface RecurringDonation {
  _id: string;
  userId: string;
  orgId: string;
  orgName: string;
  stripeSubscriptionId: string;
  amountGbp: number;
  status: "active" | "paused" | "past_due" | "canceled";
  startedAt: string;
  lastPaidAt: string;
  canceledAt: string | null;
}

/** Error carrying HTTP status and parsed JSON body. Subclass of Error, so existing catches still work. */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
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
  const res = await appFetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    let body: unknown = null;
    try {
      body = await res.json();
      const b = body as { error?: string };
      if (b && b.error) msg = b.error;
    } catch { /* ignore */ }
    throw new ApiError(userErrorMessage({ message: msg, status: res.status },
      /donations|checkout/.test(path) ? "start checkout" : /payout/.test(path) ? "confirm this payout action" : "complete this request"), res.status, body);
  }
  return res.json().catch(() => { throw new Error("The service returned an unreadable response, so we couldn’t confirm the result. Keep your work, check the saved status before retrying, and contact Root ProjX if it continues."); }) as Promise<T>;
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
  return req<Org[]>(`/organisations${qs}`, { cache: "no-store" });
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

export const updateOrganisation = (id: string, data: Partial<Org> | OrgProfilePatch, token: string) =>
  req<Org>(`/organisations/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token);

// ── Feed ──────────────────────────────────────────────────────────────────────

export const getPublicFeed = () => req<FeedUpdate[]>("/feed/public");
export const getMyFeed = (token: string) => req<FeedUpdate[]>("/feed", {}, token);
export const getOrgFeed = (orgId: string) => req<FeedUpdate[]>(`/feed/org/${orgId}`);
export const getManagedPosts = (token: string) => req<FeedUpdate[]>("/feed/managed", {}, token);
export const setPostStatus = (postId: string, status: "published" | "archived" | "deleted", token: string) =>
  req<FeedUpdate>(`/feed/${encodeURIComponent(postId)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token);
export const postUpdate = (
  data: { title: string; content: string; type: string; mediaUrls?: string[]; externalUrl?: string },
  token: string,
) =>
  req<FeedUpdate>("/feed", { method: "POST", body: JSON.stringify(data) }, token);

// ── Media uploads ─────────────────────────────────────────────────────────────

/** Upload media files for a feed update. Returns download URLs. */
export async function uploadMedia(files: File[], token: string): Promise<string[]> {
  return uploadMediaWithProgress(files, token);
}

/**
 * Upload files to POST /uploads/media?type=media (field `files`) with real
 * upload progress via XMLHttpRequest. Resolves with the returned URLs.
 */
export async function uploadMediaWithProgress(
  files: Array<File | Blob>,
  token: string,
  onProgress?: (fraction: number) => void,
): Promise<string[]> {
  if (!files.some(file => file.type.startsWith("video/"))) {
    return uploadMultipartWithProgress(files, token, onProgress);
  }
  const urls: string[] = [];
  for (const [i, file] of files.entries()) {
    const progress = (fraction: number) => onProgress?.((i + fraction) / files.length);
    if (file.type.startsWith("video/")) urls.push(await uploadVideo(file, token, API_BASE, progress));
    else urls.push(...await uploadMultipartWithProgress([file], token, progress));
  }
  return urls;
}

function uploadMultipartWithProgress(
  files: Array<File | Blob>,
  token: string,
  onProgress?: (fraction: number) => void,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    files.forEach((f, i) => {
      const name = f instanceof File ? f.name : `image-${i}.jpg`;
      formData.append("files", f, name);
    });
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/uploads/media?type=media`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: { urls?: string[]; error?: string } = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && Array.isArray(body.urls) && body.urls.length > 0) {
        onProgress?.(1);
        resolve(body.urls);
      } else {
        reject(Object.assign(new Error(userErrorMessage({ message: body.error ?? (xhr.status === 413
          ? "File is too large. Images must be under 20 MB; videos can be up to 500 MB."
          : `Upload failed (${xhr.status})`), status: xhr.status }, "upload this file")), { status: xhr.status }));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Try again on a stronger connection."));
    xhr.send(formData);
  });
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

  const response = await appFetch(`${API_BASE}/organisations/${orgId}/images?type=${type}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    throw await responseError(response, `upload your ${type} image`);
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

export interface CampaignUnit {
  singular: string;
  plural: string;
  imageUrl: string | null;
}

export interface CampaignTheme {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  unit?: CampaignUnit | null;
}

export interface PartnerFunding {
  amount: number;
  funderName: string;
  /** committed = money already pledged to the programme; matching = funder matches donors' gifts. */
  type: "committed" | "matching";
  /** Matching only: funder £ per donor £1. Default 1. */
  matchRatio?: number;
  /** Matching only: most the funder will match. Default amount. */
  matchCap?: number;
}

export interface CampaignBreakdownItem {
  label: string;
  detail: string;
}

export interface CampaignLocation {
  name: string;
  description: string;
  photoUrl: string | null;
}

export interface CampaignVideo {
  url: string;
  posterUrl: string | null;
  captionsUrl: string | null;
  caption?: string;
}

export type CampaignEditorStep = 1 | 2 | 3 | 4 | 5;

export interface CampaignGate {
  id: string;
  message: string;
  /** 0 = outside the campaign editor (profile or payouts). */
  step: number;
}

/** Optional editorial copy for a campaign page. Every key is optional; absent keys keep defaults. */
export interface CampaignPageContent {
  storyHeading?: string;
  programmeHeading?: string;
  programmeIntro?: string;
  programmeSummary?: string;
  programmeAfterword?: string;
  outcomesIntro?: string;
  outcomesNote?: string;
  outcomesStatus?: string;
  supportHeading?: string;
  supportBody?: string;
  cohortHeading?: string;
  cohortBody?: string;
  cohortNote?: string;
  fundingNote?: string;
  organisationNote?: string;
  supportersHeading?: string;
  shareHeading?: string;
  shareBody?: string;
  donateLabel?: string;
  [key: string]: string | undefined;
}

export interface DrumUpdate {
  id: string;
  date: string;
  text: string;
  photoUrl: string | null;
  caption: string;
}

/** Drum Life build display. Only valid for USD fundraising campaigns. */
export interface DrumExperience {
  enabled: boolean;
  updates: DrumUpdate[];
}

export interface Campaign {
  drumExperience?: DrumExperience | null;
  currency?: "gbp" | "usd";
  currencyLockedAt?: string | null;
  videos?: CampaignVideo[];
  pageContent?: CampaignPageContent | null;
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
  organisationSlug?: string | null;
  campaignSlug?: string | null;
  sharePath?: string | null;
  theme?: CampaignTheme;
  // Part 3 structured content (additive, optional for legacy campaigns)
  tagline?: string | null;
  partnerFunding?: PartnerFunding | null;
  breakdown?: CampaignBreakdownItem[] | null;
  locations?: CampaignLocation[] | null;
  video?: CampaignVideo | null;
  editorStep?: CampaignEditorStep | null;
  hasUnpublishedChanges?: boolean;
  assistUsed?: boolean;
  publishedAt?: string | null;
  /** Part 4: unique donors (server-derived). */
  supporterCount?: number;
  recentSupporters?: PublicSupporter[];
  /** Public consent-filtered names, newest first, for individually drawn icons. */
  supporterUnits?: PublicSupporter[];
  /** Legacy gifts with no identity: shown separately, never counted as people. */
  unidentifiedGifts?: number;
  /** Server-owned: matching funds actually allocated so far. */
  partnerFundingMatchedGbp?: number;
  /** Explicit yes/no answer to "is there a funding partner?" — null until the org answers. */
  partnerFundingAnswer?: "yes" | "no" | null;
  /** True only after the org actively picked a preset or custom unit. */
  unitChosen?: boolean;
}

export interface PublicSupporter {
  displayName: string;
  createdAt: string;
}

/** Editable fields accepted by PATCH, plus editor flags. Never includes amountRaised. */
export interface CampaignEditorPatch {
  drumExperience?: DrumExperience | null;
  currency?: "gbp" | "usd";
  videos?: CampaignVideo[];
  name?: string;
  tagline?: string;
  type?: "fundraising" | "volunteer";
  goal?: number;
  volunteersNeeded?: number;
  partnerFunding?: PartnerFunding | null;
  deadline?: string | null;
  description?: string;
  breakdown?: CampaignBreakdownItem[];
  locations?: CampaignLocation[];
  imageUrl?: string | null;
  video?: CampaignVideo | null;
  theme?: CampaignTheme;
  assistUsed?: boolean;
  saveAsDraft?: true;
  editorStep?: CampaignEditorStep;
  partnerFundingAnswer?: "yes" | "no" | null;
  unitChosen?: boolean;
  pageContent?: CampaignPageContent | null;
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
    shortDescription?: string | null;
    team?: TeamMember[] | null;
  };
}

/** Owner-only draft preview (no-store). */
export const getCampaignPreview = (orgId: string, campId: string, token: string) =>
  req<PublicCampaignLanding>(
    `/organisations/${encodeURIComponent(orgId)}/campaigns/${encodeURIComponent(campId)}/preview`,
    { cache: "no-store" },
    token,
  );

// ── Walkthrough ───────────────────────────────────────────────────────────────

export interface WalkthroughProgress {
  profileStep: number | null;
  campaignStep: number | null;
  profileDone: boolean;
  campaignDone: boolean;
  exitedAt: string | null;
  selectedCampaignId?: string | null;
}

export interface WalkthroughState {
  walkthrough: WalkthroughProgress;
  profilePreviewedAt: string | null;
  campaignPreviewedAt: string | null;
  campaignPreviewedId?: string | null;
  payoutSetupSelected: boolean;
}

export const getWalkthrough = (orgId: string, token: string) =>
  req<WalkthroughState>(`/organisations/${encodeURIComponent(orgId)}/walkthrough`, { cache: "no-store" }, token);

export const patchWalkthrough = (orgId: string, data: Partial<WalkthroughProgress>, token: string) =>
  req<{ walkthrough: WalkthroughProgress }>(
    `/organisations/${encodeURIComponent(orgId)}/walkthrough`,
    { method: "PATCH", body: JSON.stringify(data) },
    token,
  );

export const postWalkthroughEvent = (
  orgId: string,
  data: { event: "profile_preview" | "campaign_preview"; campaignId?: string },
  token: string,
) =>
  req<WalkthroughState | { ok: boolean }>(
    `/organisations/${encodeURIComponent(orgId)}/walkthrough/events`,
    { method: "POST", body: JSON.stringify(data) },
    token,
  );

// ── Dashboard summary ─────────────────────────────────────────────────────────

export interface DashboardSummary {
  raisedGbp: number;
  unavailable?: Array<"payouts" | "payoutHistory" | "supporters" | "posts">;
  /** Actual ledger amount owed. null when the ledger could not be read. */
  owedGbp: number | null;
  nextPayoutAt: string | null;
  lastPayout: { amountGbp: number; reference: string; sentAt: string } | null;
  recentSupporters: PublicSupporter[];
  campaignRaised: Array<{ campaignId: string; name: string; raisedGbp: number }>;
  latestUpdateAt: string | null;
  impactMetricsStale: boolean;
}

export const getDashboardSummary = (orgId: string, token: string) =>
  req<DashboardSummary>(`/organisations/${encodeURIComponent(orgId)}/dashboard-summary`, { cache: "no-store" }, token);

export const getPublicCampaignLanding = (publicId: string) =>
  req<PublicCampaignLanding>(`/campaigns/landing/${encodeURIComponent(publicId)}`);

export const getPublicCampaignLandingBySlug = (organisationSlug: string, campaignSlug: string) =>
  req<PublicCampaignLanding>(
    `/campaigns/landing/${encodeURIComponent(organisationSlug)}/${encodeURIComponent(campaignSlug)}`,
  );

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

/** Private full editor models (draft content flattened, hasUnpublishedChanges). */
export const getOrgCampaigns = (orgId: string, token: string) => getManagedCampaigns(orgId, token);

/** POST with an empty body creates an empty draft. */
export const createCampaignDraft = (orgId: string, token: string) =>
  req<Campaign>(`/organisations/${orgId}/campaigns`, { method: "POST", body: JSON.stringify({}) }, token);

export const saveCampaignDraft = (orgId: string, campId: string, data: CampaignEditorPatch, token: string) =>
  req<Campaign>(
    `/organisations/${orgId}/campaigns/${campId}`,
    { method: "PATCH", body: JSON.stringify({ ...data, saveAsDraft: true }) },
    token,
  );

/** Publishes the latest persisted draft. Throws ApiError; 400 body has unmetGates. */
export const setCampaignPublished = (orgId: string, campId: string, enabled: boolean, token: string) =>
  req<Campaign>(
    `/organisations/${orgId}/campaigns/${campId}`,
    { method: "PATCH", body: JSON.stringify({ enabled }) },
    token,
  );

export const getCampaignAssistStatus = (token: string) =>
  req<{ enabled: boolean }>("/campaigns/assist/status", {}, token);

export type CampaignAssistField = "tagline" | "description" | "breakdown.detail" | "locations.description";

export const requestCampaignAssist = (
  data: { campaignId: string; field: CampaignAssistField; instruction: string },
  token: string,
) =>
  req<{ suggestion: string }>("/campaigns/assist", { method: "POST", body: JSON.stringify(data) }, token);

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

export const getSupporterInterests = (token: string) =>
  req<{ interests: string[] }>("/profile/interests", {}, token);

export const saveSupporterInterests = (interests: string[], token: string) =>
  req<{ interests: string[] }>(
    "/profile/interests",
    { method: "PUT", body: JSON.stringify({ interests }) },
    token,
  );

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
export const getMyRecurringDonations = (token: string) =>
  req<RecurringDonation[]>("/donations/recurring", { cache: "no-store" }, token);

export const createPortalSession = (token: string) =>
  req<{ url: string }>("/donations/portal", { method: "POST" }, token);

export const requestPasswordReset = (email: string) =>
  req<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });

export const createDonationCheckout = (
  data: {
    currency?: "gbp" | "usd";
    orgId: string;
    campaignId?: string;
    amountPence: number;
    guestEmail?: string;
    feeCovered?: boolean;
    originalAmountPence?: number;
    feeAmountPence?: number;
    wallOptIn?: boolean;
    donorName?: string;
    anonymousDonorId?: string;
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
    currency?: "gbp" | "usd";
    receiptAccounting?: import("../../../api-server/src/lib/donation-accounting").DonationAccounting;
    orgId: string;
    orgName: string;
    amountGbp: number | null;
    feePence: number;
    donorEmail: string | null;
    recorded: boolean;
    chargedGbp?: number | null;
    intendedGbp?: number | null;
    platformFeeGbp?: number | null;
    feeCovered?: boolean;
    feeCoverGbp?: number | null;
    toOrgGbp?: number | null;
    estimatedStripeFeeGbp?: number | null;
    grossAmountGbp?: number | null;
    netAmountGbp?: number | null;
    campaignId?: string | null;
    campaignName?: string | null;
    campaignPath?: string | null;
    unit?: CampaignUnit | null;
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

export const startConnectOnboarding = (token: string) =>
  req<{ url: string }>("/stripe/connect/onboard", { method: "POST" }, token);

// ── Payout setup ───────────────────────────────────────────────────────────────

export type PayoutMethod = "stripe" | "wise" | "bank_transfer";

export interface PayoutSetup {
  method: PayoutMethod | null;
  payoutManualRequested: boolean;
  payoutManualApproved: boolean;
  payoutManualLabel: string | null;
}

export const getPayoutSetup = (token: string) =>
  req<PayoutSetup>("/payout/setup", { cache: "no-store" }, token);

export const selectPayoutMethod = (method: PayoutMethod, token: string) =>
  req<PayoutSetup>("/payout/setup", { method: "PUT", body: JSON.stringify({ method }) }, token);

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
