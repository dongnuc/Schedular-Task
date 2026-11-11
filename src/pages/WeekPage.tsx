import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import TaskRow from '../components/TaskRow'
import { AddButton, DateNav, PageHeader, ProgressBar } from '../components/Widgets'
import { useData } from '../context/DataContext'
import { useUI } from '../context/UIContext'
import { fmt, fromKey, shiftKey, todayKey, weekDays, weekdayLabel } from '../lib/dates'
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
        icon="calendar"
        title={`Tuần ${fmt(from, 'dd/MM')} – ${fmt(to, 'dd/MM/yyyy')}`}
        subtitle={`Hoàn thành: ${summary.done}/${summary.total - summary.skipped} việc - ${summary.completionRate}%`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <DateNav
            onPrev={() => setDate(shiftKey(date, -7))}
            onNext={() => setDate(shiftKey(date, 7))}
            onToday={() => setDate(today)}
          />
          <AddButton onClick={() => openTaskForm({ date })} />
        </div>
      </PageHeader>

      <ProgressBar value={summary.completionRate} className="mb-5" />

      <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
        {days.map((d) => {
          const items = itemsForDate(d)
          const s = summarize(items)
          const isToday = d === today
          return (
            <section
              key={d}
              aria-label={`${weekdayLabel(d)} ${fmt(d, 'dd/MM')}`}
              className={`card flex min-h-40 flex-col p-3 md:min-h-[26rem] ${
                isToday ? '!border-indigo-500 ring-2 ring-indigo-100' : ''
              }`}
            >
              <div className="mb-3 flex items-start justify-between">
                <button
                  className="text-left"
                  onClick={() => navigate(isToday ? '/' : `/?d=${d}`)}
                  title="Xem chi tiết ngày"
                >
                  <div className="text-xs font-semibold text-slate-500">{weekdayLabel(d)}</div>
                  <div className={`text-lg font-extrabold leading-tight ${isToday ? 'text-indigo-700' : ''}`}>
                    {fmt(d, 'dd/MM')}
                  </div>
                </button>
                <button
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-700"
                  aria-label={`Thêm việc ngày ${fmt(d, 'dd/MM')}`}
                  onClick={() => openTaskForm({ date: d })}
                >
                  <Icon name="plus" className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>

              {items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center text-xs text-slate-400">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-300">
                    <Icon name="clipboard" className="h-6 w-6" />
                  </span>
                  Chưa có task
                </div>
              ) : (
                <>
                  <div className="mb-2">
                    <ProgressBar value={s.completionRate} className="h-1.5" />
                    <div className="mt-1 text-[11px] text-slate-500">
                      {s.done}/{s.total - s.skipped} xong
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((i) => <TaskRow key={i.task.id} item={i} compact />)}
                  </div>
                </>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
