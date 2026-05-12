# SolveGPT

Internal chat UI (Claude, OpenAI, Grok, Gemini) with email login, Postgres, and an Express API that holds provider keys.

## One-time setup

```bash
npm run setup
```

Copy `apps/api/.env.example` → `apps/api/.env` and set `DATABASE_URL`, `JWT_SECRET`, and `APP_ENCRYPTION_KEY`. The database must exist (e.g. `docker compose up -d` for the bundled Postgres).

## Run

```bash
npm run dev
```

Each web dev start clears `apps/web/.next` first so Turbopack/webpack cache mix-ups (e.g. missing `[turbopack]_runtime.js`) do not recur.

- Web: [http://localhost:3000](http://localhost:3000) (or 3001 if 3000 is busy)  
- API: [http://localhost:4000/health](http://localhost:4000/health)

The API runs `db:push` before starting in dev so tables stay in sync. Default users are created when `users` is empty (see `apps/api/src/services/seed.ts`).

**Images:** use **Create image (DALL·E)** in the chat composer; it needs an **OpenAI** API key (Admin → API keys or `OPENAI_API_KEY`). Chat models only return text unless you use this button (DALL·E 3).

**Users:** admins can add accounts under **Admin → Create user**.

## If the web app breaks after an upgrade

```bash
npm run clean:web
npm run dev
```

## Production

`npm run build`, then run the API (`node apps/api/dist/index.js`) and web (`next start` in `apps/web`). Set `NODE_ENV=production` and a strict `WEB_ORIGIN` list.
