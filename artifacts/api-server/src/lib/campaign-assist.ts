export interface CampaignAssistInput {
  field: string;
  orgContext: Record<string, unknown>;
  campaignDraft: Record<string, unknown>;
  instruction: string;
}

// Deliberately provider-free. This boundary can gain a provider later without
// changing the builder, and never persists a suggestion on the user's behalf.
export async function suggest(_input: CampaignAssistInput): Promise<{ suggestion: string } | { unavailable: true }> {
  return { unavailable: true };
}
