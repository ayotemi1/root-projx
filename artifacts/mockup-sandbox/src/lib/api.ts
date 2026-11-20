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
