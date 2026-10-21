import type {
  OrgPayoutSummary,
  PayoutOverview,
  PayoutRunResult,
  PayoutSettlementInput,
  PayoutSettlementResult,
} from "@workspace/api-client-react";
import { API_BASE } from "@/lib/api";

export class PayoutApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function call<T>(path: string, init: RequestInit, headers: Record<string, string>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...headers },
  });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const msg = (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string")
      ? (body as { error: string }).error
      : `Request failed (${res.status})`;
    throw new PayoutApiError(msg, res.status, body);
  }
  return body as T;
}

export const adminPayoutsKey = ["admin-payouts"] as const;
export const myPayoutsKey = (orgId: string) => ["my-payouts", orgId] as const;

export const getAdminPayouts = (adminToken: string) =>
  call<PayoutOverview>("/admin/payouts", { method: "GET" }, { "x-admin-token": adminToken });

export const runPayouts = (adminToken: string) =>
  call<PayoutRunResult>("/admin/payouts/run", { method: "POST" }, { "x-admin-token": adminToken });

export const markPayoutSent = (adminToken: string, input: PayoutSettlementInput) =>
  call<PayoutSettlementResult>(
    "/admin/payouts/mark-sent",
    { method: "POST", body: JSON.stringify(input) },
    { "x-admin-token": adminToken },
  );

export const getMyPayouts = (token: string) =>
  call<OrgPayoutSummary>("/payouts/my", { method: "GET" }, { Authorization: `Bearer ${token}` });

export function gbp(n: number | null | undefined): string {
  return `£${(n ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function payoutDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const METHOD_LABEL: Record<string, string> = {
  stripe_connect: "Stripe Connect",
  wise: "Wise",
  manual: "Bank transfer (manual)",
  none: "Not set",
};

export const PAYOUT_POLICY_TEXT =
  "Donations are held for 7 days. An organisation is due once its eligible balance reaches £250, or when its oldest eligible payout is over 30 days old.";
