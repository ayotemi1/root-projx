// Structural guard shared by encryption and storage; never needs the secret.
export function parseBankEnvelope(value: unknown) {
  if (typeof value !== "string" || value.length > 12000) throw new Error("Invalid encrypted bank record.");
  const parts = value.split(".");
  const version = parts.shift();
  const keyId = version === "v2" ? parts.shift() : "primary";
  if ((version !== "v1" && version !== "v2") || !keyId || !/^[A-Za-z0-9_-]{1,64}$/.test(keyId) || parts.length !== 3) {
    throw new Error("Invalid encrypted bank record.");
  }
  const [iv, tag, ciphertext] = parts as [string, string, string];
  for (const item of parts) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(item) || Buffer.from(item, "base64").toString("base64") !== item) {
      throw new Error("Invalid encrypted bank record.");
    }
  }
  if (Buffer.from(iv, "base64").length !== 12 || Buffer.from(tag, "base64").length !== 16 ||
      Buffer.from(ciphertext, "base64").length < 2) throw new Error("Invalid encrypted bank record.");
  return { version, keyId, iv, tag, ciphertext };
}

export function assertEncryptedBankRecord(record: Record<string, unknown>): void {
  parseBankEnvelope(record.encrypted);
  // No second plaintext copy can be attached beside the envelope.
  if (Object.keys(record).some(key => !["encrypted", "revision", "submittedAt"].includes(key)) ||
      typeof record.revision !== "string" || !record.revision ||
      typeof record.submittedAt !== "string" || !Number.isFinite(Date.parse(record.submittedAt))) {
    throw new Error("Invalid encrypted bank record.");
  }
}
