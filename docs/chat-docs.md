# Documents in RAYA chat

Lets a student attach documents to a **solo** RAYA conversation the same way a
room already has shared files. The extracted text is stored on the row so RAYA
can use it as context on every turn (`app/api/raya/chat` injects it into the
prompt via `buildRayaMessages(..., docs)`).

- Upload: `POST /api/raya/files` (multipart `file`, optional `conversationId`).
  Verifies the conversation belongs to the caller, or creates a new solo
  conversation so a document can open a fresh chat. Extracts text
  (`lib/extract.ts`), stores the file in the private `user-media` bucket, and
  writes a `learning.conversation_files` row.
- Context: on each solo turn the chat route reads this conversation's files;
  in the **private-room RAYA channel** it reads `learning.room_files` instead,
  so RAYA also draws on the room's shared documents.
- The client lists attachments directly under RLS (`components/chat.tsx`), like
  `components/room-files.tsx` does for rooms.

Until the SQL below is applied the feature degrades gracefully: the chat route
ignores the missing table (no doc context), and uploads return an error.

## SQL to apply in Supabase (once)

```sql
-- Documents attached to a solo RAYA conversation (mirrors learning.room_files).
create table if not exists learning.conversation_files (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references learning.conversations(id) on delete cascade,
  file_name       text,
  file_path       text,
  file_url        text,
  file_type       text,
  mime_type       text,
  file_size       bigint,
  uploader_id     uuid references public.users(id) on delete set null,
  content         text,
  created_at      timestamptz not null default now()
);

create index if not exists conversation_files_conversation_idx
  on learning.conversation_files (conversation_id);

alter table learning.conversation_files enable row level security;

-- The owner of the parent conversation owns its files (read + manage).
create policy conv_files_owner_select on learning.conversation_files
  for select using (
    exists (
      select 1 from learning.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );
create policy conv_files_owner_insert on learning.conversation_files
  for insert with check (
    exists (
      select 1 from learning.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );
create policy conv_files_owner_delete on learning.conversation_files
  for delete using (
    exists (
      select 1 from learning.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

grant usage on schema learning to authenticated, anon;
grant select, insert, delete on learning.conversation_files to authenticated, anon;
```

> Anonymous-first: grants include `anon` so anonymous students can attach docs
> too. The upload route runs as the signed-in user, so RLS is the write path
> here (not a service-role bypass).
