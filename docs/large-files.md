# Large files

A snapshot of every real source file (`app/`, `components/`, `lib/`, `test/`,
`types/`) at 600+ lines, taken 2026-09-08. Not a to-do list — nothing here is
broken, so nothing here gets split "on principle." It exists so a future
splitting pass (if one ever happens) starts from a real number instead of a
guess, and so a reviewer seeing a large diff in one of these files has context
for why the file is already big before this change.

Repo-wide for comparison: 404 real `.ts`/`.tsx` files, median 120 lines, 90th
percentile 356 lines. Everything below is above that 90th percentile.

## Data / generated — large by nature, not a code smell

| File | Lines | Why it's big |
|---|---:|---|
| `types/database.types.ts` | 4193 | Generated from the Supabase schema (`npm run gen:types`). Never hand-edited. |
| `lib/i18n/en.ts` | 3191 | The English message catalogue — one entry per translatable string, total is source-language. |
| `lib/i18n/de.ts` | 2915 | German translation catalogue, one entry per key in `en.ts`. |
| `lib/i18n/fr.ts` | 2914 | French translation catalogue. |
| `lib/i18n/es.ts` | 2914 | Spanish translation catalogue. |

## Logic / UI — real code, candidates if a splitting pass ever happens

| File | Lines |
|---|---:|
| `components/school-admin.tsx` | 2981 |
| `components/site/ProductShots.tsx` | 2673 |
| `lib/school-admin.ts` | 2496 |
| `components/site/KernelDiagrams.tsx` | 2165 |
| `components/room-view.tsx` | 1235 |
| `lib/entitlements.ts` | 1137 |
| `components/study/focus-player.tsx` | 1049 |
| `components/onboarding-form.tsx` | 905 |
| `components/raya/raya-app.tsx` | 810 |
| `lib/billing.ts` | 807 |
| `lib/raya/prompt.ts` | 766 |
| `components/chat/chat-history-list.tsx` | 720 |
| `components/ui/shell.tsx` | 715 |
| `components/site/pages/SurveyView.tsx` | 693 |
| `components/site/pages/PricingView.tsx` | 649 |
| `components/auth-panel.tsx` | 627 |
| `components/chat/use-chat-engine.ts` | 601 |

## Rule in effect

"If it ain't broke, don't fix it." These files work, are covered by the test
suite, and a line count alone is not a bug. This list is a reference point for
*if* a file in it becomes hard to work in — not a mandate to touch any of them
now.
