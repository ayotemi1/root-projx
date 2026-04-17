import type { Request, Response, NextFunction } from "express";
import { firebaseLookup, fsGet } from "./firebase-rest.js";

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

async function resolveUser(token: string): Promise<AuthPayload | null> {
  const firebaseUser = await firebaseLookup(token);
  if (!firebaseUser) return null;

  const userDoc = await fsGet("users", firebaseUser.uid, token);
  const accountType = (userDoc?.accountType as string) ?? "supporter";

  return { userId: firebaseUser.uid, email: firebaseUser.email, accountType };
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized — no token provided" });
    return;
  }
  try {
    const token = authHeader.slice(7);
    const user = await resolveUser(token);
    if (!user) {
      res.status(401).json({ error: "Unauthorized — invalid or expired token" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized — invalid or expired token" });
  }
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }
  try {
    const token = authHeader.slice(7);
    const user = await resolveUser(token);
    if (user) req.user = user;
  } catch {
    // ignore — optional
  }
  next();
}
