import { randomUUID } from "node:crypto";

export const BANK_AUDIT_COLLECTION = "bank_details_audit";
export interface BankAudit {
  id: string;
  record: {
    adminIdentity: string;
    identityType: "shared_credential";
    action: "reveal" | "approve";
    timestamp: string;
    orgId: string;
    revision: string;
  };
}

export function bankAudit(action: "reveal" | "approve", orgId: string, revision: unknown): BankAudit {
  if (typeof revision !== "string" || !revision) throw new Error("Missing bank record revision.");
  return {
    id: randomUUID(),
    record: {
      adminIdentity: "shared-admin",
      identityType: "shared_credential",
      action, timestamp: new Date().toISOString(), orgId, revision,
    },
  };
}
