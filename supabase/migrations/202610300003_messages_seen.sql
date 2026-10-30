-- Contador de mensagens não lidas: quando o usuário abriu a página Mensagens pela última vez.
-- Não lidas = envios com result 'sent' e sent_at posterior a messages_seen_at.
-- A linha de profiles já é do próprio usuário (policy "Users manage their profile"),
-- então nenhuma policy nova é necessária.
alter table public.profiles add column if not exists messages_seen_at timestamptz;

create index if not exists notification_log_user_sent_idx
  on public.notification_log (user_id, sent_at desc);
