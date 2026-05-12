import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { verifySessionToken } from "../services/jwt.js";

export type AuthedRequest = {
  userId: string;
  email: string;
  role: "admin" | "member";
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthedRequest;
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }
    const token = header.slice("Bearer ".length);
    const session = await verifySessionToken(token);
    if (!session) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }

    const [row] = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
    if (!row) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    req.auth = {
      userId: row.id,
      email: row.email,
      role: row.role as "admin" | "member",
    };
    next();
  } catch (e) {
    console.error("auth", e);
    res.status(401).json({ error: "Unauthorized" });
  }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.auth?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  next();
};
