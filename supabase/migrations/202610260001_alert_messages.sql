-- Mensagens de alerta: guarda o texto enviado e remove a função de pausar alertas.

-- Conteúdo exato de cada envio, exibido na página Mensagens.
alter table public.notification_log
  add column if not exists title text,
  add column if not exists body text;

alter table public.notification_log drop constraint if exists notification_log_message_length;
alter table public.notification_log add constraint notification_log_message_length check (
  (title is null or char_length(title) <= 200)
  and (body is null or char_length(body) <= 1000)
);

-- Pausar alertas foi removido: nenhuma regra ou conta deve continuar silenciada pelas flags antigas.
update public.alert_rules set enabled = true where enabled = false;
update public.profiles set notifications_paused = false where notifications_paused = true;
