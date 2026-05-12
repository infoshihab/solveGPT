import { Router } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { providerKeys, providerAllowlist, users } from "../db/schema.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { encryptSecret } from "../services/encryption.js";
import { usageSummaryForAdmin } from "../services/usage.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/overview", async (_req, res) => {
  const summary = await usageSummaryForAdmin();
  const members = await db.select().from(users).orderBy(users.email);
  const keys = await db
    .select({
      provider: providerKeys.provider,
      active: providerKeys.active,
      updatedAt: providerKeys.updatedAt,
    })
    .from(providerKeys);
  const allow = await db.select().from(providerAllowlist);
  res.json({ summary, members, keys, allowlist: allow });
});

const keyBody = z.object({
  provider: z.enum(["anthropic", "openai", "grok", "gemini"]),
  apiKey: z.string().min(8),
});

router.post("/keys", async (req, res) => {
  const parsed = keyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { provider, apiKey } = parsed.data;
  const enc = encryptSecret(apiKey);
  const existing = await db
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.provider, provider))
    .limit(1);
  if (existing[0]) {
    await db
      .update(providerKeys)
      .set({ encryptedKey: enc, active: true, updatedAt: new Date() })
      .where(eq(providerKeys.provider, provider));
  } else {
    await db.insert(providerKeys).values({ provider, encryptedKey: enc });
  }
  res.json({ ok: true });
});

const memberBody = z.object({
  userId: z.string().uuid(),
  tokenQuotaMonthly: z.number().int().positive().optional(),
  role: z.enum(["admin", "member"]).optional(),
});

router.patch("/members", async (req, res) => {
  const parsed = memberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { userId, tokenQuotaMonthly, role } = parsed.data;
  const patch: Partial<typeof users.$inferInsert> = {};
  if (tokenQuotaMonthly != null) patch.tokenQuotaMonthly = tokenQuotaMonthly;
  if (role != null) patch.role = role;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  await db.update(users).set(patch).where(eq(users.id, userId));
  res.json({ ok: true });
});

const allowBody = z.object({
  provider: z.enum(["anthropic", "openai", "grok", "gemini"]),
  modelId: z.string(),
  enabled: z.boolean(),
});

router.post("/allowlist", async (req, res) => {
  const parsed = allowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { provider, modelId, enabled } = parsed.data;
  const hit = await db
    .select()
    .from(providerAllowlist)
    .where(
      and(eq(providerAllowlist.provider, provider), eq(providerAllowlist.modelId, modelId))
    )
    .limit(1);
  if (enabled) {
    if (hit[0]) {
      await db.delete(providerAllowlist).where(eq(providerAllowlist.id, hit[0].id));
    }
  } else if (hit[0]) {
    await db.update(providerAllowlist).set({ enabled: false }).where(eq(providerAllowlist.id, hit[0].id));
  } else {
    await db.insert(providerAllowlist).values({ provider, modelId, enabled: false });
  }
  res.json({ ok: true });
});

export const adminRouter = router;
