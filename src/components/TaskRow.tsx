import { useData } from '../context/DataContext'
import { useUI } from '../context/UIContext'
import { STATUS_BADGE, STATUS_LABEL, colorOf } from '../lib/colors'
import { timeRange } from '../lib/dates'
import type { DayItem } from '../lib/types'
import { ProgressBar } from './Widgets'

/** Một dòng công việc: tick nhanh hoàn thành, bấm vào để ghi kết quả chi tiết. */
export default function TaskRow({ item, compact = false }: { item: DayItem; compact?: boolean }) {
  const { updateOccurrence } = useData()
  const { openOccurrence } = useUI()
  const { task, status, progress } = item
  const color = colorOf(task.color)
  const done = status === 'done'
  const muted = done || status === 'skipped'

  const toggle = () =>
    updateOccurrence(task.id, item.date, { status: done ? 'pending' : 'done' })

  if (compact) {
    return (
      <div
        className={`flex items-start gap-1.5 rounded-md border-l-[3px] ${color.border} ${color.soft} px-1.5 py-1`}
      >
        <input
          type="checkbox"
          checked={done}
          onChange={toggle}
          aria-label={`Hoàn thành: ${task.title}`}
          className="mt-0.5 accent-emerald-600"
        />
        <button
          onClick={() => openOccurrence(item)}
          className="min-w-0 flex-1 text-left"
          title={task.title}
        >
          <div className={`truncate text-xs font-medium ${muted ? 'text-slate-400 line-through' : ''}`}>
            {task.title}
          </div>
          <div className="text-[10px] text-slate-500">
            {timeRange(task.start_time, task.end_time)}
            {status === 'in_progress' && ` · ${progress}%`}
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className={`card flex items-center gap-3 border-l-4 ${color.border} p-3`}>
      <input
        type="checkbox"
        checked={done}
        onChange={toggle}
        aria-label={`Hoàn thành: ${task.title}`}
        className="h-5 w-5 shrink-0 accent-emerald-600"
      />
      <button onClick={() => openOccurrence(item)} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`truncate font-medium ${muted ? 'text-slate-400 line-through' : ''}`}>
            {task.title}
          </span>
          {task.priority === 3 && (
            <span className="shrink-0 rounded bg-rose-100 px-1.5 text-[10px] font-semibold text-rose-700">
              Ưu tiên cao
            </span>
          )}
          {task.recurrence_type !== 'none' && (
            <span className="shrink-0 text-xs" title="Công việc lặp lại">🔁</span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {timeRange(task.start_time, task.end_time)}
          {item.occurrence?.result_note && ` · 📝 ${item.occurrence.result_note}`}
        </div>
        {status === 'in_progress' && <ProgressBar value={progress} className="mt-2 max-w-xs" />}
      </button>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
        {status === 'in_progress' ? `${progress}%` : STATUS_LABEL[status]}
      </span>
    </div>
  )
}
