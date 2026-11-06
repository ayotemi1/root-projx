import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function getAdminTokenValue() {
  const credential = process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET;
  if (!credential) throw new Error("Administrator credentials are not configured");
  return createHmac("sha256", credential)
    .update("rootprojx-admin-session").digest("hex");
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_SECRET) {
    res.status(503).json({ error: "Administrator credentials are not configured" });
    return;
  }
  const value = req.headers["x-admin-token"];
  const expected = getAdminTokenValue();
  if (typeof value !== "string" || Buffer.byteLength(value) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(value), Buffer.from(expected))) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}
