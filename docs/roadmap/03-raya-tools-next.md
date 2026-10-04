# 03 — Raya's live tools: next steps

_Status 2026-10-04. Shipped that day:_
- _a live Wikipedia reference;_
- _interactive graphs and a calculator in Raya's replies;_
- _the same graph and calculator on the Tools page._

_This file is what comes after._

## What exists

| Piece | Where | Notes |
|---|---|---|
| When to look something up, and what is sent | `lib/raya/wikipedia.ts` `wikiQuery` | Fires only on knowledge questions (en/fr/es/de cue words). Sends at most 6 topic words; emails, handles, phone numbers and URLs are removed. |
| The lookup | `lookupWikipedia` | One `generator=search` request on the reader's language Wikipedia, 1.2 s deadline, empty list on any failure, cached for an hour (capped). |
| Prompt block | `referenceBlock` | XML-wrapped data. Raya cites `Source: [title — Wikipedia](url)` only when it used the page. |
| Graph / calculator syntax | `lib/math-blocks.ts` | Strict parser: a line it cannot read is shown as an error, never guessed. |
| Engine | `lib/math-engine.ts` | math.js with `import`/`createUnit`/`reviver` disabled. Only loaded through a dynamic import. |
| UI | `components/chat/math-tools.tsx` (`MathBlock`, `MathBench`), `components/math-studio.tsx` | SVG plotter; editable; Tools page work kept in localStorage `bs_math_studio`, wiped on sign-out. |
| What Raya is told | `MATH_TOOLS` in `lib/raya/prompt.ts` | A test parses the examples in the prompt, so prompt and parser cannot drift apart. |
| Tests | `test/raya-wikipedia.test.ts`, `test/math-tools.test.ts` | |

**Only the personal Raya chat** (`/api/raya/chat`, including a student's private
channel inside a room) gets the reference and the tools prompt. The renderer
(`RichText`) draws a graph block anywhere, but the other prompts never ask for one.

## Next steps, in order of value

### 1. Raya for Schools and the room group chat (S)
- **Raya for Schools:** `app/api/school/raya/chat/route.ts` builds its own prompt.
  - Append `MATH_TOOLS` to it, so a teacher gets graphs for preparing lessons.
  - Add the Wikipedia reference the same way the student route does: start the
    lookup after the gates and await it just before `rayaStream`.
  - The pedagogical warning in `MATH_TOOLS` is written for learners. Write a
    teacher variant rather than reusing it as-is.
- **Room group chat:** `app/api/rooms/raya/route.ts` uses `rayaComplete`, without
  streaming.
  - A graph in a group thread is shown to everyone, which is fine.
  - Before adding the Wikipedia reference here, check the room visibility rules in
    `safetyLayer("room")`.
- **Analytics:** the response event in each route already has the right shape.
  Add `wiki_pages` as in the student route (a count, never titles).

### 2. Better lookups (S–M)
- **Topic from the conversation.**
  - Today the query comes from the current message only, so a follow-up like
    "and why is it green?" misses the topic.
  - Pass the previous user turn into `wikiQuery` and take its topic words when the
    current message has fewer than two.
  - The same privacy rules apply to both messages.
- **Skip the lookup when the reply would not use it.** Measure first:
  `raya_response_received` carries `wiki_pages`. Compare reply time with and without
  a reference before tuning the cue list.
- **Google search grounding** (Gemini's `google_search` tool):
  - It is paid beyond a free quota.
  - It requires showing Google's search suggestions in the UI.
  - Groq, the fallback model, has no equivalent.
  - Only consider it with a budget, and behind an env flag.

### 3. More maths and science (M)
- **Geometry constructions** (circles, segments, perpendiculars): extend
  `parseGraph` with `circle C = ((0,0), 2)` and `segment [A, B]`, drawn in the
  same SVG.
  - Do not add GeoGebra: it is free only for non-commercial use, and Bluestift
    charges.
  - JSXGraph (LGPL/MIT) is an option if hand-drawing gets too complex. Load it
    with a dynamic import, like math.js.
- **Python for older students:** Pyodide (Python + numpy in the browser) as a
  ```python block that runs on click.
  - It is about 10 MB, so load it only on an explicit "Run".
  - Show the size first; many users are on mobile data.
- **Tables and statistics:** a ```data block (CSV) with mean, median and a
  histogram. math.js already does the statistics.
- **Keep the rules:**
  - every calculation stays on the learner's device;
  - each new block type gets a parser test and a prompt-example test.

### 4. Exports (S)
- PDF/TXT exports (`lib/doc-format.ts`) print a graph block as its source text.
- Render the SVG into the PDF (jspdf is already a dependency), or at least label
  the block "Graph:" so the export reads well.

## Things that must not change
- Nothing a student typed, other than the topic words chosen by `wikiQuery`, goes
  to Wikipedia. Change `wikiQuery` only with the privacy tests in
  `test/raya-wikipedia.test.ts` kept green.
- math.js stays out of the main bundle: a test fails a static import.
- Expressions are untrusted (they come from model output, which can be steered by
  an uploaded document). Do not re-enable `import` or `createUnit`.
