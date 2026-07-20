# Attachments in the chat thread

Ties an uploaded document to the **message it was sent with**, so it renders
inside the bubble (like a mainstream AI chat) instead of as a conversation-wide
chip, and can be previewed in place.

Applies to all four surfaces: solo `/chat`, a room's group channel, a room's
private RAYA channel, and the room Files tab.

- **Presentation only.** The document context handed to RAYA stays
  conversation-wide (every doc, every turn — `buildRayaMessages(..., docs)`).
  `message_id` says *where to render* the file, not *when to inject* it.
- The link is written server-side with `createAdminClient()`, so neither table
  needs an RLS `UPDATE` policy.
- `on delete set null`: purging a conversation must not break the file row, and
  a file that outlives its message degrades to an unattached upload.

Until the SQL below is applied, uploads still work but the file never leaves the
composer — the `message_id` column is missing, so nothing can be attached.

## SQL to apply in Supabase (once)

```sql
alter table learning.conversation_files
  add column if not exists message_id uuid
  references learning.messages(id) on delete set null;
create index if not exists conversation_files_message_idx
  on learning.conversation_files (message_id);

alter table learning.room_files
  add column if not exists message_id uuid
  references learning.room_messages(id) on delete set null;
create index if not exists room_files_message_idx
  on learning.room_files (message_id);

grant update on learning.conversation_files to service_role;
grant update on learning.room_files to service_role;
```

> The explicit `grant update` is not decorative. `docs/chat-docs.md` only grants
> `select, insert, delete` to `authenticated, anon`, and a schema's default
> privileges do not reach tables created outside the window in which they were
> set — that is exactly how `schools.subjects` ended up unreadable by
> `service_role` while every one of its sibling tables worked.

After applying, confirm the column landed:

```sql
select column_name from information_schema.columns
 where table_schema = 'learning'
   and table_name in ('conversation_files', 'room_files')
   and column_name = 'message_id';
```

Two rows means both tables are ready.
