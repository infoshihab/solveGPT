import { Router } from "express";
import { z } from "zod";
import { eq, or, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { promptTemplates } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const uid = req.auth!.userId;
  const rows = await db
    .select()
    .from(promptTemplates)
    .where(or(eq(promptTemplates.userId, uid), eq(promptTemplates.isShared, true)))
    .orderBy(desc(promptTemplates.createdAt));
  res.json({ templates: rows });
});

const createBody = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
  isShared: z.boolean().optional(),
});

router.post("/", async (req, res) => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const isShared = parsed.data.isShared && req.auth!.role === "admin";
  const [row] = await db
    .insert(promptTemplates)
    .values({
      userId: req.auth!.userId,
      name: parsed.data.name,
      content: parsed.data.content,
      isShared: !!isShared,
    })
    .returning();
  res.json({ template: row });
});

router.delete("/:id", async (req, res) => {
  const uid = req.auth!.userId;
  const [row] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, req.params.id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (row.userId !== uid && req.auth!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(promptTemplates).where(eq(promptTemplates.id, req.params.id));
  res.json({ ok: true });
});

export const templatesRouter = router;
