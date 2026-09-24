# Draft migrations — prepared, NOT applied

Nothing in this folder runs. `supabase db push` and the migration ledger only
read `supabase/migrations/`, so a file here is a reviewed proposal, not a
change to any database.

They exist so a future update can be switched on in one deliberate step rather
than written under pressure the day it is needed. Each one pairs with code
that is already in the repo and already tested, but that nothing calls yet —
see `docs/prepared-updates.md` for the full activation checklist of each.

| Draft | Pairs with | Status |
|---|---|---|
| `social_v1.sql` | `lib/social/*` | Prepared — not applied, nothing wired |
| `newsletter_v1.sql` | `lib/newsletter/*`, `lib/content-authoring.ts` | Prepared — not applied, nothing wired |

## Switching one on

1. Re-read the draft against the **live** schema, not against this file — the
   tables it alters already exist and may have moved since it was written.
2. Move it into `supabase/migrations/` under a fresh timestamp prefix
   (`YYYYMMDDHHMMSS_name.sql`). Do not keep the draft copy: two copies drift.
3. Apply it, then check the schema itself (policies, constraints, columns) —
   "is it applied" means the schema, not the ledger (see
   `docs/project-status.md` §6.1).
4. Run `npm run gen:types`, then follow the rest of that feature's checklist.
