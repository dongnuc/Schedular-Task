// Webhook của bot Telegram dùng chung. Telegram gọi hàm này mỗi khi có người nhắn bot.
// Việc xác thực (secret token) và ghi DB nằm trong SQL: public.handle_telegram_start.
// Hàm này không cần secret riêng: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY được Supabase tự cấp.

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')

  const secret = req.headers.get('x-telegram-bot-api-secret-token') ?? ''
  let update: { message?: { text?: string; chat?: { id?: number; type?: string } } }
  try {
    update = await req.json()
  } catch {
    return new Response('ok')
  }

  const text = update.message?.text?.trim() ?? ''
  const chat = update.message?.chat
  // Chỉ xử lý lệnh /start trong chat riêng; luôn trả 200 để Telegram không gửi lại.
  if (!chat?.id || chat.type !== 'private' || !/^\/start(@\w+)?(\s|$)/.test(text)) {
    return new Response('ok')
  }
  const code = text.split(/\s+/)[1] ?? ''

  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/handle_telegram_start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ p_secret: secret, p_chat_id: String(chat.id), p_code: code }),
  })
  if (!res.ok) console.error('handle_telegram_start failed', res.status, await res.text())

  return new Response('ok')
})
