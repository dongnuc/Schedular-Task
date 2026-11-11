import { useMemo, useState, type FormEvent } from 'react'
import { useData } from '../context/DataContext'
import { COLORS, PRIORITY_LABEL } from '../lib/colors'
import { parseBulk } from '../lib/bulkParse'
import { emptyRecurrence, toRecurrenceFields, validateRecurrence } from '../lib/recurrenceForm'
import type { TaskInput } from '../lib/types'
import { DateField } from './DatePicker'
import Icon from './Icon'
import Modal from './Modal'
import RecurrenceFields from './RecurrenceFields'

const EXAMPLE = `06:30-07:15 Tập thể dục
08:00-09:30 Họp nhóm
8h30 Đọc báo cáo
14:00 Gửi email đối tác
Dọn dẹp bàn làm việc`

interface Props {
  defaultDate: string
  onClose: () => void
  /** Quay lại form thêm một việc. */
  onSingle?: () => void
}

export default function BulkTaskModal({ defaultDate, onClose, onSingle }: Props) {
  const { saveTasks } = useData()
  const [text, setText] = useState('')
  const [startDate, setStartDate] = useState(defaultDate)
  const [color, setColor] = useState('blue')
  const [priority, setPriority] = useState<1 | 2 | 3>(2)
  const [notify, setNotify] = useState(true)
  const [rec, setRec] = useState(emptyRecurrence)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const lines = useMemo(() => parseBulk(text), [text])
  const valid = lines.filter((l) => !l.error)
  const invalid = lines.length - valid.length

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const recError = validateRecurrence(rec, startDate)
    if (recError) return setFormError(recError)
    if (valid.length === 0 || invalid > 0) return

    const recFields = toRecurrenceFields(rec, startDate)
    const inputs: TaskInput[] = valid.map((l) => ({
      title: l.title!,
      description: null,
      color,
      priority,
      start_date: startDate,
      start_time: l.start ?? null,
      end_time: l.end ?? null,
      ...recFields,
      notify,
    }))
    setBusy(true)
    const ok = await saveTasks(inputs)
    setBusy(false)
    if (ok) onClose()
    else setFormError('Không lưu được, vui lòng thử lại.')
  }

  return (
    <Modal title="Thêm nhiều việc" icon="list-plus" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {onSingle && (
          <button
            type="button"
            onClick={onSingle}
            className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline"
          >
            <Icon name="chevron-left" className="h-4 w-4" /> Thêm từng việc
          </button>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-600" htmlFor="b-text">
              Mỗi dòng một việc
            </label>
            <button
              type="button"
              className="text-xs font-semibold text-indigo-700 hover:underline"
              onClick={() => setText(EXAMPLE)}
            >
              Chèn ví dụ
            </button>
          </div>
          <textarea
            id="b-text"
            className="input font-mono"
            rows={6}
            autoFocus
            spellCheck={false}
            placeholder={EXAMPLE}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Cú pháp: <code className="rounded bg-slate-100 px-1">giờ bắt đầu-giờ kết thúc Tên việc</code>. Giờ viết{' '}
            <code className="rounded bg-slate-100 px-1">08:00</code> hoặc <code className="rounded bg-slate-100 px-1">8h30</code>; giờ kết thúc
            không bắt buộc; dòng không có giờ là việc cả ngày. Dòng bắt đầu bằng <code className="rounded bg-slate-100 px-1">#</code> bị bỏ qua.
          </p>
        </div>

        {lines.length > 0 && (
          <div aria-live="polite" className="rounded-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs font-semibold">
              <span className="text-slate-600">Xem trước</span>
              <span className={invalid ? 'text-rose-600' : 'text-emerald-700'}>
                {invalid ? `${invalid} dòng lỗi` : `Sẽ tạo ${valid.length} việc`}
              </span>
            </div>
            <ul className="max-h-44 divide-y divide-slate-50 overflow-y-auto">
              {lines.map((l) => (
                <li key={l.line} className="flex items-center gap-2 px-3 py-2 text-sm">
                  {l.error ? (
                    <>
                      <Icon name="alert" className="h-4 w-4 shrink-0 text-rose-500" />
                      <span className="min-w-0 flex-1 truncate text-slate-600">Dòng {l.line}: {l.raw}</span>
                      <span className="shrink-0 text-xs text-rose-600">{l.error}</span>
                    </>
                  ) : (
                    <>
                      <span className="w-24 shrink-0 text-xs tabular-nums text-slate-500">
                        {l.start ? `${l.start}${l.end ? ` – ${l.end}` : ''}` : 'Cả ngày'}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{l.title}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="b-date">{rec.type === 'none' ? 'Ngày' : 'Ngày bắt đầu'}</label>
            <DateField id="b-date" value={startDate} onChange={(d) => d && setStartDate(d)} />
          </div>
          <div>
            <label className="label" htmlFor="b-priority">Ưu tiên</label>
            <select
              id="b-priority"
              className="input"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)}
            >
              {[3, 2, 1].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </div>
        </div>

        <RecurrenceFields value={rec} onChange={setRec} startDate={startDate} idPrefix="b-rec" />

        <div>
          <span className="label">Màu</span>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                title={c.label}
                aria-label={c.label}
                aria-pressed={color === c.key}
                onClick={() => setColor(c.key)}
                className={`h-8 w-8 rounded-full ${c.dot} ${color === c.key ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
              />
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Thông báo Telegram cho các việc có giờ
        </label>

        {formError && <p role="alert" className="text-sm text-rose-600">{formError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>Huỷ</button>
          <button className="btn-primary" disabled={busy || valid.length === 0 || invalid > 0}>
            {busy ? 'Đang lưu…' : valid.length ? `Tạo ${valid.length} việc` : 'Tạo việc'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
