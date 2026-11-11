import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

const TIMEZONES = [
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
]

const TEST_RESULT: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: 'Đã gửi yêu cầu tới Telegram. Kiểm tra tin nhắn từ bot trong vài giây.' },
  missing_chat_id: { ok: false, text: 'Chưa lưu Chat ID. Hãy nhập và bấm Lưu trước.' },
  missing_bot_token: {
    ok: false,
    text: "Chưa cấu hình bot token trong Supabase Vault (secret 'telegram_bot_token'). Xem README.",
  },
  not_authenticated: { ok: false, text: 'Phiên đăng nhập đã hết hạn.' },
}

export default function SettingsPage() {
  const { session } = useAuth()
  const userId = session!.user.id
  const [chatId, setChatId] = useState('')
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh')
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setMessage({ ok: false, text: error.message })
        const p = data as Profile | null
        if (p) {
          setChatId(p.telegram_chat_id ?? '')
          setTimezone(p.timezone)
          setEnabled(p.notify_enabled)
        }
        setLoading(false)
      })
  }, [userId])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        telegram_chat_id: chatId.trim() || null,
        timezone,
        notify_enabled: enabled,
      })
      .eq('id', userId)
    setBusy(false)
    setMessage(error ? { ok: false, text: error.message } : { ok: true, text: 'Đã lưu cài đặt.' })
  }

  const sendTest = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('send_test_notification')
    setBusy(false)
    setMessage(
      error
        ? { ok: false, text: error.message }
        : TEST_RESULT[data as string] ?? { ok: false, text: String(data) },
    )
  }

  if (loading) return <p className="text-sm text-slate-500">Đang tải…</p>

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-bold">Cài đặt</h1>

      <form onSubmit={save} className="card space-y-4 p-5">
        <h2 className="font-semibold">Thông báo Telegram</h2>
        <p className="text-sm text-slate-600">
          Mỗi công việc có giờ bắt đầu sẽ được nhắc <strong>2 lần</strong>: trước 30 phút và đúng giờ
          bắt đầu. Việc đã đánh dấu hoàn thành hoặc bỏ qua sẽ không nhắc nữa.
        </p>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Bật thông báo Telegram
        </label>

        <div>
          <label className="label" htmlFor="s-chat">Telegram Chat ID</label>
          <input
            id="s-chat"
            className="input"
            inputMode="numeric"
            placeholder="Ví dụ: 123456789"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="s-tz">Múi giờ</label>
          <select id="s-tz" className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {(TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]).map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        {message && (
          <p className={`text-sm ${message.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{message.text}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy}>Lưu</button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={sendTest}>
            Gửi thử thông báo
          </button>
        </div>
      </form>

      <div className="card p-5 text-sm text-slate-700">
        <h2 className="mb-2 font-semibold text-slate-900">Cách lấy Chat ID</h2>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Mở Telegram, tìm <strong>@BotFather</strong> → gửi <code className="rounded bg-slate-100 px-1">/newbot</code>{' '}
            để tạo bot và nhận <em>bot token</em>.
          </li>
          <li>
            Lưu token vào Supabase Vault (SQL Editor):{' '}
            <code className="break-all rounded bg-slate-100 px-1">
              select vault.create_secret('TOKEN_CỦA_BẠN', 'telegram_bot_token');
            </code>
          </li>
          <li>Mở chat với bot vừa tạo và bấm <strong>Start</strong> (bắt buộc, nếu không bot không nhắn được).</li>
          <li>
            Nhắn cho <strong>@userinfobot</strong> để xem <em>Id</em> của bạn, dán vào ô Chat ID ở trên rồi
            bấm Lưu → Gửi thử thông báo.
          </li>
        </ol>
      </div>
    </div>
  )
}
