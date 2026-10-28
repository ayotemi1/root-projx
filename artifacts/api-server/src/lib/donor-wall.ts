import { firstNameLastInitial } from "./campaign-supporters.js";

export class DonorWallInputError extends Error {}

/** Public names are explicit consent, not inferred from billing/contact details. */
export function checkoutWallMetadata(body: Record<string, unknown>, registered = false): Record<string, string> {
  if (body.wallOptIn !== true) return { wallOptIn: "false" };
  if (registered) return { wallOptIn: "true" }; // Webhook checks the account's existing privacy preference.
  const name = typeof body.donorName === "string" ? body.donorName.trim() : "";
  if (!name || name.length > 80 || /[<>@\r\n]/.test(name)) {
    throw new DonorWallInputError("Enter your name for the donor wall, or leave name sharing unchecked.");
  }
  return { wallOptIn: "true", publicDonorName: firstNameLastInitial(name) };
}
