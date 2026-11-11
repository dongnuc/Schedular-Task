-- Schedular: schema chính (profiles, tasks, task_occurrences, notification_log)

-- ---------------------------------------------------------------------------
-- profiles: cấu hình riêng của từng người dùng (Telegram, múi giờ)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  telegram_chat_id text,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  notify_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Múi giờ sai sẽ báo lỗi ngay khi lưu (tránh làm hỏng job gửi thông báo)
  constraint profiles_timezone_valid check ((now() at time zone timezone) is not null)
);

-- ---------------------------------------------------------------------------
-- tasks: định nghĩa công việc (một lần hoặc lặp lại)
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  color text not null default 'blue',
  priority smallint not null default 2 check (priority between 1 and 3), -- 1 thấp, 2 vừa, 3 cao
  start_date date not null,
  start_time time,          -- null = công việc cả ngày (không thông báo)
  end_time time,
  recurrence_type text not null default 'none'
    check (recurrence_type in ('none', 'daily', 'weekly', 'monthly')),
  recurrence_interval int not null default 1 check (recurrence_interval >= 1),
  recurrence_days smallint[] not null default '{}', -- ISO weekday 1=T2 .. 7=CN (dùng cho weekly)
  recurrence_end date,
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or start_time is not null),
  check (recurrence_end is null or recurrence_end >= start_date)
);

create index tasks_user_idx on public.tasks (user_id, start_date);

-- ---------------------------------------------------------------------------
-- task_occurrences: kết quả thực hiện của công việc trong một ngày cụ thể
-- ---------------------------------------------------------------------------
create table public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurrence_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done', 'skipped')),
  progress smallint not null default 0 check (progress between 0 and 100),
  result_note text,
  rating smallint check (rating between 1 and 5),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, occurrence_date)
);

create index task_occurrences_user_date_idx
  on public.task_occurrences (user_id, occurrence_date);

-- ---------------------------------------------------------------------------
-- notification_log: đảm bảo mỗi thông báo chỉ gửi đúng 1 lần
-- ---------------------------------------------------------------------------
create table public.notification_log (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  occurrence_date date not null,
  kind text not null check (kind in ('before', 'start')),
  sent_at timestamptz not null default now(),
  unique (task_id, occurrence_date, kind)
);

-- ---------------------------------------------------------------------------
-- updated_at tự động
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger task_occurrences_set_updated_at before update on public.task_occurrences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tự tạo profile khi có user mới
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill cho user đã tồn tại trước migration
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security: mỗi người chỉ thấy dữ liệu của chính mình
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_occurrences enable row level security;
alter table public.notification_log enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "tasks_all_own" on public.tasks
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "task_occurrences_all_own" on public.task_occurrences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and t.user_id = (select auth.uid())
    )
  );

create policy "notification_log_select_own" on public.notification_log
  for select to authenticated using (user_id = (select auth.uid()));

-- Quyền bảng: cấp tường minh (không phụ thuộc default privileges của project)
revoke all on public.profiles, public.tasks, public.task_occurrences, public.notification_log
  from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.tasks, public.task_occurrences to authenticated;
grant select on public.notification_log to authenticated;
