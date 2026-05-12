import { Router } from "express";
import { z } from "zod";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  conversations,
  messages,
  providerKeys,
  providerAllowlist,
  users,
} from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { decryptSecret } from "../services/encryption.js";
import {
  streamAnthropic,
  streamOpenAICompatible,
  streamGemini,
  estimateCostUsd,
  type ChatMsg,
} from "../services/providers.js";
import { logUsage, maybeResetMonthlyQuota } from "../services/usage.js";

const bodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  provider: z.enum(["anthropic", "openai", "grok", "gemini"]),
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
});

async function getProviderApiKey(provider: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(providerKeys)
    .where(and(eq(providerKeys.provider, provider), eq(providerKeys.active, true)))
    .limit(1);
  if (row) {
    try {
      return decryptSecret(row.encryptedKey);
    } catch {
      return null;
    }
  }
  const envMap: Record<string, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    grok: process.env.GROK_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };
  return envMap[provider] ?? null;
}

async function isModelAllowed(provider: string, model: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(providerAllowlist)
    .where(
      and(eq(providerAllowlist.provider, provider), eq(providerAllowlist.modelId, model))
    )
    .limit(1);
  if (!row) return true;
  return row.enabled;
}

const router = Router();
router.use(requireAuth);

router.post("/stream", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { conversationId, provider, model, messages: chatMessages } = parsed.data;
  const auth = req.auth!;

  await maybeResetMonthlyQuota(auth.userId);
  const [u] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  if (!u) {
    res.status(400).json({ error: "User not found" });
    return;
  }
  const projected = u.tokensUsedMonth + 8000;
  if (projected > u.tokenQuotaMonthly) {
    res.status(429).json({ error: "Monthly token quota exceeded" });
    return;
  }

  if (!(await isModelAllowed(provider, model))) {
    res.status(403).json({ error: "Model not enabled for your organization" });
    return;
  }

  const apiKey = await getProviderApiKey(provider);
  if (!apiKey) {
    res.status(503).json({ error: `No API key configured for ${provider}` });
    return;
  }

  let convId = conversationId;
  if (!convId) {
    const title =
      chatMessages.find((m) => m.role === "user")?.content?.slice(0, 80) ?? "New chat";
    const [c] = await db
      .insert(conversations)
      .values({
        userId: auth.userId,
        title,
        provider,
        model,
      })
      .returning();
    convId = c!.id;
  } else {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, convId), eq(conversations.userId, auth.userId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
  }

  const lastUser = [...chatMessages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    await db.insert(messages).values({
      conversationId: convId,
      role: "user",
      content: lastUser.content,
    });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (obj: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  send({ type: "meta", conversationId: convId, provider, model });

  let full = "";
  let inputT = 0;
  let outputT = 0;

  try {
    const msgs = chatMessages as ChatMsg[];
    let gen: AsyncGenerator<{ type: "text"; text: string } | { type: "usage"; inputTokens: number; outputTokens: number }>;

    if (provider === "anthropic") {
      gen = streamAnthropic(apiKey, model, msgs);
    } else if (provider === "openai") {
      gen = streamOpenAICompatible(apiKey, undefined, model, msgs);
    } else if (provider === "grok") {
      gen = streamOpenAICompatible(apiKey, "https://api.x.ai/v1", model, msgs);
    } else {
      const geminiMsgs = msgs.map((m) =>
        m.role === "system"
          ? ({ role: "user" as const, content: `[System]\n${m.content}` } as ChatMsg)
          : m
      );
      gen = streamGemini(apiKey, model, geminiMsgs);
    }

    for await (const chunk of gen) {
      if (chunk.type === "text") {
        full += chunk.text;
        send({ type: "token", text: chunk.text });
      } else if (chunk.type === "usage") {
        inputT = chunk.inputTokens;
        outputT = chunk.outputTokens;
      }
    }

    const cost = estimateCostUsd(model, inputT, outputT);
    await logUsage(auth.userId, provider, model, inputT, outputT, cost);

    await db.insert(messages).values({
      conversationId: convId,
      role: "assistant",
      content: full,
    });
    await db
      .update(conversations)
      .set({ updatedAt: new Date(), provider, model })
      .where(eq(conversations.id, convId));

    send({ type: "done", usage: { inputTokens: inputT, outputTokens: outputT, costUsd: cost } });
    res.end();
  } catch (e) {
    console.error("chat stream", e);
    send({ type: "error", message: e instanceof Error ? e.message : "Stream failed" });
    res.end();
  }
});

router.get("/conversations", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const list = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, req.auth!.userId),
        q ? ilike(conversations.title, `%${q}%`) : sql`true`
      )
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(100);
  res.json({ conversations: list });
});

router.get("/conversations/:id", async (req, res) => {
  const [c] = await db
    .select()
    .from(conversations)
    .where(
      and(eq(conversations.id, req.params.id), eq(conversations.userId, req.auth!.userId))
    )
    .limit(1);
  if (!c) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, c.id))
    .orderBy(messages.createdAt);
  res.json({ conversation: c, messages: msgs });
});

router.delete("/conversations/:id", async (req, res) => {
  const del = await db
    .delete(conversations)
    .where(
      and(eq(conversations.id, req.params.id), eq(conversations.userId, req.auth!.userId))
    )
    .returning({ id: conversations.id });
  if (!del.length) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

router.get("/conversations/:id/export.json", async (req, res) => {
  const [c] = await db
    .select()
    .from(conversations)
    .where(
      and(eq(conversations.id, req.params.id), eq(conversations.userId, req.auth!.userId))
    )
    .limit(1);
  if (!c) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, c.id))
    .orderBy(messages.createdAt);
  res.setHeader("Content-Disposition", `attachment; filename="chat-${c.id}.json"`);
  res.json({ conversation: c, messages: msgs });
});

export const chatRouter = router;
