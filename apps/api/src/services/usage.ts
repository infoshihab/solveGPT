import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { usageEvents, users } from "../db/schema.js";

export async function logUsage(
  userId: string,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number
) {
  await db.insert(usageEvents).values({
    userId,
    provider,
    model,
    inputTokens,
    outputTokens,
    costUsd,
  });
  await db
    .update(users)
    .set({
      tokensUsedMonth: sql`${users.tokensUsedMonth} + ${inputTokens + outputTokens}`,
    })
    .where(eq(users.id, userId));
}

export async function maybeResetMonthlyQuota(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return;
  const start = new Date(u.quotaPeriodStart);
  const now = new Date();
  const days = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (days >= 30) {
    await db
      .update(users)
      .set({ tokensUsedMonth: 0, quotaPeriodStart: now })
      .where(eq(users.id, userId));
  }
}

export async function usageSummaryForAdmin() {
  const byUser = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      cost: sql<number>`coalesce(sum(${usageEvents.costUsd})::float, 0)`,
      tokens: sql<number>`coalesce(sum(${usageEvents.inputTokens} + ${usageEvents.outputTokens}), 0)::int`,
    })
    .from(users)
    .leftJoin(usageEvents, eq(users.id, usageEvents.userId))
    .groupBy(users.id, users.email, users.role)
    .orderBy(sql`coalesce(sum(${usageEvents.costUsd})::float, 0) desc`);

  const byProvider = await db
    .select({
      provider: usageEvents.provider,
      cost: sql<number>`coalesce(sum(${usageEvents.costUsd})::float, 0)`,
      tokens: sql<number>`coalesce(sum(${usageEvents.inputTokens} + ${usageEvents.outputTokens}), 0)::int`,
    })
    .from(usageEvents)
    .groupBy(usageEvents.provider)
    .orderBy(sql`coalesce(sum(${usageEvents.costUsd})::float, 0) desc`);

  return { byUser, byProvider };
}

export async function myUsage(userId: string) {
  const [agg] = await db
    .select({
      cost: sql<number>`coalesce(sum(${usageEvents.costUsd})::float, 0)`,
      tokens: sql<number>`coalesce(sum(${usageEvents.inputTokens} + ${usageEvents.outputTokens}), 0)::int`,
    })
    .from(usageEvents)
    .where(eq(usageEvents.userId, userId));
  return agg ?? { cost: 0, tokens: 0 };
}
