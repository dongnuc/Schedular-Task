import { useCallback, useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

const BOT_USERNAME = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.replace(/^@/, '')

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
  missing_chat_id: { ok: false, text: 'Chưa kết nối Telegram.' },
  missing_bot_token: { ok: false, text: 'Hệ thống chưa cấu hình bot Telegram. Hãy liên hệ quản trị viên.' },
  not_authenticated: { ok: false, text: 'Phiên đăng nhập đã hết hạn.' },
}

type Msg = { ok: boolean; text: string } | null

export default function SettingsPage() {
  const { session } = useAuth()
  const userId = session!.user.id
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [message, setMessage] = useState<Msg>(null)

  const loadProfile = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) setMessage({ ok: false, text: error.message })
    setProfile(data as Profile | null)
    setLoading(false)
    return data as Profile | null
  }, [userId])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // Sau khi mở bot, chờ webhook lưu chat id (tối đa 5 phút).
  useEffect(() => {
    if (!waiting) return
    const started = Date.now()
    const timer = setInterval(async () => {
      const p = await loadProfile()
      if (p?.telegram_chat_id) {
        setWaiting(false)
        setMessage({ ok: true, text: 'Đã kết nối Telegram thành công!' })
      } else if (Date.now() - started > 5 * 60_000) {
        setWaiting(false)
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [waiting, loadProfile])

  const update = async (patch: Partial<Pick<Profile, 'timezone' | 'notify_enabled'>>) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    if (error) return setMessage({ ok: false, text: error.message })
    setProfile((p) => (p ? { ...p, ...patch } : p))
    setMessage({ ok: true, text: 'Đã lưu cài đặt.' })
  }

  const connect = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('create_telegram_link_code')
    setBusy(false)
    if (error) return setMessage({ ok: false, text: error.message })
    window.open(`https://t.me/${BOT_USERNAME}?start=${data as string}`, '_blank', 'noopener')
    setWaiting(true)
    setMessage(null)
  }

  const disconnect = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('disconnect_telegram')
    setBusy(false)
    if (error) return setMessage({ ok: false, text: error.message })
    setWaiting(false)
    await loadProfile()
    setMessage({ ok: true, text: 'Đã ngắt kết nối Telegram.' })
  }

  const sendTest = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('send_test_notification')
    setBusy(false)
    setMessage(
      error ? { ok: false, text: error.message } : TEST_RESULT[data as string] ?? { ok: false, text: String(data) },
    )
  }

  if (loading) return <p className="text-sm text-slate-500">Đang tải…</p>
  if (!profile) return <p className="text-sm text-rose-600">Không tải được hồ sơ người dùng.</p>

  const connected = Boolean(profile.telegram_chat_id)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-extrabold sm:text-2xl">Cài đặt</h1>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Thông báo Telegram</h2>
        <p className="text-sm text-slate-600">
          Mỗi công việc có giờ bắt đầu sẽ được nhắc <strong>2 lần</strong>: trước 30 phút và đúng giờ bắt
          đầu. Việc đã hoàn thành hoặc bỏ qua sẽ không nhắc nữa.
        </p>

        {connected ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <Icon name="check-circle" className="h-5 w-5" /> Đã kết nối Telegram
            </span>
            <div className="flex gap-2">
              <button className="btn-ghost" disabled={busy} onClick={sendTest}>Gửi thử</button>
              <button className="btn-danger" disabled={busy} onClick={disconnect}>Ngắt kết nối</button>
            </div>
          </div>
        ) : BOT_USERNAME ? (
          <div className="space-y-2">
            <button className="btn-primary" disabled={busy || waiting} onClick={connect}>
              {waiting ? 'Đang chờ bạn bấm Start trong Telegram…' : 'Kết nối Telegram'}
            </button>
            <p className="text-xs text-slate-500">
              Telegram sẽ mở bot <strong>@{BOT_USERNAME}</strong>. Bấm <strong>Start</strong> là xong, không cần
              nhập gì thêm.
            </p>
          </div>
        ) : (
          <p className="text-sm text-rose-600">
            Chưa cấu hình <code>VITE_TELEGRAM_BOT_USERNAME</code>. Xem README.
          </p>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={profile.notify_enabled}
            onChange={(e) => update({ notify_enabled: e.target.checked })}
          />
          Bật thông báo
        </label>

        <div>
          <label className="label" htmlFor="s-tz">Múi giờ</label>
          <select
            id="s-tz"
            className="input"
            value={profile.timezone}
            onChange={(e) => update({ timezone: e.target.value })}
          >
            {(TIMEZONES.includes(profile.timezone) ? TIMEZONES : [profile.timezone, ...TIMEZONES]).map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        {message && (
          <p className={`text-sm ${message.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{message.text}</p>
        )}
      </section>
    </div>
  )
}
