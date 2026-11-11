import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import TaskRow from '../components/TaskRow'
import { DatePickerButton, StatTile } from '../components/Widgets'
import { useData } from '../context/DataContext'
import { useUI } from '../context/UIContext'
import { fmt, shiftKey, todayKey } from '../lib/dates'
import { isOverdue, summarize } from '../lib/stats'
import { useDateParam } from '../lib/useDateParam'

type Filter = 'all' | 'pending' | 'in_progress' | 'done' | 'skipped' | 'overdue'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chưa bắt đầu' },
  { value: 'in_progress', label: 'Đang thực hiện' },
  { value: 'done', label: 'Hoàn thành' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'skipped', label: 'Bỏ qua' },
]

export default function DayPage() {
  const [date, setDate] = useDateParam()
  const { ensureRange, itemsForDate } = useData()
  const { openTaskForm } = useUI()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => ensureRange(date, date), [date, ensureRange])

  const items = useMemo(() => itemsForDate(date), [itemsForDate, date])
  const summary = useMemo(() => summarize(items), [items])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      if (q && !i.task.title.toLowerCase().includes(q)) return false
      if (filter === 'all') return true
      if (filter === 'overdue') return isOverdue(i)
      return i.status === filter
    })
  }, [items, query, filter])

  const isToday = date === todayKey()

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-72 items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-500">
            <Icon name="sun" className="h-8 w-8" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold capitalize leading-tight sm:text-2xl">
              {fmt(date, 'EEEE, dd/MM/yyyy')}
            </h1>
            <p className="text-sm text-slate-500">
              {isToday ? 'Chúc bạn có một ngày làm việc hiệu quả!' : 'Kế hoạch của ngày này'}
            </p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Tìm kiếm công việc"
              placeholder="Tìm kiếm task..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input rounded-full pl-9"
            />
          </div>
          <button className="btn-icon" aria-label="Ngày trước" onClick={() => setDate(shiftKey(date, -1))}>
            <Icon name="chevron-left" />
          </button>
          <button className="btn-icon" aria-label="Ngày sau" onClick={() => setDate(shiftKey(date, 1))}>
            <Icon name="chevron-right" />
          </button>
          <DatePickerButton value={date} onChange={setDate} />
          <Link to="/settings" className="btn-icon" aria-label="Cài đặt thông báo">
            <Icon name="bell" />
          </Link>
        </div>
      </div>

      {/* Số liệu */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="check-circle" tone="indigo" value={summary.total} label="Tổng task" />
        <StatTile icon="check" tone="emerald" value={summary.done} label="Hoàn thành" />
        <StatTile icon="clock" tone="sky" value={summary.inProgress} label="Đang thực hiện" />
        <StatTile icon="alert" tone="orange" value={summary.overdue} label="Quá hạn" />
      </div>

      {/* Danh sách */}
      <section className="card mt-5 p-4 sm:p-5" aria-labelledby="list-title">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 id="list-title" className="text-lg font-extrabold">
            {isToday ? 'Danh sách công việc hôm nay' : 'Danh sách công việc'}
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                aria-label="Lọc theo trạng thái"
                value={filter}
                onChange={(e) => setFilter(e.target.value as Filter)}
                className="input w-auto appearance-none pr-9 font-medium"
              >
                {FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <Icon name="chevron-down" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
            <button className="btn-primary" onClick={() => openTaskForm({ date })}>
              <Icon name="plus" className="h-4 w-4" strokeWidth={2.5} /> Thêm việc
            </button>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="grid place-items-center gap-3 px-4 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-indigo-50 text-indigo-500">
              <Icon name="clipboard" className="h-7 w-7" />
            </span>
            <p className="text-slate-500">
              {items.length === 0 ? 'Chưa có công việc nào cho ngày này.' : 'Không có công việc khớp bộ lọc.'}
            </p>
            {items.length === 0 && (
              <button className="btn-primary" onClick={() => openTaskForm({ date })}>
                <Icon name="plus" className="h-4 w-4" strokeWidth={2.5} /> Thêm việc đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div>
            {visible.map((i) => <TaskRow key={i.task.id} item={i} />)}
          </div>
        )}
      </section>
    </div>
  )
}
