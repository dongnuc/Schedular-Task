import { useState } from 'react'
import { useData } from '../context/DataContext'
import { PRIORITY_LABEL, STATUS_LABEL, colorOf } from '../lib/colors'
import { fmt, timeRange } from '../lib/dates'
import { describeRecurrence } from '../lib/recurrence'
import type { DayItem, OccurrenceStatus } from '../lib/types'
import Icon from './Icon'
import Modal from './Modal'

interface Props {
  item: DayItem
  onClose: () => void
  onEdit: () => void
}

const STATUSES: OccurrenceStatus[] = ['pending', 'in_progress', 'done', 'skipped']

/** Ghi nhận tiến độ + kết quả của một công việc trong một ngày cụ thể. */
export default function OccurrenceModal({ item, onClose, onEdit }: Props) {
  const { updateOccurrence, deleteTask } = useData()
  const { task, date, occurrence } = item
  const [status, setStatus] = useState<OccurrenceStatus>(item.status)
  const [progress, setProgress] = useState(item.progress)
  const [note, setNote] = useState(occurrence?.result_note ?? '')
  const [rating, setRating] = useState<number | null>(occurrence?.rating ?? null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const recurrence = describeRecurrence(task)
  const color = colorOf(task.color)

  const pickStatus = (s: OccurrenceStatus) => {
    setStatus(s)
    if (s === 'done') setProgress(100)
    else if (s === 'pending') setProgress(0)
    else if (s === 'in_progress' && (progress === 0 || progress === 100)) setProgress(50)
  }

  const pickProgress = (p: number) => {
    setProgress(p)
    if (status === 'skipped') return
    setStatus(p >= 100 ? 'done' : p > 0 ? 'in_progress' : 'pending')
  }

  const save = async () => {
    setBusy(true)
    const ok = await updateOccurrence(task.id, date, {
      status,
      progress,
      result_note: note.trim() || null,
      rating,
    })
    setBusy(false)
    if (ok) onClose()
  }

  const remove = async () => {
    setBusy(true)
    const ok = await deleteTask(task.id)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal title="Chi tiết công việc" icon="clipboard" onClose={onClose}>
      <div className="space-y-5">
        <div className={`rounded-xl border-l-4 ${color.border} ${color.soft} p-3`}>
          <div className="font-semibold">{task.title}</div>
          <div className="mt-1 text-sm text-slate-600">
            {fmt(date, 'EEEE, dd/MM/yyyy')} · {timeRange(task.start_time, task.end_time)}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
            <span>Ưu tiên: {PRIORITY_LABEL[task.priority]}</span>
            {recurrence && (
              <span className="inline-flex items-center gap-1">
                <Icon name="repeat" className="h-3.5 w-3.5" /> {recurrence}
              </span>
            )}
            {task.start_time && (
              <span className="inline-flex items-center gap-1">
                <Icon name={task.notify ? 'bell-ring' : 'bell-off'} className="h-3.5 w-3.5" />
                {task.notify ? 'Có thông báo' : 'Tắt thông báo'}
              </span>
            )}
          </div>
          {task.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{task.description}</p>
          )}
        </div>

        <div>
          <span className="label">Trạng thái</span>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => pickStatus(s)}
                className={`min-h-10 rounded-xl px-1 py-2 text-xs font-semibold ${
                  status === s
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="o-progress">Tiến độ: {progress}%</label>
          <input
            id="o-progress"
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            disabled={status === 'skipped'}
            onChange={(e) => pickProgress(Number(e.target.value))}
            className="w-full accent-indigo-600"
          />
        </div>

        <div>
          <label className="label" htmlFor="o-note">Kết quả / ghi chú</label>
          <textarea
            id="o-note"
            className="input"
            rows={3}
            placeholder="Đã làm được gì, vướng ở đâu, lần sau cần cải thiện gì…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div>
          <span className="label">Tự đánh giá chất lượng</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} sao`}
                onClick={() => setRating(rating === n ? null : n)}
                className={`text-2xl leading-none ${
                  rating && n <= rating ? 'text-amber-400' : 'text-slate-300'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onEdit}>Sửa công việc</button>
            {confirmDelete ? (
              <button type="button" className="btn-danger" disabled={busy} onClick={remove}>
                {task.recurrence_type === 'none' ? 'Xác nhận xoá' : 'Xoá cả chuỗi lặp?'}
              </button>
            ) : (
              <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
                Xoá
              </button>
            )}
          </div>
          <button type="button" className="btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Đang lưu…' : 'Lưu kết quả'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
