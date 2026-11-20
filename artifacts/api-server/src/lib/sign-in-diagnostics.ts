// Provider errors can contain credentials or personal data. Never log the
// error, its message or an arbitrary firebaseCode; allow only known constants.
const SAFE_FIREBASE_CODES = new Set([
  "INVALID_LOGIN_CREDENTIALS",
  "EMAIL_NOT_FOUND",
  "INVALID_PASSWORD",
  "INVALID_EMAIL",
  "MISSING_PASSWORD",
  "USER_DISABLED",
  "TOO_MANY_ATTEMPTS_TRY_LATER",
  "OPERATION_NOT_ALLOWED",
  "PASSWORD_LOGIN_DISABLED",
  "API_KEY_INVALID",
  "API_KEY_SERVICE_BLOCKED",
  "PROJECT_NOT_FOUND",
  "CONFIGURATION_NOT_FOUND",
  "QUOTA_EXCEEDED",
  "INTERNAL_ERROR",
  "ADMIN_ONLY_OPERATION",
  "INVALID_TENANT_ID",
  "TENANT_ID_MISMATCH",
]);

export function signInDiagnosticCode(error: unknown): string {
  if (!error || typeof error !== "object") return "NO_PROVIDER_CODE";
  const code = (error as { firebaseCode?: unknown }).firebaseCode;
  if (typeof code !== "string" || !code.trim()) return "NO_PROVIDER_CODE";
  // Some Firebase messages append a human-readable description after a colon.
  const name = code.split(":", 1)[0]!.trim();
  return SAFE_FIREBASE_CODES.has(name) ? name : "UNRECOGNISED_PROVIDER_CODE";
}
