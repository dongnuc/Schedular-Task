// Webhook của bot Telegram dùng chung. Telegram gọi hàm này mỗi khi có người nhắn bot.
//  - /start <mã>  : liên kết tài khoản (public.handle_telegram_start)
//  - /<lệnh> ...  : lệnh dành cho admin, đọc từ bảng bot_commands (public.handle_telegram_command)
// Việc xác thực (secret token) và ghi DB nằm trong SQL. Hàm này không cần secret riêng:
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY được Supabase tự cấp.

async function rpc(name: string, args: Record<string, string>) {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(args),
  })
  if (!res.ok) console.error(`${name} failed`, res.status, await res.text())
}

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
  // Chỉ xử lý lệnh trong chat riêng; luôn trả 200 để Telegram không gửi lại.
  if (!chat?.id || chat.type !== 'private') return new Response('ok')

  const m = /^\/([A-Za-z0-9_]{1,32})(?:@\w+)?(?:\s+([\s\S]*))?$/.exec(text)
  if (!m) return new Response('ok')

  const command = m[1].toLowerCase()
  const args = (m[2] ?? '').trim()
  const chatId = String(chat.id)

  if (command === 'start') {
    await rpc('handle_telegram_start', { p_secret: secret, p_chat_id: chatId, p_code: args.split(/\s+/)[0] ?? '' })
  } else {
    await rpc('handle_telegram_command', { p_secret: secret, p_chat_id: chatId, p_command: command, p_args: args })
  }

  return new Response('ok')
})
