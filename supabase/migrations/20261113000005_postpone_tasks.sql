-- Gia hạn việc sang ngày khác.
--  - Việc gốc chuyển trạng thái 'postponed' (không tính vào tỷ lệ hoàn thành, không báo quá hạn)
--    và ghi rõ postponed_to = ngày được gia hạn sang.
--  - Ngày đích nhận một việc mới (một lần) có carried_from = ngày gốc, để hiển thị "Gia hạn từ ngày …".

-- 1) Trạng thái mới
alter table public.task_occurrences drop constraint task_occurrences_status_check;
alter table public.task_occurrences
  add constraint task_occurrences_status_check
  check (status in ('pending', 'in_progress', 'done', 'skipped', 'postponed'));

alter table public.task_occurrences add column postponed_to date;
alter table public.task_occurrences
  add constraint task_occurrences_postponed_to_check
  check (postponed_to is null or status = 'postponed');

-- 2) Nguồn gốc việc được gia hạn
alter table public.tasks
  add column carried_from date,
  add column origin_task_id uuid references public.tasks (id) on delete set null;

-- 3) Bot: việc đã gia hạn được coi như "bỏ qua" (không quá hạn, không tính vào tỷ lệ)
create or replace function public.bot_items(p_user uuid, p_tz text, p_from date, p_to date)
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
           case when o.status = 'postponed' then 'skipped'
                else coalesce(o.status, 'pending') end as status,
           coalesce(o.progress, 0)::int as progress
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

-- 4) Hàm gia hạn (chạy với quyền người dùng, nên RLS vẫn áp dụng)
create function public.postpone_occurrence(p_task_id uuid, p_date date, p_target date)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  t public.tasks;
  v_status text;
  v_new uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_target <= p_date then raise exception 'target_must_be_after_date'; end if;

  select * into t from public.tasks where id = p_task_id and user_id = auth.uid();
  if not found then raise exception 'task_not_found'; end if;
  if not public.task_occurs_on(t, p_date) then raise exception 'task_not_on_date'; end if;

  select status into v_status from public.task_occurrences
   where task_id = p_task_id and occurrence_date = p_date;
  if v_status = 'done' then raise exception 'already_done'; end if;

  insert into public.task_occurrences
    (task_id, user_id, occurrence_date, status, progress, postponed_to)
  values
    (p_task_id, auth.uid(), p_date, 'postponed', 0, p_target)
  on conflict (task_id, occurrence_date) do update
    set status = 'postponed', progress = 0, postponed_to = excluded.postponed_to, completed_at = null;

  insert into public.tasks
    (user_id, title, description, color, priority, start_date, start_time, end_time,
     recurrence_type, recurrence_interval, recurrence_days, recurrence_end, notify,
     carried_from, origin_task_id)
  values
    (auth.uid(), t.title, t.description, t.color, t.priority, p_target, t.start_time, t.end_time,
     'none', 1, '{}', null, t.notify, p_date, t.id)
  returning id into v_new;

  return v_new;
end;
$$;

revoke execute on function public.postpone_occurrence(uuid, date, date) from public, anon;
grant execute on function public.postpone_occurrence(uuid, date, date) to authenticated;
