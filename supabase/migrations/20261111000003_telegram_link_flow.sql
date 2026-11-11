-- Liên kết Telegram bằng deep link: một bot chung cho mọi user.
-- Luồng: app tạo mã -> user mở t.me/<bot>?start=<mã> -> bot gửi webhook
-- -> Edge Function gọi handle_telegram_start() -> lưu telegram_chat_id.
-- Cần 2 secret trong Vault (không nằm trong migration):
--   telegram_bot_token      : token từ @BotFather
--   telegram_webhook_secret : chuỗi ngẫu nhiên, đặt cùng giá trị khi setWebhook

alter table public.profiles
  add column telegram_link_code text unique,
  add column telegram_link_expires_at timestamptz;

-- User chỉ được tự sửa múi giờ / bật-tắt thông báo; chat id đi qua RPC bên dưới.
revoke update on public.profiles from authenticated;
grant update (timezone, notify_enabled) on public.profiles to authenticated;

-- Tạo mã liên kết dùng 1 lần, hạn 15 phút
create function public.create_telegram_link_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.profiles
     set telegram_link_code = v_code,
         telegram_link_expires_at = now() + interval '15 minutes'
   where id = auth.uid();
  return v_code;
end;
$$;

create function public.disconnect_telegram()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set telegram_chat_id = null,
         telegram_link_code = null,
         telegram_link_expires_at = null
   where id = auth.uid();
end;
$$;

-- Edge Function gọi khi bot nhận tin /start [mã]
create function public.handle_telegram_start(p_secret text, p_chat_id text, p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text;
  v_user uuid;
begin
  select decrypted_secret into v_expected
  from vault.decrypted_secrets where name = 'telegram_webhook_secret' limit 1;

  if v_expected is null or p_secret is distinct from v_expected then
    return 'forbidden';
  end if;

  if coalesce(p_code, '') = '' then
    perform public.send_telegram_message(p_chat_id,
      E'👋 Xin chào! Để nhận thông báo, hãy vào Schedular → Cài đặt → bấm "Kết nối Telegram".');
    return 'no_code';
  end if;

  update public.profiles
     set telegram_chat_id = p_chat_id,
         telegram_link_code = null,
         telegram_link_expires_at = null
   where telegram_link_code = p_code
     and telegram_link_expires_at > now()
  returning id into v_user;

  if v_user is null then
    perform public.send_telegram_message(p_chat_id,
      E'⚠️ Mã liên kết không hợp lệ hoặc đã hết hạn. Hãy bấm "Kết nối Telegram" lại trong Schedular.');
    return 'invalid_code';
  end if;

  -- Một chat chỉ gắn với một tài khoản
  update public.profiles set telegram_chat_id = null
   where telegram_chat_id = p_chat_id and id <> v_user;

  perform public.send_telegram_message(p_chat_id,
    E'✅ Đã kết nối Schedular! Bạn sẽ nhận nhắc việc trước 30 phút và đúng giờ bắt đầu.');
  return 'ok';
end;
$$;

revoke execute on function public.create_telegram_link_code() from public, anon;
revoke execute on function public.disconnect_telegram() from public, anon;
grant execute on function public.create_telegram_link_code() to authenticated;
grant execute on function public.disconnect_telegram() to authenticated;
revoke execute on function public.handle_telegram_start(text, text, text) from public, anon, authenticated;
grant execute on function public.handle_telegram_start(text, text, text) to service_role;
