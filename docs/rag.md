# RAG — where it actually stands, and how to build it

Written 2026-09-11, as a handoff. Nothing described in §3–§5 is built. §1 is
what ships today, and §1 matters more than the rest: most of what feels like
"we need RAG" is a truncation bug, not a retrieval problem.

Read `docs/chat-docs.md` first — it describes the upload path this note extends.

---

## 1. What exists today

### There is no retrieval. There is truncation.

A document's text is extracted once at upload and stored whole on a row. On
every turn, every document on the conversation is concatenated and cut with a
blind `.slice()`. Two ceilings, both silent:

| When | Where | Cap |
|---|---|---|
| Upload | `MAX_CONTENT` — `app/api/raya/files/route.ts` | **12 000 chars** (~4 pages). Everything past it is discarded *permanently* — the text is never stored, so no later feature can recover it. |
| Every turn | `persistAndGather` — `lib/raya/chat-context.ts` | **8 000 chars** (~2–3 pages) for **all** documents combined, up to 10 own files + 10 room files. |

The result reaches the model under `# Uploaded documents` in
`buildRayaMessages` (`lib/raya/prompt.ts`).

### Three defects in that, in order of how much they cost

1. **The student's own attachment is truncated first.** The concatenation is
   `[...roomFilesRes.data, ...ownFilesRes.data]`, so in a room that already has
   shared documents, the file the student just attached sits at the *end* of the
   string — i.e. the part `.slice(0, 8000)` throws away. The single worst line in
   the current design.
2. **The cut is invisible to the model.** A raw `.slice()` ends mid-word with no
   marker. Raya cannot know a chapter was clipped, so she answers confidently
   about material she was never given. Same failure class as the missing current
   date (§6): silent absence read as presence.
3. **12 000 chars are thrown away at upload, not at read.** Raising the turn
   budget later cannot undo it. Whatever else is done, **store the full text** —
   the column is `text`, and storage is the cheapest thing in this stack.

### The `rag` schema is scaffolding with no writer

Supabase has a `rag` schema with `rag_chunks`, `conversation_embeddings`,
`rag_queries`, `school_documents` and `user_media`, carrying `embedding` and
`embedding_status` columns. **Nothing in this codebase has ever written to any
of them except `user_media`**, which serves only as the monthly upload counter
in `app/api/tools/extract/route.ts`. `rag.Functions` in
`types/database.types.ts` is empty: no `match_*` RPC exists.

So the tables are free to reshape — no data, no migration to undo. But equally:
nothing has ever validated that their shape is right.

---

## 2. The decision: do not build vector RAG first

Three reasons, all specific to this repo rather than to RAG in general.

- **The first-token budget is already contested.** The comment at the top of
  `lib/raya/chat-context.ts` records that 4–6 serial round trips "ate over a
  second of the 3s first-token budget", which is why that file exists at all.
  Vector retrieval adds an embedding API call *plus* a pgvector query, on the
  critical path, on every turn. It would spend exactly the budget that file was
  written to reclaim.
- **The corpus per conversation is small.** A chapter, an exercise sheet, a past
  paper. Ten documents of 30 pages is ~600k chars — large against an 8 000-char
  budget, unremarkable for a modern context window. RAG solves "the corpus
  cannot fit". That is not true here yet; "the budget is set to 8 000" is.
- **Retrieval fights the Socratic ladder.** `site.ladder.note` promises Raya
  "cannot hand over a finished answer". Top-k similarity against a student's
  question about exercise 4 returns, reliably, the worked solution to exercise 4.
  Retrieval optimises for precisely what the product promises not to do.

Vector RAG earns its place at one specific moment: when a **school** uploads a
whole year's curriculum and a single conversation must draw on material far
larger than a context window. Build it then, for that. Not before.

---

## 3. Stage 0 — budget the context honestly (~1 hour, no new dependencies)

This removes most of the real pain and unblocks everything after it.

1. **Store the whole document.** Raise `MAX_CONTENT` in
   `app/api/raya/files/route.ts` from `12_000` to ~`200_000`, and do the same
   wherever `/api/rooms/files` clamps. Extraction already runs on a 60s
   `maxDuration`; the extra cost is bytes in Postgres.
2. **Replace the blind slice** in `persistAndGather` with a per-document budget:
   divide the total across the documents present, so ten files get a tenth each
   instead of the first two taking everything.
3. **Put the student's own files first** — `[...ownFiles, ...roomFiles]`. If
   anything must be dropped, it should not be the file they just attached.
4. **Make every cut speak.** Append a literal marker to any clipped document:

   ```
   # chapitre-7.pdf
   …text…
   [TRUNCATED — 34 000 of 42 000 characters shown. You do not have the rest of
   this document. If the answer depends on the missing part, say so.]
   ```

   That last sentence is the whole point. It converts a confident wrong answer
   into "je n'ai que le début de ce chapitre, envoie-moi la suite" — which is
   both honest and, for a tutor, better pedagogy than a fluent guess.
5. **Raise the total budget** from 8 000 to something matched to the model in
   `lib/raya/llm.ts` — 30 000–60 000 chars is safe for current Gemini Flash
   context and leaves the learner-state block room. Measure first-token latency
   before and after; if it moves, lower it. It is a tuning number, so give it one
   named constant rather than inlining it.

Done properly, Stage 0 makes documents work for the overwhelming majority of
real sessions, and turns every later stage into an optimisation rather than a
rescue.

---

## 4. Stage 1 — lexical retrieval in Postgres (no embeddings, no API calls)

The moment a corpus genuinely exceeds the Stage 0 budget, the question becomes
*which* parts to include. The cheapest good answer is Postgres full-text search:
already in the database, one indexed query.

- Chunk on ingestion (~1 500 chars, split on paragraph boundaries, ~200 chars
  overlap) into `rag.rag_chunks` — the table already carries `content`,
  `user_id`, `class_id`, `assignment_id`, `source_type`, `source_id`.
- Add a generated `tsvector` column and a GIN index. Language matters: the app
  ships EN/FR/ES/DE (`lib/i18n/`), so store each document's language and pick the
  matching text-search config, falling back to `simple` when unknown.
- At query time, `websearch_to_tsquery` against the student's message, take the
  top N chunks by `ts_rank`, and fill the Stage 0 budget with those instead of
  with the head of each document.

For textbook material this beats its reputation, because a student asking about
a lesson reuses that lesson's vocabulary — the exact case lexical search handles
well. No network call, no fallback to design, no dimension to commit to, and it
degrades to Stage 0 behaviour when nothing matches.

---

## 5. Stage 2 — vectors, when a corpus really is bigger than the window

Only then. The shape:

1. `create extension if not exists vector;` and give `rag.rag_chunks.embedding` a
   real `vector(768)` type — today it is typed `string | null`, i.e. not a vector
   column yet. Add an HNSW index.
2. **Embed with Gemini** — `GEMINI_API_KEY` is already configured. Pick the
   current Google embedding model at build time, and pin both the model *and* the
   dimension in the migration comment.
3. **Ingest off the request path.** Embedding 200 chunks does not fit in an
   upload request already spending its 60s on extraction. This is exactly what
   `embedding_status` was designed for: write chunks as `pending` and let a cron
   route drain the queue. The pattern exists —
   `app/api/cron/anon-lifecycle/route.ts`.
4. **Create the match function.** `rag.Functions` is empty, so
   `rag.match_rag_chunks(query_embedding, match_count, filter_user, filter_room)`
   must be written, `security definer`, with the ownership filter as *arguments* —
   never as something a caller can omit.
5. **Hybrid, not pure vector.** Keep Stage 1's lexical rank and merge the two
   result sets (reciprocal-rank fusion is ten lines). Vectors miss exact tokens —
   formula names, "exercice 4b", a theorem's name — and those are a large share of
   what a student actually asks about.

---

## 6. The five things that will bite you

1. **There is no Groq fallback for embeddings.** The LLM ladder in
   `lib/raya/llm.ts` is Gemini → Groq, but Groq serves no embeddings API, so a
   Gemini outage stalls ingestion with no second rung. Design for it: chunks stay
   `pending`, retrieval falls back to Stage 1 lexical (which needs no provider),
   and a failed embedding never blocks an upload from succeeding.
2. **The dimension is a one-way door.** Changing it later means re-embedding
   every chunk and rebuilding the index. Choose once, write the number into the
   migration, and never read it from an env var.
3. **Compliance is pre-wired for the wrong table.** `lib/compliance/erasure.ts`
   already deletes `rag.conversation_embeddings` (empty) and
   `lib/compliance/export.ts` exports `rag.user_media`. **Neither touches
   `rag_chunks`.** The day chunks start being written, both files must be
   updated or GDPR erasure silently leaves a student's document text behind —
   the precise failure `docs/compliance.md` warns about under "No FK at all",
   since `rag` rows carry no foreign key back to `public.users` and cascade
   deletes never reach them.
4. **The route is the boundary.** A retrieval RPC run with the service role
   bypasses RLS by definition, so the ownership filter must be enforced in the
   route before the call — the rule already written down after the
   student-record IDOR. Never pass a `user_id` that arrived from the client.
5. **Keep the Socratic clause.** The `# Uploaded documents` block in
   `lib/raya/prompt.ts` says "Do not reproduce them verbatim." With retrieval it
   needs one line more — never paste a worked solution to the exercise the
   student is currently attempting — because that is exactly what top-k surfaces.

---

## 7. If you only do one thing

Stage 0, items 1 and 4: **store the full text, and make truncation announce
itself.** Item 1 is irreversible data loss happening today on every upload over
four pages. Item 4 turns the product's most embarrassing failure — answering
confidently about a page it never read — into a sentence a good tutor would say
anyway.
