import { useState } from 'react'
import { useData } from '../context/DataContext'
import { PRIORITY_LABEL, STATUS_LABEL, colorOf } from '../lib/colors'
import { fmt, shiftKey, timeRange, todayKey } from '../lib/dates'
import { describeRecurrence } from '../lib/recurrence'
import { emptyRecurrence, toRecurrenceFields, validateRecurrence, type RecurrenceValue } from '../lib/recurrenceForm'
import type { DayItem, OccurrenceStatus, TaskInput } from '../lib/types'
import { DateField } from './DatePicker'
import Icon from './Icon'
import Modal from './Modal'
import RecurrenceFields from './RecurrenceFields'

interface Props {
  item: DayItem
  onClose: () => void
  onEdit: () => void
}

const STATUSES: OccurrenceStatus[] = ['pending', 'in_progress', 'done', 'skipped']

/** Ghi nhận tiến độ + kết quả của một công việc trong một ngày cụ thể. */
export default function OccurrenceModal({ item, onClose, onEdit }: Props) {
  const { updateOccurrence, deleteTask, saveTask, postponeOccurrence } = useData()
  const { task, date, occurrence } = item
  const [status, setStatus] = useState<OccurrenceStatus>(item.status)
  const [progress, setProgress] = useState(item.progress)
  const [note, setNote] = useState(occurrence?.result_note ?? '')
  const [rating, setRating] = useState<number | null>(occurrence?.rating ?? null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Lặp lại trong tương lai: tạo một công việc mới giống việc này, bắt đầu từ ngày được chọn.
  const [repeatOpen, setRepeatOpen] = useState(false)
  const [repStart, setRepStart] = useState(() => shiftKey(item.date, 1))
  const [rep, setRep] = useState<RecurrenceValue>(() => ({ ...emptyRecurrence(), type: 'weekly' }))
  const [repError, setRepError] = useState<string | null>(null)

  // Gia hạn: chuyển việc chưa xong sang một ngày khác (ngày đích phải sau ngày hiện tại của việc).
  const isPostponed = item.status === 'postponed'
  const canPostpone = item.status === 'pending' || item.status === 'in_progress'
  const minTarget = shiftKey(date, 1)
  const tomorrow = shiftKey(todayKey(), 1)
  const [postOpen, setPostOpen] = useState(false)
  const [postDate, setPostDate] = useState(() => (tomorrow >= minTarget ? tomorrow : minTarget))
  const [postError, setPostError] = useState<string | null>(null)

  const postpone = async () => {
    if (!postDate || postDate < minTarget) return setPostError('Chọn ngày sau ngày hiện tại của việc.')
    setBusy(true)
    const ok = await postponeOccurrence(task.id, date, postDate)
    setBusy(false)
    if (ok) onClose()
    else setPostError('Không gia hạn được, vui lòng thử lại.')
  }

  const createRepeat = async () => {
    const err = validateRecurrence(rep, repStart)
    if (err) return setRepError(err)
    const copy: TaskInput = {
      title: task.title,
      description: task.description,
      color: task.color,
      priority: task.priority,
      start_date: repStart,
      start_time: task.start_time,
      end_time: task.end_time,
      ...toRecurrenceFields(rep, repStart),
      notify: task.notify,
    }
    setBusy(true)
    const ok = await saveTask(copy)
    setBusy(false)
    if (ok) onClose()
    else setRepError('Không tạo được lịch lặp, vui lòng thử lại.')
  }

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

        {(canPostpone || isPostponed || task.carried_from) && (
          <div className="rounded-xl border border-violet-100 bg-violet-50/40">
            {task.carried_from && (
              <p className="px-3.5 pt-3 text-sm font-bold text-violet-800">
                ↪ Gia hạn từ ngày {fmt(task.carried_from, 'dd/MM/yyyy')}
              </p>
            )}
            {isPostponed && (
              <p className="px-3.5 pt-3 text-sm font-bold text-violet-800">
                → Việc gốc đã gia hạn sang ngày{' '}
                {item.occurrence?.postponed_to ? fmt(item.occurrence.postponed_to, 'dd/MM/yyyy') : '(chưa rõ)'}
              </p>
            )}
            {canPostpone && (
              <div className="p-3.5">
                <button
                  type="button"
                  aria-expanded={postOpen}
                  onClick={() => setPostOpen((o) => !o)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-violet-800"
                >
                  <Icon name={postOpen ? 'chevron-down' : 'chevron-right'} className="h-4 w-4" />
                  Gia hạn sang ngày khác
                </button>
                {postOpen && (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs leading-relaxed text-slate-600">
                      Việc sẽ chuyển sang ngày bạn chọn và ghi rõ là “Gia hạn từ ngày {fmt(date, 'dd/MM/yyyy')}”.
                      Việc ở ngày này được đánh dấu “Đã gia hạn” và không tính vào tỷ lệ hoàn thành.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn-ghost !min-h-9 !py-1.5"
                        onClick={() => setPostDate(tomorrow >= minTarget ? tomorrow : minTarget)}
                      >
                        Ngày mai
                      </button>
                      <div className="min-w-44 flex-1">
                        <DateField id="p-date" value={postDate} min={minTarget} onChange={setPostDate} />
                      </div>
                    </div>
                    {postError && <p role="alert" className="text-sm text-rose-600">{postError}</p>}
                    <button type="button" className="btn-primary w-full" disabled={busy || !postDate} onClick={postpone}>
                      {postDate ? `Gia hạn sang ${fmt(postDate, 'dd/MM/yyyy')}` : 'Chọn ngày'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-slate-100">
          <button
            type="button"
            aria-expanded={repeatOpen}
            onClick={() => setRepeatOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3.5 py-3 text-left text-sm font-semibold text-indigo-700"
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="repeat" className="h-4 w-4" /> Lặp lại việc này trong tương lai
            </span>
            <Icon name={repeatOpen ? 'chevron-down' : 'chevron-right'} className="h-4 w-4" />
          </button>
          {repeatOpen && (
            <div className="space-y-3 border-t border-slate-100 p-3.5">
              <p className="text-xs text-slate-500">
                Tạo một công việc mới giống việc này, bắt đầu từ ngày bạn chọn. Lịch sử của việc hiện tại không bị thay đổi.
              </p>
              <div>
                <label className="label" htmlFor="r-start">Bắt đầu từ ngày</label>
                <DateField id="r-start" value={repStart} min={shiftKey(item.date, 1)} onChange={(d) => d && setRepStart(d)} />
              </div>
              <RecurrenceFields value={rep} onChange={setRep} startDate={repStart} idPrefix="r-rec" />
              {repError && <p role="alert" className="text-sm text-rose-600">{repError}</p>}
              <button type="button" className="btn-primary w-full" disabled={busy} onClick={createRepeat}>
                {busy ? 'Đang tạo…' : rep.type === 'none' ? 'Tạo bản sao vào ngày đã chọn' : 'Tạo lịch lặp'}
              </button>
            </div>
          )}
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
          <button type="button" className="btn-primary" disabled={busy || isPostponed} onClick={save}>
            {busy ? 'Đang lưu…' : 'Lưu kết quả'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
