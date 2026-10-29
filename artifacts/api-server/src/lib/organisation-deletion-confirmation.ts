// Shared by the admin dialog and API so incomplete organisation records cannot
// leave an invisible or impossible confirmation requirement.
export function organisationDeletionConfirmation(name: unknown): string {
  return typeof name === "string" && name.trim() ? name.trim() : "DELETE";
}
