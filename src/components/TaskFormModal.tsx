import { useState, type FormEvent } from 'react'
import { getISODay } from 'date-fns'
import { useData } from '../context/DataContext'
import { COLORS, PRIORITY_LABEL } from '../lib/colors'
import { fromKey, hhmm } from '../lib/dates'
import type { RecurrenceType, Task, TaskInput } from '../lib/types'
import Modal from './Modal'

interface Props {
  task?: Task
  defaultDate: string
  onClose: () => void
}

const WEEKDAYS = [
  { iso: 1, label: 'T2' },
  { iso: 2, label: 'T3' },
  { iso: 3, label: 'T4' },
  { iso: 4, label: 'T5' },
  { iso: 5, label: 'T6' },
  { iso: 6, label: 'T7' },
  { iso: 7, label: 'CN' },
]

const UNIT: Record<RecurrenceType, string> = {
  none: '',
  daily: 'ngày',
  weekly: 'tuần',
  monthly: 'tháng',
}

export default function TaskFormModal({ task, defaultDate, onClose }: Props) {
  const { saveTask } = useData()
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [color, setColor] = useState(task?.color ?? 'blue')
  const [priority, setPriority] = useState<1 | 2 | 3>(task?.priority ?? 2)
  const [startDate, setStartDate] = useState(task?.start_date ?? defaultDate)
  const [allDay, setAllDay] = useState(task ? !task.start_time : false)
  const [startTime, setStartTime] = useState(hhmm(task?.start_time ?? null) || '08:00')
  const [endTime, setEndTime] = useState(hhmm(task?.end_time ?? null))
  const [recType, setRecType] = useState<RecurrenceType>(task?.recurrence_type ?? 'none')
  const [recInterval, setRecInterval] = useState(task?.recurrence_interval ?? 1)
  const [recDays, setRecDays] = useState<number[]>(task?.recurrence_days ?? [])
  const [recEnd, setRecEnd] = useState(task?.recurrence_end ?? '')
  const [notify, setNotify] = useState(task?.notify ?? true)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const toggleDay = (iso: number) =>
    setRecDays((prev) => (prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!allDay && endTime && endTime <= startTime) {
      setFormError('Giờ kết thúc phải sau giờ bắt đầu.')
      return
    }
    if (recType !== 'none' && recEnd && recEnd < startDate) {
      setFormError('Ngày kết thúc lặp phải sau ngày bắt đầu.')
      return
    }
    const weeklyDays =
      recType === 'weekly'
        ? (recDays.length ? recDays : [getISODay(fromKey(startDate))]).sort((a, b) => a - b)
        : []

    const input: TaskInput = {
      title: title.trim(),
      description: description.trim() || null,
      color,
      priority,
      start_date: startDate,
      start_time: allDay ? null : startTime,
      end_time: allDay || !endTime ? null : endTime,
      recurrence_type: recType,
      recurrence_interval: recType === 'none' ? 1 : Math.max(1, recInterval || 1),
      recurrence_days: weeklyDays,
      recurrence_end: recType === 'none' || !recEnd ? null : recEnd,
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
          <textarea
            id="t-desc"
            className="input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="t-date">
              {recType === 'none' ? 'Ngày' : 'Ngày bắt đầu'}
            </label>
            <input
              id="t-date"
              type="date"
              required
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="t-priority">Ưu tiên</label>
            <select
              id="t-priority"
              className="input"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)}
            >
              {[3, 2, 1].map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
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
                <label className="label" htmlFor="t-start">Giờ bắt đầu</label>
                <input
                  id="t-start"
                  type="time"
                  required
                  className="input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="t-end">Giờ kết thúc (tuỳ chọn)</label>
                <input
                  id="t-end"
                  type="time"
                  className="input"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <label className="label" htmlFor="t-rec">Lặp lại</label>
          <select
            id="t-rec"
            className="input"
            value={recType}
            onChange={(e) => setRecType(e.target.value as RecurrenceType)}
          >
            <option value="none">Không lặp</option>
            <option value="daily">Theo ngày</option>
            <option value="weekly">Theo tuần</option>
            <option value="monthly">Theo tháng</option>
          </select>

          {recType !== 'none' && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                Mỗi
                <input
                  type="number"
                  min={1}
                  max={365}
                  aria-label="Chu kỳ lặp"
                  className="input w-20"
                  value={recInterval}
                  onChange={(e) => setRecInterval(Number(e.target.value))}
                />
                {UNIT[recType]}
              </div>

              {recType === 'weekly' && (
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((d) => (
                      <button
                        key={d.iso}
                        type="button"
                        aria-pressed={recDays.includes(d.iso)}
                        onClick={() => toggleDay(d.iso)}
                        className={`h-9 w-10 rounded-lg text-sm font-medium ${
                          recDays.includes(d.iso)
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-300 bg-white text-slate-600'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Không chọn ngày nào = lặp theo thứ của ngày bắt đầu.
                  </p>
                </div>
              )}

              <div>
                <label className="label" htmlFor="t-recend">Lặp đến ngày (để trống = mãi mãi)</label>
                <input
                  id="t-recend"
                  type="date"
                  className="input"
                  min={startDate}
                  value={recEnd}
                  onChange={(e) => setRecEnd(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

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
                className={`h-7 w-7 rounded-full ${c.dot} ${
                  color === c.key ? 'ring-2 ring-slate-900 ring-offset-2' : ''
                }`}
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

        {formError && <p className="text-sm text-rose-600">{formError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>Huỷ</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
        </div>
      </form>
    </Modal>
  )
}
