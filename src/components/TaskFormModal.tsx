import { useState, type FormEvent } from 'react'
import { useData } from '../context/DataContext'
import { COLORS, PRIORITY_LABEL } from '../lib/colors'
import { hhmm } from '../lib/dates'
import {
  recurrenceFromTask,
  emptyRecurrence,
  toRecurrenceFields,
  validateRecurrence,
} from '../lib/recurrenceForm'
import type { Task, TaskInput } from '../lib/types'
import { DateField, TimeField } from './DatePicker'
import Icon from './Icon'
import Modal from './Modal'
import RecurrenceFields from './RecurrenceFields'

interface Props {
  task?: Task
  defaultDate: string
  onClose: () => void
  /** Chuyển sang chế độ thêm nhiều việc (chỉ khi tạo mới). */
  onBulk?: () => void
}

export default function TaskFormModal({ task, defaultDate, onClose, onBulk }: Props) {
  const { saveTask } = useData()
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [color, setColor] = useState(task?.color ?? 'blue')
  const [priority, setPriority] = useState<1 | 2 | 3>(task?.priority ?? 2)
  const [startDate, setStartDate] = useState(task?.start_date ?? defaultDate)
  const [allDay, setAllDay] = useState(task ? !task.start_time : false)
  const [startTime, setStartTime] = useState(hhmm(task?.start_time ?? null) || '08:00')
  const [endTime, setEndTime] = useState(hhmm(task?.end_time ?? null))
  const [rec, setRec] = useState(() => (task ? recurrenceFromTask(task) : emptyRecurrence()))
  const [notify, setNotify] = useState(task?.notify ?? true)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!allDay && endTime && endTime <= startTime) {
      setFormError('Giờ kết thúc phải sau giờ bắt đầu.')
      return
    }
    const recError = validateRecurrence(rec, startDate)
    if (recError) {
      setFormError(recError)
      return
    }

    const input: TaskInput = {
      title: title.trim(),
      description: description.trim() || null,
      color,
      priority,
      start_date: startDate,
      start_time: allDay ? null : startTime,
      end_time: allDay || !endTime ? null : endTime,
      ...toRecurrenceFields(rec, startDate),
      notify,
    }
    setBusy(true)
    const ok = await saveTask(input, task?.id)
    setBusy(false)
    if (ok) onClose()
    else setFormError('Không lưu được, vui lòng thử lại.')
  }

  return (
    <Modal title={task ? 'Sửa công việc' : 'Thêm công việc'} icon={task ? 'pencil' : 'plus'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!task && onBulk && (
          <button
            type="button"
            onClick={onBulk}
            className="flex w-full items-center justify-between rounded-xl bg-indigo-50 px-3.5 py-2.5 text-left text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="list-plus" className="h-4 w-4" /> Thêm nhiều việc cùng lúc
            </span>
            <Icon name="chevron-right" className="h-4 w-4" />
          </button>
        )}

        <div>
          <label className="label" htmlFor="t-title">Tên công việc</label>
          <input
            id="t-title"
            className="input"
            required
            maxLength={200}
            autoFocus
            placeholder="Ví dụ: Học tiếng Anh 30 phút"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="t-desc">Mô tả</label>
          <textarea id="t-desc" className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="t-date">{rec.type === 'none' ? 'Ngày' : 'Ngày bắt đầu'}</label>
            <DateField id="t-date" value={startDate} onChange={(d) => d && setStartDate(d)} />
          </div>
          <div>
            <label className="label" htmlFor="t-priority">Ưu tiên</label>
            <select
              id="t-priority"
              className="input"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)}
            >
              {[3, 2, 1].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            Cả ngày (không có giờ cụ thể)
          </label>
          {!allDay && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <span className="label">Giờ bắt đầu</span>
                <TimeField label="Giờ bắt đầu" value={startTime} onChange={(t) => t && setStartTime(t)} />
              </div>
              <div>
                <span className="label">Giờ kết thúc (tuỳ chọn)</span>
                <TimeField label="Giờ kết thúc" optional value={endTime} onChange={setEndTime} />
              </div>
            </div>
          )}
        </div>

        <RecurrenceFields value={rec} onChange={setRec} startDate={startDate} idPrefix="t-rec" />

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

        <label className={`flex items-center gap-2 text-sm ${allDay ? 'text-slate-400' : ''}`}>
          <input
            type="checkbox"
            checked={notify && !allDay}
            disabled={allDay}
            onChange={(e) => setNotify(e.target.checked)}
          />
          Thông báo Telegram (trước 30 phút và đúng giờ bắt đầu)
        </label>

        {formError && <p role="alert" className="text-sm text-rose-600">{formError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>Huỷ</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
        </div>
      </form>
    </Modal>
  )
}
