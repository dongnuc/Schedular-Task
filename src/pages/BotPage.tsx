import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import { PageHeader } from '../components/Widgets'
import { BOT_ACTIONS, actionOf, type BotAction, type BotCommand, type BotSyncStatus } from '../lib/botActions'
import { supabase } from '../lib/supabase'

const NAME_RE = /^[a-z][a-z0-9_]{0,31}$/

const SYNC_ERRORS: Record<string, string> = {
  forbidden: 'Tài khoản này không có quyền quản trị bot.',
  missing_bot_token: "Chưa có bot token trong Supabase Vault (secret 'telegram_bot_token').",
  missing_chat_id: 'Bạn chưa kết nối Telegram. Vào Cài đặt → Kết nối Telegram trước (menu chỉ hiện trong chat của bạn).',
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  )
}

function CommandForm({
  initial,
  onClose,
  onSaved,
  nextOrder,
}: {
  initial?: BotCommand
  onClose: () => void
  onSaved: () => void
  nextOrder: number
}) {
  const [command, setCommand] = useState(initial?.command ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [action, setAction] = useState<BotAction>(initial?.action ?? 'today')
  const [replyText, setReplyText] = useState(initial?.reply_text ?? '')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const def = actionOf(action)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const name = command.trim().toLowerCase()
    if (!NAME_RE.test(name)) {
      setError('Tên lệnh chỉ gồm chữ thường không dấu, số, dấu gạch dưới; bắt đầu bằng chữ cái (tối đa 32 ký tự).')
      return
    }
    const row = {
      command: name,
      description: description.trim(),
      action,
      reply_text: action === 'text' ? replyText.trim() : null,
      enabled,
    }
    setBusy(true)
    const { error: err } = initial
      ? await supabase.from('bot_commands').update(row).eq('id', initial.id)
      : await supabase.from('bot_commands').insert({ ...row, sort_order: nextOrder })
    setBusy(false)
    if (err) {
      setError(err.code === '23505' ? `Lệnh /${name} đã tồn tại.` : err.message)
      return
    }
    onSaved()
  }

  return (
    <Modal title={initial ? 'Sửa lệnh' : 'Thêm lệnh'} icon="terminal" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="c-name">Tên lệnh</label>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-400" aria-hidden="true">/</span>
            <input
              id="c-name"
              className="input font-mono"
              required
              maxLength={32}
              autoFocus
              autoCapitalize="none"
              spellCheck={false}
              placeholder="today"
              value={command}
              onChange={(e) => setCommand(e.target.value.toLowerCase())}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">Chữ thường không dấu, số và “_”. Người dùng gõ /{command || 'ten_lenh'} trong Telegram.</p>
        </div>

        <div>
          <label className="label" htmlFor="c-desc">Mô tả (hiện trong menu Telegram)</label>
          <input
            id="c-desc"
            className="input"
            required
            maxLength={256}
            placeholder="Công việc hôm nay"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="c-action">Bot sẽ làm gì</label>
          <select id="c-action" className="input" value={action} onChange={(e) => setAction(e.target.value as BotAction)}>
            {BOT_ACTIONS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
          {def && (
            <p className="mt-1 text-xs text-slate-500">
              {def.description}
              {def.usage && <> Ví dụ: <code className="rounded bg-slate-100 px-1">{def.usage}</code></>}
            </p>
          )}
        </div>

        {action === 'text' && (
          <div>
            <label className="label" htmlFor="c-reply">Nội dung trả lời</label>
            <textarea
              id="c-reply"
              className="input"
              rows={4}
              required
              maxLength={3500}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Bật lệnh này
        </label>

        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>Huỷ</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function BotPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [commands, setCommands] = useState<BotCommand[]>([])
  const [status, setStatus] = useState<BotSyncStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<BotCommand | 'new' | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState<{ command: string; text: string } | null>(null)
  const [previewArg, setPreviewArg] = useState('')

  const load = useCallback(async () => {
    const [list, st] = await Promise.all([
      supabase.from('bot_commands').select('*').order('sort_order').order('command'),
      supabase.rpc('bot_sync_status'),
    ])
    if (list.error) setError(list.error.message)
    else setCommands(list.data as BotCommand[])
    if (!st.error) setStatus(st.data as BotSyncStatus)
  }, [])

  useEffect(() => {
    supabase.rpc('is_bot_admin').then(({ data }) => {
      const ok = data === true
      setAllowed(ok)
      if (ok) load()
    })
  }, [load])

  const patch = async (id: string, values: Partial<BotCommand>) => {
    const { error: err } = await supabase.from('bot_commands').update(values).eq('id', id)
    if (err) setError(err.message)
    await load()
  }

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= commands.length) return
    // Chuẩn hoá sort_order (10, 20, 30…) rồi đổi chỗ hai lệnh liền kề.
    const orders = commands.map((c, i) => ({ id: c.id, sort_order: (i + 1) * 10 }))
    ;[orders[index].sort_order, orders[j].sort_order] = [orders[j].sort_order, orders[index].sort_order]
    const results = await Promise.all(
      orders.map((o) => supabase.from('bot_commands').update({ sort_order: o.sort_order }).eq('id', o.id)),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) setError(failed.error.message)
    await load()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('bot_commands').delete().eq('id', id)
    if (err) setError(err.message)
    setDeleting(null)
    await load()
  }

  const runPreview = async (cmd: BotCommand) => {
    const { data, error: err } = await supabase.rpc('bot_preview_command', {
      p_command: cmd.command,
      p_arg: cmd.action === 'done' ? previewArg : '',
    })
    setPreview({ command: cmd.command, text: err ? `Lỗi: ${err.message}` : (data as string) })
  }

  const deploy = async () => {
    setSyncing(true)
    setSyncMsg(null)
    const { data, error: err } = await supabase.functions.invoke('bot-sync')
    setSyncing(false)
    if (err) {
      let code = 'error'
      let description = err.message
      try {
        const body = await (err as { context?: Response }).context?.json()
        code = body?.error ?? code
        description = body?.description ?? description
      } catch {
        /* giữ thông báo mặc định */
      }
      setSyncMsg({ ok: false, text: SYNC_ERRORS[code] ?? `Không triển khai được: ${description}` })
    } else {
      setSyncMsg({ ok: true, text: `Đã cập nhật menu Telegram với ${(data as { count: number }).count} lệnh.` })
    }
    await load()
  }

  if (allowed === null) return <p className="text-sm text-slate-500">Đang tải…</p>
  if (!allowed) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-500">
          <Icon name="alert" className="h-6 w-6" />
        </span>
        <h1 className="mt-3 text-lg font-extrabold">Không có quyền truy cập</h1>
        <p className="mt-1 text-sm text-slate-500">Trang này chỉ dành cho tài khoản quản trị bot.</p>
      </div>
    )
  }

  const nextOrder = (commands.at(-1)?.sort_order ?? 0) + 10

  return (
    <div className="space-y-5">
      <PageHeader icon="terminal" title="Lệnh bot Telegram" subtitle="Tạo, sửa, bật/tắt lệnh. Chỉ tài khoản của bạn dùng được.">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={() => setEditing('new')}>
            <Icon name="plus" className="h-4 w-4" strokeWidth={2.5} /> Thêm lệnh
          </button>
          <button className="btn-primary" disabled={syncing} onClick={deploy}>
            <Icon name="send" className="h-4 w-4" /> {syncing ? 'Đang triển khai…' : 'Triển khai lên bot'}
          </button>
        </div>
      </PageHeader>

      <div
        role="status"
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 text-sm ${
          status?.synced ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
        }`}
      >
        <Icon name={status?.synced ? 'check-circle' : 'alert'} className="h-5 w-5 shrink-0" />
        <span className="font-semibold">
          {status?.synced ? 'Menu Telegram đã khớp với danh sách lệnh.' : 'Có thay đổi chưa triển khai lên menu Telegram.'}
        </span>
        {status?.synced_at && (
          <span className="text-xs opacity-80">Lần triển khai gần nhất: {format(new Date(status.synced_at), 'HH:mm dd/MM/yyyy')}</span>
        )}
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Bật/tắt lệnh hoặc đổi hành động có hiệu lực ngay. Tên và mô tả lệnh trong menu gợi ý của Telegram chỉ cập nhật sau khi bấm “Triển khai lên bot”.
      </p>

      {syncMsg && (
        <p role="alert" className={`text-sm font-medium ${syncMsg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{syncMsg.text}</p>
      )}
      {error && (
        <p role="alert" className="flex items-center justify-between rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
          <button aria-label="Đóng" onClick={() => setError(null)}><Icon name="x" className="h-4 w-4" /></button>
        </p>
      )}

      <section className="card" aria-labelledby="cmd-title">
        <h2 id="cmd-title" className="p-5 pb-3 font-extrabold">Danh sách lệnh ({commands.length})</h2>
        {commands.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-500">Chưa có lệnh nào. Bấm “Thêm lệnh” để tạo.</p>
        ) : (
          <ul>
            {commands.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-5 py-3.5">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className={`rounded-md bg-slate-100 px-2 py-0.5 text-sm font-bold ${c.enabled ? '' : 'text-slate-400 line-through'}`}>
                      /{c.command}
                    </code>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                      {actionOf(c.action)?.label ?? c.action}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{c.description}</p>
                </div>

                <div className="flex items-center gap-1">
                  <button className="btn-icon !h-9 !w-9" aria-label={`Chạy thử /${c.command}`} title="Chạy thử" onClick={() => runPreview(c)}>
                    <Icon name="play" className="h-4 w-4" />
                  </button>
                  <button className="btn-icon !h-9 !w-9" aria-label={`Sửa /${c.command}`} title="Sửa" onClick={() => setEditing(c)}>
                    <Icon name="pencil" className="h-4 w-4" />
                  </button>
                  {deleting === c.id ? (
                    <button className="btn-danger !min-h-9 !px-3" onClick={() => remove(c.id)} onBlur={() => setDeleting(null)} autoFocus>
                      Xoá?
                    </button>
                  ) : (
                    <button className="btn-icon !h-9 !w-9 hover:!text-rose-600" aria-label={`Xoá /${c.command}`} title="Xoá" onClick={() => setDeleting(c.id)}>
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  )}
                  <button className="btn-icon !h-9 !w-9" aria-label="Chuyển lên" disabled={i === 0} onClick={() => move(i, -1)}>
                    <Icon name="arrow-up" className="h-4 w-4" />
                  </button>
                  <button className="btn-icon !h-9 !w-9" aria-label="Chuyển xuống" disabled={i === commands.length - 1} onClick={() => move(i, 1)}>
                    <Icon name="arrow-down" className="h-4 w-4" />
                  </button>
                  <span className="ml-2">
                    <Switch checked={c.enabled} label={`Bật lệnh /${c.command}`} onChange={(v) => patch(c.id, { enabled: v })} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {preview && (
        <section className="card p-5" aria-labelledby="pv-title" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="pv-title" className="font-extrabold">Kết quả chạy thử <code className="text-indigo-700">/{preview.command}</code></h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500" htmlFor="pv-arg">Tham số (cho lệnh hoàn thành)</label>
              <input id="pv-arg" className="input !w-20 !py-1.5" inputMode="numeric" value={previewArg} onChange={(e) => setPreviewArg(e.target.value)} />
              <button className="btn-icon !h-9 !w-9" aria-label="Đóng kết quả" onClick={() => setPreview(null)}>
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-sm leading-relaxed">{preview.text}</pre>
          <p className="mt-2 text-xs text-slate-500">Chạy thử chỉ xem trước, không thay đổi dữ liệu và không gửi tin nhắn.</p>
        </section>
      )}

      <section className="card p-5" aria-labelledby="ref-title">
        <h2 id="ref-title" className="mb-3 font-extrabold">Các hành động có sẵn</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {BOT_ACTIONS.map((a) => (
            <div key={a.key}>
              <dt className="text-sm font-semibold">{a.label}</dt>
              <dd className="text-sm text-slate-600">
                {a.description}
                {a.usage && <> <code className="rounded bg-slate-100 px-1">{a.usage}</code></>}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          Bạn có thể tạo nhiều lệnh cùng dùng một hành động (ví dụ /hn và /today cùng “Việc hôm nay”).
        </p>
      </section>

      {editing && (
        <CommandForm
          initial={editing === 'new' ? undefined : editing}
          nextOrder={nextOrder}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
