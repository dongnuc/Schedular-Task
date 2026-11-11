import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { addMonths } from 'date-fns'
import { PageHeader, ProgressBar } from '../components/Widgets'
import { useData } from '../context/DataContext'
import { useUI } from '../context/UIContext'
import { colorOf } from '../lib/colors'
import { fmt, fromKey, monthDays, monthGrid, toKey, todayKey } from '../lib/dates'
import { summarize } from '../lib/stats'
import { useDateParam } from '../lib/useDateParam'

const HEAD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const MAX_VISIBLE = 3

export default function MonthPage() {
  const [date, setDate] = useDateParam()
  const { ensureRange, itemsForDate, itemsForDates } = useData()
  const { openTaskForm } = useUI()
  const navigate = useNavigate()

  const current = fromKey(date)
  const grid = useMemo(() => monthGrid(fromKey(date)), [date])
  const inMonth = useMemo(() => monthDays(fromKey(date)), [date])
  const from = grid[0]
  const to = grid[grid.length - 1]
  useEffect(() => ensureRange(from, to), [from, to, ensureRange])

  const summary = useMemo(() => summarize(itemsForDates(inMonth)), [itemsForDates, inMonth])
  const today = todayKey()
  const monthPrefix = date.slice(0, 7)

  return (
    <div>
      <PageHeader
        title={fmt(current, "'Tháng' MM/yyyy")}
        subtitle={`Hoàn thành ${summary.done}/${summary.total - summary.skipped} việc · ${summary.completionRate}%`}
        onPrev={() => setDate(toKey(addMonths(current, -1)))}
        onNext={() => setDate(toKey(addMonths(current, 1)))}
        onToday={() => setDate(today)}
        actions={
          <button className="btn-primary" onClick={() => openTaskForm({ date })}>
            + Thêm việc
          </button>
        }
      />
      <ProgressBar value={summary.completionRate} className="mb-4" />

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500">
          {HEAD.map((h) => <div key={h} className="py-2">{h}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((d) => {
            const items = itemsForDate(d)
            const s = summarize(items)
            const outside = !d.startsWith(monthPrefix)
            return (
              <button
                key={d}
                onClick={() => navigate(d === today ? '/' : `/?d=${d}`)}
                className={`flex min-h-20 flex-col border-b border-r border-slate-100 p-1 text-left align-top hover:bg-indigo-50/50 sm:min-h-28 sm:p-1.5 ${
                  outside ? 'bg-slate-50/60 text-slate-400' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      d === today ? 'bg-indigo-600 text-white' : ''
                    }`}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {items.length > 0 && (
                    <span
                      className={`text-[10px] tabular-nums ${
                        s.completionRate === 100 ? 'font-semibold text-emerald-600' : 'text-slate-500'
                      }`}
                    >
                      {s.done}/{s.total - s.skipped}
                    </span>
                  )}
                </div>
                <div className="mt-1 hidden space-y-0.5 sm:block">
                  {items.slice(0, MAX_VISIBLE).map((i) => (
                    <div key={i.task.id} className="flex items-center gap-1 text-[11px]">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colorOf(i.task.color).dot}`} />
                      <span
                        className={`truncate ${
                          i.status === 'done' || i.status === 'skipped' ? 'text-slate-400 line-through' : ''
                        }`}
                      >
                        {i.task.title}
                      </span>
                    </div>
                  ))}
                  {items.length > MAX_VISIBLE && (
                    <div className="text-[10px] text-slate-500">+{items.length - MAX_VISIBLE} việc khác</div>
                  )}
                </div>
                {/* Mobile: chỉ hiện chấm màu */}
                <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                  {items.slice(0, 6).map((i) => (
                    <span key={i.task.id} className={`h-1.5 w-1.5 rounded-full ${colorOf(i.task.color).dot}`} />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
