import type { Request, Response, NextFunction } from "express";

export interface AuthPayload {
  userId: string;
  email: string;
  accountType: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export async function requireAuth(
  _req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  res.status(503).json({ error: "Auth layer pending Firebase migration (Step 4)" });
}

export async function optionalAuth(
  _req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  next();
}
