import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function getAdminTokenValue() {
  return createHmac("sha256", process.env.ADMIN_PASSWORD ?? "rootprojx-admin")
    .update("rootprojx-admin-session").digest("hex");
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const value = req.headers["x-admin-token"];
  const expected = getAdminTokenValue();
  if (typeof value !== "string" || Buffer.byteLength(value) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(value), Buffer.from(expected))) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}
