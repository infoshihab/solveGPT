import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { verifyPassword } from "../services/password.js";
import { signSessionToken } from "../services/jwt.js";

const router = Router();

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { email, password } = parsed.data;
  const raw = email.trim();
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${raw})`)
    .limit(1);
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = await signSessionToken({
    sub: row.id,
    email: row.email,
    role: row.role,
  });
  res.json({
    token,
    user: { id: row.id, email: row.email, role: row.role },
  });
});

router.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

export const authRouter = router;
