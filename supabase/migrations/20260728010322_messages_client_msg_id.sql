-- Client-generated id per sent chat message, enabling safe retries: a resend
-- of the same turn (network flake, outbox flush) upserts onto the same row
-- instead of duplicating the student's message.
alter table learning.messages add column if not exists client_msg_id uuid;

create unique index if not exists messages_client_msg_id_uniq
  on learning.messages (conversation_id, client_msg_id)
  where client_msg_id is not null;
