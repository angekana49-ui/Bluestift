-- A memory word standing between a borrowed browser and a permanent backdoor.
--
-- The hole: /api/account/recovery-key mints a NEW key for whoever holds the
-- session. There is no password to re-enter, because an anonymous account has
-- none. So anyone who reaches an unlocked browser — a shared school machine, a
-- sibling, a phone left on a desk — presses one button, writes the key down and
-- owns that account permanently, from anywhere, long after the owner walks away.
-- The 5-per-day limit does not help: one is enough.
--
-- The word is deliberately something a child can remember ("banane"), which
-- means it carries almost no entropy. The security therefore comes from rate
-- limiting the guesses, not from the secret's strength — but the STORED form
-- still has to survive the table leaking, and against a six-letter dictionary
-- word an unsalted SHA-256 falls instantly to a wordlist. Hence scrypt with a
-- per-row salt, encoded in the column: scrypt$N$r$p$salt$hash.
--
-- Cleartext is never stored, so a forgotten word cannot be looked up or mailed
-- back. lib/recovery-keyword.ts carries the rest of the reasoning.
alter table public.users
  add column if not exists recovery_keyword_hash text,
  add column if not exists recovery_keyword_set_at timestamptz;

-- Same posture as training_consent: a client that can write this column is a
-- client that can clear it, and clearing it removes the gate entirely. Only the
-- service role, through the route that verifies the current word, may touch it.
revoke update (recovery_keyword_hash) on public.users from authenticated;
revoke update (recovery_keyword_set_at) on public.users from authenticated;

-- And it must never be readable by the account holder's own client either: the
-- hash is offline-attackable, and a six-letter word does not survive that. An
-- attacker holding the session would otherwise walk away with a wordlist target
-- rather than a rate-limited guess.
revoke select (recovery_keyword_hash) on public.users from authenticated, anon;

comment on column public.users.recovery_keyword_hash is
  'scrypt$N$r$p$salt$hash of the memory word that gates recovery-key generation. Never returned to any client — see the revoked SELECT above. Set on the first generation and required for every one after.';
comment on column public.users.recovery_keyword_set_at is
  'When the memory word was last set. Its presence is the only thing a client learns about the word.';
