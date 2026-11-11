-- Schedular: thông báo Telegram (trước 30 phút + đúng giờ bắt đầu)
-- Chạy hoàn toàn trong Postgres: pg_cron (mỗi phút) -> pg_net -> Telegram Bot API.
-- Bot token lưu trong Supabase Vault với tên 'telegram_bot_token' (KHÔNG nằm trong migration):
--   select vault.create_secret('<BOT_TOKEN>', 'telegram_bot_token');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Công việc t có diễn ra vào ngày d không? (logic phải khớp src/lib/recurrence.ts)
-- ---------------------------------------------------------------------------
create function public.task_occurs_on(t public.tasks, d date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    d >= t.start_date
    and (t.recurrence_end is null or d <= t.recurrence_end)
    and case t.recurrence_type
      when 'none' then d = t.start_date
      when 'daily' then (d - t.start_date) % t.recurrence_interval = 0
      when 'weekly' then
        extract(isodow from d)::int = any (
          case when cardinality(t.recurrence_days) = 0
            then array[extract(isodow from t.start_date)::smallint]
            else t.recurrence_days
          end
        )
        and ((date_trunc('week', d::timestamp)::date - date_trunc('week', t.start_date::timestamp)::date) / 7)
            % t.recurrence_interval = 0
      when 'monthly' then
        extract(day from d)::int = least(
          extract(day from t.start_date)::int,
          extract(day from (date_trunc('month', d::timestamp) + interval '1 month - 1 day'))::int
        )
        and (
          (extract(year from d)::int - extract(year from t.start_date)::int) * 12
          + extract(month from d)::int - extract(month from t.start_date)::int
        ) % t.recurrence_interval = 0
      else false
    end;
$$;

-- ---------------------------------------------------------------------------
-- Gửi 1 tin nhắn Telegram (bất đồng bộ qua pg_net)
-- ---------------------------------------------------------------------------
create function public.send_telegram_message(p_chat_id text, p_text text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'telegram_bot_token'
  limit 1;

  if v_token is null or p_chat_id is null or p_chat_id = '' then
    return false;
  end if;

  perform net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body := jsonb_build_object('chat_id', p_chat_id, 'text', p_text),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quét và gửi thông báo đến hạn. pg_cron gọi mỗi phút.
--   'before': trong vòng 30 phút trước giờ bắt đầu
--   'start' : từ giờ bắt đầu đến 10 phút sau (bù trừ nếu cron trễ)
-- notification_log (unique) đảm bảo mỗi loại chỉ gửi 1 lần cho mỗi lần diễn ra.
-- ---------------------------------------------------------------------------
create function public.dispatch_task_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_kind text;
  v_text text;
  v_rows int;
  v_sent int := 0;
  v_time text;
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'telegram_bot_token') then
    return 0;
  end if;

  for r in
    select
      t.id as task_id,
      t.user_id,
      t.title,
      t.description,
      t.start_time,
      t.end_time,
      p.telegram_chat_id,
      d.day as occurrence_date,
      ((d.day + t.start_time) at time zone p.timezone) as start_ts
    from public.profiles p
    join public.tasks t on t.user_id = p.id
    cross join lateral (
      values
        ((now() at time zone p.timezone)::date),
        ((now() at time zone p.timezone)::date + 1)
    ) as d (day)
    left join public.task_occurrences o
      on o.task_id = t.id and o.occurrence_date = d.day
    where p.notify_enabled
      and coalesce(p.telegram_chat_id, '') <> ''
      and t.notify
      and t.start_time is not null
      and public.task_occurs_on(t, d.day)
      and coalesce(o.status, 'pending') not in ('done', 'skipped')
      and ((d.day + t.start_time) at time zone p.timezone)
          between now() - interval '10 minutes' and now() + interval '30 minutes'
  loop
    v_kind := case when r.start_ts > now() then 'before' else 'start' end;

    insert into public.notification_log (task_id, user_id, occurrence_date, kind)
    values (r.task_id, r.user_id, r.occurrence_date, v_kind)
    on conflict (task_id, occurrence_date, kind) do nothing;
    get diagnostics v_rows = row_count;

    if v_rows = 1 then
      v_time := to_char(r.start_time, 'HH24:MI')
        || coalesce(' – ' || to_char(r.end_time, 'HH24:MI'), '')
        || ' · ' || to_char(r.occurrence_date, 'DD/MM/YYYY');

      if v_kind = 'before' then
        v_text := '⏰ Sắp đến giờ (còn '
          || greatest(1, ceil(extract(epoch from (r.start_ts - now())) / 60))::int
          || ' phút)';
      else
        v_text := '🚀 Đến giờ bắt đầu!';
      end if;

      v_text := v_text
        || E'\n📌 ' || r.title
        || E'\n🕒 ' || v_time
        || coalesce(E'\n📝 ' || nullif(r.description, ''), '');

      perform public.send_telegram_message(r.telegram_chat_id, v_text);
      v_sent := v_sent + 1;
    end if;
  end loop;

  return v_sent;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC cho nút "Gửi thử" trong trang Cài đặt
-- ---------------------------------------------------------------------------
create function public.send_test_notification()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chat text;
begin
  if auth.uid() is null then
    return 'not_authenticated';
  end if;

  select telegram_chat_id into v_chat from public.profiles where id = auth.uid();
  if coalesce(v_chat, '') = '' then
    return 'missing_chat_id';
  end if;

  if not public.send_telegram_message(
    v_chat,
    E'✅ Schedular đã kết nối Telegram thành công!\nBạn sẽ nhận thông báo trước 30 phút và đúng giờ bắt đầu công việc.'
  ) then
    return 'missing_bot_token';
  end if;

  return 'ok';
end;
$$;

-- Quyền thực thi: chỉ RPC test mở cho người dùng đã đăng nhập
revoke execute on function public.send_telegram_message(text, text) from public, anon, authenticated;
revoke execute on function public.dispatch_task_notifications() from public, anon, authenticated;
revoke execute on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;

-- ---------------------------------------------------------------------------
-- Lịch chạy
-- ---------------------------------------------------------------------------
select cron.schedule(
  'schedular-dispatch-notifications',
  '* * * * *',
  $$select public.dispatch_task_notifications()$$
);

select cron.schedule(
  'schedular-cleanup-notification-log',
  '15 3 * * *',
  $$delete from public.notification_log where sent_at < now() - interval '30 days'$$
);
