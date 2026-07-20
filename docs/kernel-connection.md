# Connecting the app to the Cognitive Kernel

The Next.js app is already wired to the Kernel (`lib/kernel/client.ts`, the
`/api/kernel/*` and `/api/raya/*` routes). "Connecting" just means running the
Kernel and pointing the app at it. There are two channels:

1. **HTTP** — the app calls the Kernel's FastAPI (`/analyze`, `/load_profile`,
   `/update_concept_state`, `/health`).
2. **Shared database** — the Kernel writes to the *same* Supabase project
   (`mbvovxnfdptxvnhmdxew`) with its `service_role` key, using the same
   `user_id` (= `public.users.id` = `auth.users.id`).

## 1. Run the Kernel (your part)

Repo: `github.com/angekana49-ui/Bluestift-Kernel` (Python / FastAPI).

Required env on the Kernel side:
- `SUPABASE_URL=https://mbvovxnfdptxvnhmdxew.supabase.co`
- `SUPABASE_SERVICE_KEY=<service_role key>` (Dashboard → Project Settings → API → service_role)
- `GROQ_API_KEY`, `GEMINI_API_KEY`
- `CORS_ORIGINS` including `http://localhost:3000` (already default in the repo)

Local: run it so it listens on `http://localhost:8000` (uvicorn/Procfile).
Deployed: use the repo's `railway.toml` / `render.yaml`; note the public URL.

## 2. Point the app at it

In `.env.local`:
```
KERNEL_API_URL=http://localhost:8000        # or the deployed URL
KERNEL_API_SECRET=                          # leave empty until the Kernel enforces auth
```

## 3. Verify the link

With the app running (`npm run dev`), open:
```
http://localhost:3000/api/kernel/health
```
- `{ "ok": true, ... }` → connected. RAYA will start enriching replies with the
  cognitive profile, and `/chat` "Analyze" will return real gap detection.
- `{ "ok": false, "error": "...", "url": "..." }` → not reachable; check the
  Kernel is up and `KERNEL_API_URL` is correct.

## Notes
- The app never blocks on the Kernel: `getCachedProfile` returns instantly and
  refreshes in the background, and Kernel calls have a 6s timeout. So the chat
  works even while the Kernel is down — it just won't be Kernel-personalized.
- Seed the concept graph once via the Kernel's `POST /seed_kcs` if needed (the
  DB already has 144 concept_nodes / 281 edges from earlier).
- Before production, add a shared secret: the Kernel currently exposes no auth.
