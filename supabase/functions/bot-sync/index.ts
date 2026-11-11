// "Triển khai lên bot": đẩy danh sách lệnh đang bật lên menu gợi ý của Telegram (setMyCommands),
// chỉ cho chat của tài khoản admin. Chỉ admin mới gọi được (kiểm tra bằng public.is_bot_admin()).
// Token bot nằm trong Vault, hàm lấy qua RPC bot_sync_payload (chỉ service_role).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function rpc(name: string, headers: Record<string, string>, args: unknown = {}) {
  return await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(args),
  })
}

async function telegram(token: string, method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await res.json()) as { ok: boolean; description?: string }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const userAuth = req.headers.get('Authorization') ?? ''
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const svc = { apikey: service, Authorization: `Bearer ${service}` }

  // 1) Chỉ admin
  const check = await rpc('is_bot_admin', { apikey: Deno.env.get('SUPABASE_ANON_KEY')!, Authorization: userAuth })
  if (!check.ok || (await check.json()) !== true) return json({ error: 'forbidden' }, 403)

  // 2) Lấy token, chat id admin và danh sách lệnh
  const payloadRes = await rpc('bot_sync_payload', svc)
  if (!payloadRes.ok) return json({ error: 'payload_failed' }, 500)
  const payload = (await payloadRes.json()) as {
    token: string | null
    chat_id: string | null
    hash: string
    commands: { command: string; description: string }[]
  }
  if (!payload.token) return json({ error: 'missing_bot_token' }, 400)
  if (!payload.chat_id) return json({ error: 'missing_chat_id' }, 400)

  // 3) Menu chỉ hiện trong chat của admin; xoá menu mặc định để người khác không thấy.
  const scoped = await telegram(payload.token, 'setMyCommands', {
    commands: payload.commands.slice(0, 100),
    scope: { type: 'chat', chat_id: Number(payload.chat_id) },
  })
  if (!scoped.ok) return json({ error: 'telegram_error', description: scoped.description }, 502)
  await telegram(payload.token, 'deleteMyCommands', {})

  // 4) Ghi nhận đã đồng bộ
  await rpc('bot_mark_synced', svc, { p_hash: payload.hash })
  return json({ ok: true, count: payload.commands.length })
})
