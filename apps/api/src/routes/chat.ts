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
  generateOpenAIImage,
  mergeUserContentForDb,
  prepareMessagesForStream,
  type ChatMsg,
} from "../services/providers.js";
import { logUsage, maybeResetMonthlyQuota } from "../services/usage.js";
import {
  detectStreamIntent,
  extractImagePrompt,
  buildDallePrompt,
  classifyIntentWithOpenAI,
} from "../services/openaiImageIntent.js";

const attachmentSchema = z.object({
  name: z.string().min(1).max(200),
  mime: z.string().min(1).max(120),
  dataUrl: z.string().min(20).max(12_000_000),
});

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
  attachments: z.array(attachmentSchema).max(8).optional(),
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

/** CommonMark-safe image URL inside `![](...)` (parens in URL break markdown). */
function wrapMarkdownImageUrlForStorage(url: string): string {
  const t = url.trim();
  if (!t) return t;
  if (t.startsWith("<") && t.endsWith(">")) return t;
  if (/[\s()]/.test(t)) return `<${t}>`;
  return t;
}

const imageBodySchema = z.object({
  prompt: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
});

router.post("/generate-image", async (req, res) => {
  const parsed = imageBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const auth = req.auth!;
  const { prompt, conversationId } = parsed.data;

  if (conversationId) {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, auth.userId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
  }

  const apiKey = await getProviderApiKey("openai");
  if (!apiKey) {
    res.status(503).json({
      error: "OpenAI API key required for images. Set it in Admin → API keys or OPENAI_API_KEY.",
    });
    return;
  }

  try {
    const { dataUrlOrHttp, model: imageModelUsed } = await generateOpenAIImage(apiKey, prompt);
    if (conversationId) {
      await db.insert(messages).values([
        {
          conversationId,
          role: "user",
          content: `[Image] ${prompt}`,
        },
        {
          conversationId,
          role: "assistant",
          content: `![Generated image](${wrapMarkdownImageUrlForStorage(dataUrlOrHttp)})`,
        },
      ]);
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    }
    res.json({ type: "image", data: dataUrlOrHttp, model: imageModelUsed });
  } catch (e) {
    console.error("generate-image", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Image generation failed" });
  }
});

router.post("/stream", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { conversationId, provider, model, messages: chatMessages, attachments } = parsed.data;
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
    const titleSrc =
      chatMessages.find((m) => m.role === "user")?.content?.trim() ||
      (attachments?.length ? "Image message" : "New chat");
    const title = titleSrc.slice(0, 80);
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
    const contentForDb = mergeUserContentForDb(lastUser.content, attachments);
    await db.insert(messages).values({
      conversationId: convId,
      role: "user",
      content: contentForDb,
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
    const lastPlain = lastUser?.content?.trim() ?? "";
    let streamIntent = detectStreamIntent(lastPlain);
    if (provider === "openai" && lastPlain && process.env.OPENAI_ROUTE_IMAGE_LLM === "1") {
      try {
        streamIntent = await classifyIntentWithOpenAI(apiKey, lastPlain);
      } catch {
        /* keep rule-based intent */
      }
    }
    if (
      provider === "openai" &&
      !attachments?.length &&
      lastPlain &&
      streamIntent === "image"
    ) {
      const extracted = extractImagePrompt(lastPlain);
      const prompt = buildDallePrompt(extracted, lastPlain);
      const { dataUrlOrHttp, model: imageModelUsed } = await generateOpenAIImage(apiKey, prompt);
      send({ type: "result", kind: "image", data: dataUrlOrHttp });
      full = `![Generated image](${wrapMarkdownImageUrlForStorage(dataUrlOrHttp)})`;
      const imageCostUsd = 0.04;
      const imageTokenProxy = 4000;
      await logUsage(auth.userId, "openai", imageModelUsed, imageTokenProxy, 0, imageCostUsd);
      await db.insert(messages).values({
        conversationId: convId,
        role: "assistant",
        content: full,
      });
      await db
        .update(conversations)
        .set({ updatedAt: new Date(), provider, model })
        .where(eq(conversations.id, convId));
      send({
        type: "done",
        usage: {
          inputTokens: imageTokenProxy,
          outputTokens: 0,
          costUsd: imageCostUsd,
        },
      });
      res.end();
      return;
    }

    const msgs = prepareMessagesForStream(chatMessages, attachments, provider, model);
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

    send({ type: "result", kind: "chat", data: full });
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
