export type OrganisationApprovalStatus = "pending" | "approved" | "declined";
export type OrganisationAccessDecision = "allow" | "deny" | "check-legacy-profile";

export function organisationAccessDecision(
  accountType: string,
  approvalStatus?: OrganisationApprovalStatus,
): OrganisationAccessDecision {
  if (accountType !== "organisation") return "deny";
  if (approvalStatus === "approved") return "allow";
  if (approvalStatus === "pending" || approvalStatus === "declined") return "deny";
  return "check-legacy-profile";
}