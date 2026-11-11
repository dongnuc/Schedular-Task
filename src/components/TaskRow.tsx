import { useData } from '../context/DataContext'
import { useUI } from '../context/UIContext'
import { OVERDUE_BADGE, STATUS_BADGE, STATUS_LABEL, colorOf } from '../lib/colors'
import { hhmm } from '../lib/dates'
import { isOverdue } from '../lib/stats'
import type { DayItem } from '../lib/types'
import Icon from './Icon'

function CheckCircle({ done, onClick, label, small = false }: { done: boolean; onClick: () => void; label: string; small?: boolean }) {
  return (
    <button
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={onClick}
      className="-m-2 shrink-0 p-2"
    >
      <span
        className={`grid place-items-center rounded-full border-2 transition-colors ${
          small ? 'h-5 w-5' : 'h-6 w-6'
        } ${done ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white hover:border-indigo-400'}`}
      >
        {done && <Icon name="check" className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={3.5} />}
      </span>
    </button>
  )
}

function StatusPill({ item }: { item: DayItem }) {
  const overdue = isOverdue(item)
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
        overdue ? OVERDUE_BADGE : STATUS_BADGE[item.status]
      }`}
    >
      {overdue ? 'Quá hạn' : STATUS_LABEL[item.status]}
      {item.status === 'in_progress' && !overdue && ` · ${item.progress}%`}
    </span>
  )
}

function TimeLabel({ item }: { item: DayItem }) {
  const { start_time, end_time } = item.task
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-slate-600 tabular-nums">
      <Icon name="clock" className="h-4 w-4 text-slate-400" />
      {start_time ? hhmm(start_time) : 'Cả ngày'}
      {start_time && end_time && <span className="text-slate-400">– {hhmm(end_time)}</span>}
    </span>
  )
}

/** Một dòng công việc: tick nhanh hoàn thành, bấm vào để ghi kết quả chi tiết. */
export default function TaskRow({ item, compact = false }: { item: DayItem; compact?: boolean }) {
  const { updateOccurrence } = useData()
  const { openOccurrence } = useUI()
  const { task, status } = item
  const color = colorOf(task.color)
  const done = status === 'done'
  const muted = done || status === 'skipped'

  const toggle = () => updateOccurrence(task.id, item.date, { status: done ? 'pending' : 'done' })

  if (compact) {
    return (
      <div className={`flex items-start gap-2 rounded-xl border-l-[3px] ${color.border} ${color.soft} px-2 py-1.5`}>
        <div className="mt-0.5">
          <CheckCircle small done={done} onClick={toggle} label={`Hoàn thành: ${task.title}`} />
        </div>
        <button onClick={() => openOccurrence(item)} className="min-w-0 flex-1 text-left" title={task.title}>
          <div className={`line-clamp-2 break-words text-xs font-semibold leading-snug ${muted ? 'text-slate-400 line-through' : ''}`}>
            {task.title}
          </div>
          <div className="text-[11px] text-slate-500">
            {task.start_time ? hhmm(task.start_time) : 'Cả ngày'}
            {status === 'in_progress' && ` · ${item.progress}%`}
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 border-b border-slate-100 px-2 py-3.5 last:border-0">
      <CheckCircle done={done} onClick={toggle} label={`Hoàn thành: ${task.title}`} />
      <button onClick={() => openOccurrence(item)} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`truncate font-semibold ${muted ? 'text-slate-400 line-through' : ''}`}>{task.title}</span>
          {task.priority === 3 && !muted && (
            <span className="shrink-0 rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
              Ưu tiên cao
            </span>
          )}
          {task.recurrence_type !== 'none' && (
            <span className="shrink-0 text-slate-400" title="Công việc lặp lại">
              <Icon name="repeat" className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        {item.occurrence?.result_note && (
          <div className="mt-0.5 truncate text-xs text-slate-500">{item.occurrence.result_note}</div>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
          <StatusPill item={item} />
          <TimeLabel item={item} />
        </div>
      </button>
      <div className="hidden w-36 justify-center sm:flex">
        <StatusPill item={item} />
      </div>
      <div className="hidden w-32 justify-end sm:flex">
        <TimeLabel item={item} />
      </div>
      <button
        onClick={() => openOccurrence(item)}
        aria-label={`Chi tiết: ${task.title}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <Icon name="more" className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  )
}
