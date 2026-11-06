import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface BankDetails {
  accountHolder: string;
  bankName: string;
  bankCountry: string;
  currency: string;
  accountNumber: string;
  iban: string;
  routingCode: string;
  swiftBic: string;
  branchName: string;
  bankAddress: string;
  beneficiaryAddress: string;
}

const limits: Record<keyof BankDetails, number> = {
  accountHolder: 150, bankName: 150, bankCountry: 2, currency: 3,
  accountNumber: 34, iban: 34, routingCode: 30, swiftBic: 11,
  branchName: 150, bankAddress: 300, beneficiaryAddress: 300,
};

export function validateBankDetails(input: unknown): BankDetails {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(key => !Object.hasOwn(limits, key))) throw new Error("Provide bank details only.");
  const data = input as Record<string, unknown>;
  const result = {} as BankDetails;
  for (const [key, limit] of Object.entries(limits) as [keyof BankDetails, number][]) {
    if (data[key] !== undefined && typeof data[key] !== "string") throw new Error(`Enter valid ${key}.`);
    const raw = ((data[key] ?? "") as string).trim();
    const value = key === "iban" ? raw.replace(/\s/g, "") : raw;
    if (value.length > limit || /[\x00-\x1f\x7f]/.test(value)) throw new Error(`Enter valid ${key}.`);
    result[key] = value;
  }
  result.bankCountry = result.bankCountry.toUpperCase();
  result.currency = result.currency.toUpperCase();
  result.iban = result.iban.replace(/\s/g, "").toUpperCase();
  result.swiftBic = result.swiftBic.toUpperCase();
  if (!result.accountHolder || !result.bankName) throw new Error("Enter the account holder and bank name.");
  if (!/^[A-Z]{2}$/.test(result.bankCountry) || !/^[A-Z]{3}$/.test(result.currency)) {
    throw new Error("Use a two-letter bank country code and a three-letter currency code.");
  }
  if (!result.accountNumber && !result.iban) throw new Error("Enter an account number or IBAN.");
  if (result.accountNumber && !/^[A-Za-z0-9 -]+$/.test(result.accountNumber)) throw new Error("Enter a valid account number.");
  if (result.iban) {
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(result.iban)) throw new Error("Enter a valid IBAN.");
    const digits = (result.iban.slice(4) + result.iban.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
    let remainder = 0;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
    if (remainder !== 1) throw new Error("Check the IBAN; its check digits are invalid.");
  }
  if (result.swiftBic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(result.swiftBic)) throw new Error("Enter a valid SWIFT/BIC.");
  const routing = result.routingCode.replace(/[\s-]/g, "");
  if (result.bankCountry === "GB" && !result.iban && !/^\d{6}$/.test(routing)) throw new Error("Enter a six-digit UK sort code.");
  if (result.bankCountry === "US" && !/^\d{9}$/.test(routing)) throw new Error("Enter a nine-digit US routing number.");
  return result;
}

function key(): Buffer {
  const value = process.env.BANK_DETAILS_ENCRYPTION_KEY ?? "";
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value) || Buffer.from(value, "base64").length !== 32) {
    throw new Error("Bank detail storage is not configured.");
  }
  return Buffer.from(value, "base64");
}

export function encryptBankDetails(details: BankDetails, orgId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(`rootprojx:bank-details:v1:${orgId}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(details), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptBankDetails(envelope: string, orgId: string): BankDetails {
  const [version, iv, tag, encrypted, extra] = envelope.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted || extra) throw new Error("Invalid bank record.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(`rootprojx:bank-details:v1:${orgId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8"));
}

export function bankDetailsSummary(record: Record<string, unknown> | null, org: Record<string, unknown>) {
  return {
    hasDetails: !!record,
    revision: typeof record?.revision === "string" ? record.revision : null,
    submittedAt: typeof record?.submittedAt === "string" ? record.submittedAt : null,
    approved: !!record && org.payoutManualApproved === true && org.bankDetailsRevision === record.revision,
  };
}
