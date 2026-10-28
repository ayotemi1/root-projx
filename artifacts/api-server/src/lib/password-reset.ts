export const PASSWORD_RESET_MESSAGE =
  "If an account exists for that email, we've sent a password reset link. Check your inbox and spam folder.";

export function passwordResetEmail(input: unknown): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const email = (input as Record<string, unknown>).email;
  if (typeof email !== "string") return null;
  const normalised = email.trim().toLowerCase();
  return normalised.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)
    ? normalised : null;
}
