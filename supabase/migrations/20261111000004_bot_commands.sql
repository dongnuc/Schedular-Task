-- Lệnh bot Telegram dành riêng cho tài khoản quản trị.
-- Danh sách lệnh nằm trong bảng bot_commands (quản lý ở trang web); bot đọc trực tiếp
-- từ đây nên đổi lệnh có hiệu lực ngay. Nút "Triển khai" chỉ đồng bộ menu gợi ý của Telegram.
--
-- Email quản trị KHÔNG nằm trong migration, đặt trong Vault:
--   select vault.create_secret('<email>', 'bot_admin_email');

-- ---------------------------------------------------------------------------
-- Bảng
-- ---------------------------------------------------------------------------
create table public.bot_commands (
  id uuid primary key default gen_random_uuid(),
  command text not null unique check (command ~ '^[a-z][a-z0-9_]{0,31}$'),
  description text not null check (char_length(description) between 1 and 256),
  action text not null check (action in (
    'today', 'tomorrow', 'week', 'next', 'pending', 'overdue',
    'done', 'stats_week', 'stats_month', 'help', 'text'
  )),
  reply_text text check (reply_text is null or char_length(reply_text) <= 3500),
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bot_commands_text_needs_reply check (action <> 'text' or coalesce(reply_text, '') <> '')
);

create trigger bot_commands_set_updated_at before update on public.bot_commands
  for each row execute function public.set_updated_at();

-- Trạng thái đồng bộ menu Telegram (1 dòng). Chỉ truy cập qua hàm.
create table public.bot_sync (
  id int primary key check (id = 1),
  synced_hash text,
  synced_at timestamptz
);
alter table public.bot_sync enable row level security;
revoke all on public.bot_sync from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Quyền quản trị: user có email trùng secret 'bot_admin_email' trong Vault
-- ---------------------------------------------------------------------------
create function public.bot_is_admin_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join vault.decrypted_secrets s on s.name = 'bot_admin_email'
    where u.id = p_user and lower(u.email) = lower(trim(s.decrypted_secret))
  );
$$;

create function public.is_bot_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.bot_is_admin_user((select auth.uid()));
$$;

alter table public.bot_commands enable row level security;
create policy "bot_commands_admin_all" on public.bot_commands
  for all to authenticated
  using ((select public.is_bot_admin()))
  with check ((select public.is_bot_admin()));

revoke all on public.bot_commands from anon, authenticated;
grant select, insert, update, delete on public.bot_commands to authenticated;

-- ---------------------------------------------------------------------------
-- Dữ liệu công việc theo ngày (dùng chung cho các lệnh)
-- ---------------------------------------------------------------------------
create function public.bot_items(p_user uuid, p_tz text, p_from date, p_to date)
returns table (
  day date, idx int, task_id uuid, title text, start_time time, end_time time,
  status text, progress int, overdue boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with now_local as (select (now() at time zone p_tz) as ts),
  base as (
    select d.day::date as day, t.id as task_id, t.title, t.start_time, t.end_time, t.priority,
           coalesce(o.status, 'pending') as status, coalesce(o.progress, 0)::int as progress
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d (day)
    join public.tasks t on t.user_id = p_user and public.task_occurs_on(t, d.day::date)
    left join public.task_occurrences o
      on o.task_id = t.id and o.occurrence_date = d.day::date
  )
  select
    b.day,
    (row_number() over (
      partition by b.day order by b.start_time nulls first, b.priority desc, b.title, b.task_id
    ))::int as idx,
    b.task_id, b.title, b.start_time, b.end_time, b.status, b.progress,
    (b.status in ('pending', 'in_progress') and (
      b.day < (select ts::date from now_local)
      or (
        b.day = (select ts::date from now_local)
        and coalesce(b.end_time, b.start_time) is not null
        and coalesce(b.end_time, b.start_time) < (select ts::time from now_local)
      )
    )) as overdue
  from base b
  order by b.day, idx;
$$;

create function public.bot_weekday_name(p_date date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'])
    [extract(dow from p_date)::int + 1];
$$;

create function public.bot_fmt_item(
  p_idx int, p_title text, p_start time, p_end time,
  p_status text, p_progress int, p_overdue boolean, p_numbered boolean
)
returns text
language sql
stable
set search_path = ''
as $$
  select
    case when p_numbered then p_idx::text || '. ' else '• ' end
    || case
         when p_status = 'done' then '✅'
         when p_status = 'skipped' then '⏭️'
         when p_overdue then '⚠️'
         when p_status = 'in_progress' then '🔄'
         else '⬜'
       end
    || ' '
    || case when p_start is null then ''
            else to_char(p_start, 'HH24:MI') || coalesce('–' || to_char(p_end, 'HH24:MI'), '') || ' ' end
    || p_title
    || case when p_status = 'in_progress' then ' (' || p_progress::text || '%)' else '' end;
$$;

create function public.bot_day_text(p_user uuid, p_tz text, p_date date, p_numbered boolean)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
  v_lines text := '';
  v_total int := 0;
  v_done int := 0;
  v_head text;
begin
  for r in select * from public.bot_items(p_user, p_tz, p_date, p_date) loop
    v_total := v_total + 1;
    if r.status = 'done' then v_done := v_done + 1; end if;
    v_lines := v_lines || public.bot_fmt_item(
      r.idx, r.title, r.start_time, r.end_time, r.status, r.progress, r.overdue, p_numbered
    ) || E'\n';
  end loop;

  v_head := '📅 ' || public.bot_weekday_name(p_date) || ' ' || to_char(p_date, 'DD/MM/YYYY');
  if v_total = 0 then
    return v_head || E'\nKhông có công việc nào.';
  end if;
  return v_head || ' — ' || v_done::text || '/' || v_total::text || E' xong\n' || rtrim(v_lines, E'\n');
end;
$$;

-- ---------------------------------------------------------------------------
-- Thực thi một hành động. p_dry = true: chỉ xem trước, không thay đổi dữ liệu.
-- ---------------------------------------------------------------------------
create function public.bot_execute(
  p_user uuid, p_cmd text, p_action text, p_reply text, p_arg text, p_dry boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_now timestamp;
  v_today date;
  v_from date;
  v_to date;
  v_cur date;
  r record;
  v_out text := '';
  v_n int := 0;
  v_total int;
  v_done int;
  v_doing int;
  v_skipped int;
  v_overdue int;
  v_rem int;
  v_txt text;
begin
  select timezone into v_tz from public.profiles where id = p_user;
  v_tz := coalesce(v_tz, 'Asia/Ho_Chi_Minh');
  v_now := now() at time zone v_tz;
  v_today := v_now::date;

  if p_action = 'text' then
    return coalesce(p_reply, '');

  elsif p_action = 'help' then
    select string_agg('/' || command || ' – ' || description, E'\n' order by sort_order, command)
      into v_out from public.bot_commands where enabled;
    return E'🤖 Các lệnh TaskEasy:\n' || coalesce(v_out, '(chưa có lệnh nào)');

  elsif p_action in ('today', 'tomorrow') then
    return public.bot_day_text(
      p_user, v_tz, v_today + case when p_action = 'tomorrow' then 1 else 0 end, true
    );

  elsif p_action = 'pending' then
    for r in select * from public.bot_items(p_user, v_tz, v_today, v_today) b
             where b.status in ('pending', 'in_progress') loop
      v_n := v_n + 1;
      v_out := v_out || public.bot_fmt_item(
        r.idx, r.title, r.start_time, r.end_time, r.status, r.progress, r.overdue, true
      ) || E'\n';
    end loop;
    if v_n = 0 then return '🎉 Hôm nay không còn việc nào chưa xong.'; end if;
    return '📝 Còn ' || v_n::text || E' việc chưa xong hôm nay:\n' || rtrim(v_out, E'\n');

  elsif p_action = 'next' then
    select * into r from public.bot_items(p_user, v_tz, v_today, v_today) b
      where b.status in ('pending', 'in_progress') and b.start_time is not null
        and b.start_time >= v_now::time
      order by b.start_time limit 1;
    if found then
      return E'⏭️ Việc tiếp theo (còn ' ||
        greatest(0, (extract(epoch from (r.start_time - v_now::time)) / 60)::int)::text || E' phút):\n' ||
        public.bot_fmt_item(r.idx, r.title, r.start_time, r.end_time, r.status, r.progress, r.overdue, true);
    end if;
    select count(*) into v_rem from public.bot_items(p_user, v_tz, v_today, v_today) b
      where b.status in ('pending', 'in_progress');
    if v_rem = 0 then return '🎉 Hôm nay không còn việc nào.'; end if;
    return 'Không còn việc nào sắp tới theo giờ. Còn ' || v_rem::text || ' việc chưa xong hôm nay.';

  elsif p_action = 'week' then
    v_from := date_trunc('week', v_today::timestamp)::date;
    v_to := v_from + 6;
    select count(*) filter (where status <> 'skipped'), count(*) filter (where status = 'done')
      into v_total, v_done from public.bot_items(p_user, v_tz, v_from, v_to);
    v_out := '🗓️ Tuần ' || to_char(v_from, 'DD/MM') || ' – ' || to_char(v_to, 'DD/MM/YYYY') ||
      ': ' || v_done::text || '/' || v_total::text || ' xong' ||
      case when v_total > 0 then ' (' || round(100.0 * v_done / v_total)::int::text || '%)' else '' end;
    if v_total = 0 then
      return v_out || E'\nKhông có công việc nào trong tuần.';
    end if;
    for v_cur in select d::date from generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') d loop
      if exists (select 1 from public.bot_items(p_user, v_tz, v_cur, v_cur)) then
        v_out := v_out || E'\n\n' || public.bot_day_text(p_user, v_tz, v_cur, false);
      end if;
    end loop;
    return v_out;

  elsif p_action = 'overdue' then
    for r in select * from public.bot_items(p_user, v_tz, v_today - 7, v_today) b where b.overdue loop
      v_n := v_n + 1;
      v_out := v_out || to_char(r.day, 'DD/MM') || ' ' || public.bot_fmt_item(
        r.idx, r.title, r.start_time, r.end_time, r.status, r.progress, r.overdue, false
      ) || E'\n';
    end loop;
    if v_n = 0 then return '🎉 Không có việc quá hạn trong 7 ngày gần đây.'; end if;
    return '⚠️ ' || v_n::text || E' việc quá hạn (7 ngày gần đây):\n' || rtrim(v_out, E'\n');

  elsif p_action in ('stats_week', 'stats_month') then
    if p_action = 'stats_week' then
      v_from := date_trunc('week', v_today::timestamp)::date;
      v_to := v_from + 6;
      v_txt := 'tuần ' || to_char(v_from, 'DD/MM') || ' – ' || to_char(v_to, 'DD/MM');
    else
      v_from := date_trunc('month', v_today::timestamp)::date;
      v_to := (v_from + interval '1 month - 1 day')::date;
      v_txt := 'tháng ' || to_char(v_from, 'MM/YYYY');
    end if;
    select count(*) filter (where status <> 'skipped'),
           count(*) filter (where status = 'done'),
           count(*) filter (where status = 'in_progress'),
           count(*) filter (where status = 'skipped'),
           count(*) filter (where overdue)
      into v_total, v_done, v_doing, v_skipped, v_overdue
      from public.bot_items(p_user, v_tz, v_from, v_to);
    if v_total = 0 and v_skipped = 0 then
      return '📊 Thống kê ' || v_txt || E'\nChưa có công việc nào.';
    end if;
    return '📊 Thống kê ' || v_txt ||
      E'\nTỷ lệ hoàn thành: ' || coalesce(round(100.0 * v_done / nullif(v_total, 0))::int, 0)::text ||
      '% (' || v_done::text || '/' || v_total::text || E' việc)' ||
      E'\nĐang thực hiện: ' || v_doing::text ||
      E'\nQuá hạn: ' || v_overdue::text ||
      E'\nBỏ qua: ' || v_skipped::text;

  elsif p_action = 'done' then
    if coalesce(trim(p_arg), '') !~ '^[0-9]{1,4}$' then
      return E'Cú pháp: /' || p_cmd || E' <số thứ tự>\nSố thứ tự lấy từ danh sách việc hôm nay.';
    end if;
    select * into r from public.bot_items(p_user, v_tz, v_today, v_today) b where b.idx = trim(p_arg)::int;
    if not found then
      return 'Hôm nay không có việc số ' || trim(p_arg) || '.';
    end if;
    if r.status = 'done' then
      return 'Việc "' || r.title || '" đã hoàn thành từ trước.';
    end if;
    if p_dry then
      return '(Chạy thử, không thay đổi dữ liệu) Sẽ đánh dấu hoàn thành: ' || r.title;
    end if;
    insert into public.task_occurrences (task_id, user_id, occurrence_date, status, progress, completed_at)
    values (r.task_id, p_user, v_today, 'done', 100, now())
    on conflict (task_id, occurrence_date)
    do update set status = 'done', progress = 100, completed_at = now();
    select count(*) into v_rem from public.bot_items(p_user, v_tz, v_today, v_today) b
      where b.status in ('pending', 'in_progress');
    return '✅ Đã hoàn thành: ' || r.title || E'\n' ||
      case when v_rem = 0 then '🎉 Hôm nay đã xong hết việc!'
           else 'Còn ' || v_rem::text || ' việc chưa xong.' end;
  end if;

  return 'Hành động không được hỗ trợ.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Webhook gọi khi có người nhắn lệnh cho bot
-- ---------------------------------------------------------------------------
create function public.handle_telegram_command(
  p_secret text, p_chat_id text, p_command text, p_args text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text;
  v_user uuid;
  v_cmd public.bot_commands;
  v_reply text;
begin
  select decrypted_secret into v_expected
  from vault.decrypted_secrets where name = 'telegram_webhook_secret' limit 1;
  if v_expected is null or p_secret is distinct from v_expected then
    return 'forbidden';
  end if;

  select id into v_user from public.profiles where telegram_chat_id = p_chat_id limit 1;
  if v_user is null then
    perform public.send_telegram_message(p_chat_id,
      E'Tài khoản Telegram này chưa liên kết. Vào TaskEasy → Cài đặt → Kết nối Telegram.');
    return 'not_linked';
  end if;

  if not public.bot_is_admin_user(v_user) then
    perform public.send_telegram_message(p_chat_id, 'Các lệnh bot hiện chỉ dành cho quản trị viên.');
    return 'not_admin';
  end if;

  select * into v_cmd from public.bot_commands
   where command = lower(p_command) and enabled;
  if not found then
    perform public.send_telegram_message(p_chat_id,
      '❓ Lệnh /' || left(lower(p_command), 32) || E' không tồn tại hoặc đang tắt.\nGõ /help để xem danh sách lệnh.');
    return 'unknown_command';
  end if;

  v_reply := public.bot_execute(v_user, v_cmd.command, v_cmd.action, v_cmd.reply_text, p_args, false);
  perform public.send_telegram_message(p_chat_id, left(v_reply, 3900));
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC cho trang web (chỉ admin)
-- ---------------------------------------------------------------------------
create function public.bot_preview_command(p_command text, p_arg text default '')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmd public.bot_commands;
begin
  if not public.is_bot_admin() then
    raise exception 'forbidden';
  end if;
  select * into v_cmd from public.bot_commands where command = lower(p_command);
  if not found then
    return 'Lệnh không tồn tại.';
  end if;
  return left(public.bot_execute(auth.uid(), v_cmd.command, v_cmd.action, v_cmd.reply_text, p_arg, true), 3900);
end;
$$;

create function public.bot_commands_hash()
returns text
language sql
stable
set search_path = ''
as $$
  select md5(coalesce(
    string_agg(command || '|' || description, E'\n' order by sort_order, command), ''
  ))
  from public.bot_commands where enabled;
$$;

create function public.bot_sync_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_at timestamptz;
begin
  if not public.is_bot_admin() then
    raise exception 'forbidden';
  end if;
  select synced_hash, synced_at into v_hash, v_at from public.bot_sync where id = 1;
  return jsonb_build_object(
    'synced', coalesce(v_hash = public.bot_commands_hash(), false),
    'synced_at', v_at
  );
end;
$$;

-- Dùng bởi Edge Function bot-sync (service_role)
create function public.bot_sync_payload()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'token', (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1),
    'chat_id', (
      select p.telegram_chat_id
      from public.profiles p
      join auth.users u on u.id = p.id
      join vault.decrypted_secrets s on s.name = 'bot_admin_email'
      where lower(u.email) = lower(trim(s.decrypted_secret))
      limit 1
    ),
    'hash', public.bot_commands_hash(),
    'commands', coalesce((
      select jsonb_agg(jsonb_build_object('command', command, 'description', description)
                       order by sort_order, command)
      from public.bot_commands where enabled
    ), '[]'::jsonb)
  );
$$;

create function public.bot_mark_synced(p_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.bot_sync (id, synced_hash, synced_at) values (1, p_hash, now())
  on conflict (id) do update set synced_hash = excluded.synced_hash, synced_at = excluded.synced_at;
$$;

-- ---------------------------------------------------------------------------
-- Quyền thực thi
-- ---------------------------------------------------------------------------
revoke execute on function
  public.bot_is_admin_user(uuid),
  public.bot_items(uuid, text, date, date),
  public.bot_weekday_name(date),
  public.bot_fmt_item(int, text, time, time, text, int, boolean, boolean),
  public.bot_day_text(uuid, text, date, boolean),
  public.bot_execute(uuid, text, text, text, text, boolean),
  public.handle_telegram_command(text, text, text, text),
  public.bot_preview_command(text, text),
  public.bot_commands_hash(),
  public.bot_sync_status(),
  public.bot_sync_payload(),
  public.bot_mark_synced(text),
  public.is_bot_admin()
from public, anon, authenticated;

grant execute on function public.is_bot_admin() to authenticated;
grant execute on function public.bot_preview_command(text, text) to authenticated;
grant execute on function public.bot_sync_status() to authenticated;
grant execute on function public.handle_telegram_command(text, text, text, text) to service_role;
grant execute on function public.bot_sync_payload() to service_role;
grant execute on function public.bot_mark_synced(text) to service_role;
-- bot_commands_hash() được gọi trong RLS-less context của hàm security definer; policy dùng is_bot_admin().

-- ---------------------------------------------------------------------------
-- Lệnh mặc định (admin có thể sửa/tắt/xoá trên web)
-- ---------------------------------------------------------------------------
insert into public.bot_commands (command, description, action, sort_order) values
  ('today',    'Công việc hôm nay',                         'today',       10),
  ('tomorrow', 'Công việc ngày mai',                        'tomorrow',    20),
  ('week',     'Công việc cả tuần này',                     'week',        30),
  ('next',     'Việc tiếp theo cần làm',                    'next',        40),
  ('pending',  'Việc chưa xong hôm nay',                    'pending',     50),
  ('overdue',  'Việc quá hạn (7 ngày gần đây)',             'overdue',     60),
  ('done',     'Đánh dấu hoàn thành: /done <số thứ tự>',    'done',        70),
  ('stats',    'Thống kê tuần này',                         'stats_week',  80),
  ('month',    'Thống kê tháng này',                        'stats_month', 90),
  ('help',     'Danh sách các lệnh',                        'help',        100);
