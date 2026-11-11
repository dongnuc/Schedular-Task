import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TaskRow from '../components/TaskRow'
import { PageHeader, ProgressBar } from '../components/Widgets'
import { useData } from '../context/DataContext'
import { useUI } from '../context/UIContext'
import { fmt, fromKey, shiftKey, todayKey, weekDays } from '../lib/dates'
import { summarize } from '../lib/stats'
import { useDateParam } from '../lib/useDateParam'

export default function WeekPage() {
  const [date, setDate] = useDateParam()
  const { ensureRange, itemsForDate, itemsForDates } = useData()
  const { openTaskForm } = useUI()
  const navigate = useNavigate()

  const days = useMemo(() => weekDays(fromKey(date)), [date])
  const from = days[0]
  const to = days[6]
  useEffect(() => ensureRange(from, to), [from, to, ensureRange])

  const summary = useMemo(() => summarize(itemsForDates(days)), [itemsForDates, days])
  const today = todayKey()

  return (
    <div>
      <PageHeader
        title={`Tuần ${fmt(from, 'dd/MM')} – ${fmt(to, 'dd/MM/yyyy')}`}
        subtitle={`Hoàn thành ${summary.done}/${summary.total - summary.skipped} việc · ${summary.completionRate}%`}
        onPrev={() => setDate(shiftKey(date, -7))}
        onNext={() => setDate(shiftKey(date, 7))}
        onToday={() => setDate(today)}
        actions={
          <button className="btn-primary" onClick={() => openTaskForm({ date })}>
            + Thêm việc
          </button>
        }
      />
      <ProgressBar value={summary.completionRate} className="mb-4" />

      <div className="grid gap-2 md:grid-cols-7">
        {days.map((d) => {
          const items = itemsForDate(d)
          const s = summarize(items)
          return (
            <div
              key={d}
              className={`card flex min-h-28 flex-col p-2 md:min-h-96 ${
                d === today ? 'border-indigo-400 ring-1 ring-indigo-200' : ''
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <button
                  className="text-left hover:text-indigo-700"
                  onClick={() => navigate(d === today ? '/' : `/?d=${d}`)}
                  title="Xem chi tiết ngày"
                >
                  <div className="text-xs font-semibold uppercase text-slate-500">{fmt(d, 'EEEEEE')}</div>
                  <div className={`text-lg font-bold leading-tight ${d === today ? 'text-indigo-700' : ''}`}>
                    {fmt(d, 'dd/MM')}
                  </div>
                </button>
                <button
                  className="rounded-md px-2 py-0.5 text-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-700"
                  aria-label={`Thêm việc ngày ${fmt(d, 'dd/MM')}`}
                  onClick={() => openTaskForm({ date: d })}
                >
                  +
                </button>
              </div>
              {items.length > 0 && (
                <div className="mb-2">
                  <ProgressBar value={s.completionRate} className="h-1.5" />
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    {s.done}/{s.total - s.skipped} xong
                  </div>
                </div>
              )}
              <div className="space-y-1">
                {items.map((i) => <TaskRow key={i.task.id} item={i} compact />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
