import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { addMonths } from 'date-fns'
import { AddButton, DateNav, PageHeader, ProgressBar } from '../components/Widgets'
import { useData } from '../context/DataContext'
import { useUI } from '../context/UIContext'
import { colorOf } from '../lib/colors'
import { fmt, fromKey, monthDays, monthGrid, toKey, todayKey } from '../lib/dates'
import { summarize } from '../lib/stats'
import { useDateParam } from '../lib/useDateParam'

const HEAD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const MAX_VISIBLE = 2

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
        icon="calendar-days"
        title={fmt(current, "'Tháng' MM/yyyy")}
        subtitle={`Hoàn thành: ${summary.done}/${summary.total - summary.skipped} việc - ${summary.completionRate}%`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <DateNav
            onPrev={() => setDate(toKey(addMonths(current, -1)))}
            onNext={() => setDate(toKey(addMonths(current, 1)))}
            onToday={() => setDate(today)}
          />
          <AddButton onClick={() => openTaskForm({ date })} />
        </div>
      </PageHeader>

      <ProgressBar value={summary.completionRate} className="mb-5" />

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100 text-center text-xs font-semibold text-slate-500">
          {HEAD.map((h) => <div key={h} className="py-3">{h}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((d) => {
            const items = itemsForDate(d)
            const s = summarize(items)
            const outside = !d.startsWith(monthPrefix)
            const isToday = d === today
            return (
              <button
                key={d}
                onClick={() => navigate(isToday ? '/' : `/?d=${d}`)}
                aria-label={`${fmt(d, 'dd/MM/yyyy')}${items.length ? `, ${items.length} việc` : ''}`}
                className={`flex min-h-[4.5rem] flex-col items-start border-b border-r border-slate-50 p-1.5 text-left transition-colors hover:bg-indigo-50/60 sm:min-h-28 sm:p-2 ${
                  outside ? 'text-slate-300' : ''
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${
                      isToday ? 'bg-indigo-600 text-white' : ''
                    }`}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {items.length > 0 && !outside && (
                    <span
                      className={`hidden text-[11px] tabular-nums sm:inline ${
                        s.completionRate === 100 ? 'font-semibold text-emerald-600' : 'text-slate-500'
                      }`}
                    >
                      {s.done}/{s.total - s.skipped}
                    </span>
                  )}
                </div>

                <div className="mt-1 hidden w-full space-y-0.5 lg:block">
                  {items.slice(0, MAX_VISIBLE).map((i) => (
                    <div key={i.task.id} className="flex items-center gap-1.5 text-xs">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colorOf(i.task.color).dot}`} />
                      <span
                        className={`truncate ${
                          i.status === 'done' || i.status === 'skipped' ? 'text-slate-400 line-through' : 'text-slate-700'
                        }`}
                      >
                        {i.task.title}
                      </span>
                    </div>
                  ))}
                  {items.length > MAX_VISIBLE && (
                    <div className="text-[11px] text-slate-500">+{items.length - MAX_VISIBLE} việc khác</div>
                  )}
                </div>

                {/* Màn nhỏ: chỉ hiện chấm màu */}
                <div className="mt-1 flex flex-wrap gap-1 lg:hidden">
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
