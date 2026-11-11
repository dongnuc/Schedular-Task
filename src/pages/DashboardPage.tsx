import { useEffect, useMemo } from 'react'
import { addMonths, getISODay } from 'date-fns'
import Icon from '../components/Icon'
import { Delta, DonutChart, PageHeader, StatTile } from '../components/Widgets'
import { useData } from '../context/DataContext'
import { fmt, fromKey, monthDays, toKey, todayKey } from '../lib/dates'
import { percentChange, summarize } from '../lib/stats'
import { useDateParam } from '../lib/useDateParam'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/** Cột: tỷ lệ hoàn thành trung bình theo thứ trong tuần. */
function BarChart({ values }: { values: (number | null)[] }) {
  const W = 520
  const H = 240
  const L = 46
  const R = 10
  const T = 14
  const B = 30
  const slot = (W - L - R) / values.length
  const y = (v: number) => T + (1 - v / 100) * (H - T - B)
  const summary = values.map((v, i) => `${WEEKDAYS[i]}: ${v === null ? 'không có việc' : `${v}%`}`).join('; ')
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tiến độ theo thứ trong tuần. ${summary}`} className="h-auto min-w-[360px] w-full">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} className="stroke-slate-100" />
            <text x={L - 8} y={y(g) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">{g}%</text>
          </g>
        ))}
        {values.map((v, i) => {
          const bw = Math.min(34, slot * 0.55)
          const cx = L + slot * i + slot / 2
          return (
            <g key={i}>
              {v !== null && v > 0 && (
                <rect x={cx - bw / 2} y={y(v)} width={bw} height={y(0) - y(v)} rx="6" className="fill-violet-400" />
              )}
              <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">{WEEKDAYS[i]}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function DashboardPage() {
  const [date, setDate] = useDateParam()
  const { ensureRange, itemsForDate } = useData()

  const days = useMemo(() => monthDays(fromKey(date)), [date])
  const prevDays = useMemo(() => monthDays(addMonths(fromKey(date), -1)), [date])
  const from = days[0]
  const to = days[days.length - 1]
  const pFrom = prevDays[0]
  const pTo = prevDays[prevDays.length - 1]
  useEffect(() => {
    ensureRange(from, to)
    ensureRange(pFrom, pTo)
  }, [from, to, pFrom, pTo, ensureRange])

  const items = useMemo(() => days.flatMap(itemsForDate), [days, itemsForDate])
  const prevItems = useMemo(() => prevDays.flatMap(itemsForDate), [prevDays, itemsForDate])
  const s = useMemo(() => summarize(items), [items])
  const p = useMemo(() => summarize(prevItems), [prevItems])

  const counted = s.total - s.skipped
  const open = s.pending + s.inProgress
  const pct = (n: number) => (counted ? Math.round((n / counted) * 100) : 0)

  const byWeekday = useMemo(() => {
    const buckets: { sum: number; n: number }[] = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }))
    for (const d of days) {
      const day = summarize(itemsForDate(d))
      if (day.total - day.skipped > 0) {
        const b = buckets[getISODay(fromKey(d)) - 1]
        b.sum += day.completionRate
        b.n++
      }
    }
    return buckets.map((b) => (b.n ? Math.round(b.sum / b.n) : null))
  }, [days, itemsForDate])

  const month = fromKey(date)
  const rateDelta = p.total ? s.completionRate - p.completionRate : null

  return (
    <div className="space-y-5">
      <PageHeader icon="dashboard" title="Tổng quan" subtitle="Nhìn nhanh hiệu suất công việc của bạn">
        <div className="flex items-center gap-1.5">
          <button className="btn-icon" aria-label="Tháng trước" onClick={() => setDate(toKey(addMonths(month, -1)))}>
            <Icon name="chevron-left" />
          </button>
          <button className="btn-ghost min-w-36" onClick={() => setDate(todayKey())} title="Về tháng này">
            {fmt(month, "'Tháng' MM/yyyy")}
            <Icon name="calendar" className="h-4 w-4 text-slate-500" />
          </button>
          <button className="btn-icon" aria-label="Tháng sau" onClick={() => setDate(toKey(addMonths(month, 1)))}>
            <Icon name="chevron-right" />
          </button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon="check-circle"
          tone="indigo"
          value={`${s.completionRate}%`}
          label="Tỷ lệ hoàn thành"
          note={<Delta value={rateDelta} suffix="%" />}
        />
        <StatTile
          icon="clipboard"
          tone="emerald"
          value={s.total}
          label="Tổng task"
          note={<Delta value={percentChange(s.total, p.total)} />}
        />
        <StatTile
          icon="check"
          tone="sky"
          value={s.done}
          label="Hoàn thành"
          note={<Delta value={percentChange(s.done, p.done)} />}
        />
        <StatTile
          icon="clock"
          tone="orange"
          value={open}
          label="Chưa hoàn thành"
          note={<Delta value={percentChange(open, p.pending + p.inProgress)} />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="dist-title">
          <h2 id="dist-title" className="mb-4 font-extrabold">Phân bố công việc</h2>
          <div className="flex flex-wrap items-center justify-center gap-8 py-2">
            <DonutChart
              size={172}
              stroke={4}
              segments={[
                { value: s.done, className: 'stroke-emerald-500', label: 'Hoàn thành' },
                { value: s.inProgress, className: 'stroke-indigo-500', label: 'Đang thực hiện' },
                { value: s.pending, className: 'stroke-orange-400', label: 'Chưa làm' },
              ]}
            >
              <span className="text-3xl font-extrabold tabular-nums">{s.completionRate}%</span>
            </DonutChart>
            <ul className="space-y-3 text-sm">
              {[
                { label: 'Hoàn thành', n: s.done, dot: 'bg-emerald-500' },
                { label: 'Đang thực hiện', n: s.inProgress, dot: 'bg-indigo-500' },
                { label: 'Chưa làm', n: s.pending, dot: 'bg-orange-400' },
              ].map((r) => (
                <li key={r.label} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${r.dot}`} />
                  <span className="w-32 text-slate-600">{r.label}</span>
                  <span className="font-extrabold tabular-nums">{pct(r.n)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card p-5" aria-labelledby="bar-title">
          <h2 id="bar-title" className="mb-2 font-extrabold">Tiến độ theo tuần</h2>
          <p className="mb-2 text-xs text-slate-500">Tỷ lệ hoàn thành trung bình theo từng thứ trong tháng</p>
          <BarChart values={byWeekday} />
        </section>
      </div>
    </div>
  )
}
