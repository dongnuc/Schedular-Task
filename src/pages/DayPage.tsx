import { useEffect, useMemo } from 'react'
import TaskRow from '../components/TaskRow'
import { PageHeader, ProgressBar } from '../components/Widgets'
import { useData } from '../context/DataContext'
import { useUI } from '../context/UIContext'
import { fmt, shiftKey, todayKey } from '../lib/dates'
import { summarize } from '../lib/stats'
import { useDateParam } from '../lib/useDateParam'

export default function DayPage() {
  const [date, setDate] = useDateParam()
  const { ensureRange, itemsForDate } = useData()
  const { openTaskForm } = useUI()

  useEffect(() => ensureRange(date, date), [date, ensureRange])

  const items = useMemo(() => itemsForDate(date), [itemsForDate, date])
  const summary = useMemo(() => summarize(items), [items])
  const allDay = items.filter((i) => !i.task.start_time)
  const timed = items.filter((i) => i.task.start_time)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={fmt(date, 'EEEE, dd/MM/yyyy')}
        subtitle={date === todayKey() ? 'Hôm nay' : undefined}
        onPrev={() => setDate(shiftKey(date, -1))}
        onNext={() => setDate(shiftKey(date, 1))}
        onToday={() => setDate(todayKey())}
        actions={
          <button className="btn-primary" onClick={() => openTaskForm({ date })}>
            + Thêm việc
          </button>
        }
      />

      {items.length > 0 && (
        <div className="card mb-4 p-4">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="font-medium">
              Hoàn thành {summary.done}/{summary.total - summary.skipped} việc
            </span>
            <span className="text-lg font-bold tabular-nums">{summary.completionRate}%</span>
          </div>
          <ProgressBar value={summary.completionRate} />
          <div className="mt-2 text-xs text-slate-500">
            Tiến độ trung bình {summary.avgProgress}% · {summary.inProgress} đang làm ·{' '}
            {summary.pending} chưa làm · {summary.skipped} bỏ qua
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-500">Chưa có công việc nào cho ngày này.</p>
          <button className="btn-primary mt-4" onClick={() => openTaskForm({ date })}>
            + Thêm việc đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {allDay.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cả ngày
              </h2>
              <div className="space-y-2">
                {allDay.map((i) => <TaskRow key={i.task.id} item={i} />)}
              </div>
            </section>
          )}
          {timed.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Theo giờ
              </h2>
              <div className="space-y-2">
                {timed.map((i) => <TaskRow key={i.task.id} item={i} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
