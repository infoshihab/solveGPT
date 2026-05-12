import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword } from "./password.js";

const ADMIN_EMAIL = "admin@solveGPT.com";
const ADMIN_PASSWORD = "SolveGPT@26";
const DEMO_EMAIL = "demo@gmail.com";
const DEMO_PASSWORD = "1234";

export async function ensureSeedUsers(): Promise<void> {
  let count: number;
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    count = row?.count ?? 0;
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "42P01") {
      console.warn("Database schema missing. From repo root run: npm run db:push");
      return;
    }
    throw e;
  }

  if (count > 0) return;

  const adminHash = await hashPassword(ADMIN_PASSWORD);
  const demoHash = await hashPassword(DEMO_PASSWORD);

  await db.insert(users).values([
    {
      email: ADMIN_EMAIL,
      passwordHash: adminHash,
      role: "admin",
    },
    {
      email: DEMO_EMAIL,
      passwordHash: demoHash,
      role: "member",
    },
  ]);

  console.log(`Seeded default users: ${ADMIN_EMAIL} (admin), ${DEMO_EMAIL} (member)`);
}
