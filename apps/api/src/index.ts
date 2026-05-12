import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { chatRouter } from "./routes/chat.js";
import { adminRouter } from "./routes/admin.js";
import { templatesRouter } from "./routes/templates.js";
import { authRouter } from "./routes/auth.js";
import { requireAuth } from "./middleware/auth.js";
import { db } from "./db/client.js";
import { users } from "./db/schema.js";
import { eq } from "drizzle-orm";
import { myUsage } from "./services/usage.js";
import { ensureSeedUsers } from "./services/seed.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

function webOriginsFromEnv(): string[] {
  return (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

const isProd = process.env.NODE_ENV === "production";

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowList = webOriginsFromEnv();
      if (allowList.includes(origin)) {
        callback(null, true);
        return;
      }
      if (!isProd && isLocalhostOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);
app.use(express.json({ limit: "2mb" }));

const limiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "solvegpt-api" });
});

app.use("/api/auth", authRouter);

app.use(limiter);

app.get("/api/me", requireAuth, async (req, res) => {
  const [u] = await db.select().from(users).where(eq(users.id, req.auth!.userId)).limit(1);
  if (!u) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const usage = await myUsage(req.auth!.userId);
  res.json({
    user: { id: u.id, email: u.email, role: u.role, tokenQuotaMonthly: u.tokenQuotaMonthly, tokensUsedMonth: u.tokensUsedMonth },
    usage,
  });
});

app.use("/api/chat", chatRouter);
app.use("/api/admin", adminRouter);
app.use("/api/templates", templatesRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal error" });
});

app.listen(port, async () => {
  try {
    await ensureSeedUsers();
  } catch (e) {
    console.error("Seed users failed (is DATABASE_URL correct?)", e);
  }
  console.log(`SolveGPT API listening on http://localhost:${port}`);
});
