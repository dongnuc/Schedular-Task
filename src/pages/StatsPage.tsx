import { useEffect, useMemo, useState } from 'react'
import { addMonths } from 'date-fns'
import Icon from '../components/Icon'
import { DateNav, Delta, DonutChart, MetricTile, PageHeader, ProgressBar, SoftIcon } from '../components/Widgets'
import { useData } from '../context/DataContext'
import { colorOf } from '../lib/colors'
import { fmt, fromKey, monthDays, shiftKey, toKey, todayKey, weekDays, weekdayLabel } from '../lib/dates'
import { describeRecurrence } from '../lib/recurrence'
import { summarize } from '../lib/stats'
import type { DayItem, Task } from '../lib/types'
import { useDateParam } from '../lib/useDateParam'

type Range = 'week' | 'month'
type Series = (number | null)[]

/** Biểu đồ đường: tuần này (liền) so với kỳ trước (nét đứt). Ngày không có việc → ngắt đường. */
function LineChart({ cur, prev, labels, range }: { cur: Series; prev: Series; labels: string[]; range: Range }) {
  const W = 640
  const H = 240
  const L = 46
  const R = 14
  const T = 14
  const B = 30
  const n = Math.max(cur.length, 2)
  const x = (i: number) => L + (i * (W - L - R)) / (n - 1)
  const y = (v: number) => T + (1 - v / 100) * (H - T - B)
  const path = (s: Series) => {
    let d = ''
    let pen = false
    s.forEach((v, i) => {
      if (v === null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `
      pen = true
    })
    return d
  }
  const summary = cur.map((v, i) => `${labels[i]}: ${v === null ? 'không có việc' : `${v}%`}`).join('; ')

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Biểu đồ tỷ lệ hoàn thành theo ngày. ${summary}`} className="h-auto min-w-[520px] w-full">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} className="stroke-slate-100" />
            <text x={L - 8} y={y(g) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">{g}%</text>
          </g>
        ))}
        {labels.map((l, i) =>
          range === 'week' || i % 5 === 0 || i === labels.length - 1 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">{l}</text>
          ) : null,
        )}
        <path d={path(prev)} fill="none" strokeWidth="2" strokeDasharray="5 5" className="stroke-slate-300" />
        <path d={path(cur)} fill="none" strokeWidth="2.5" strokeLinejoin="round" className="stroke-indigo-600" />
        {cur.map((v, i) =>
          v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r="4" className="fill-white stroke-indigo-600" strokeWidth="2.5" />,
        )}
      </svg>
    </div>
  )
}

export default function StatsPage() {
  const [date, setDate] = useDateParam()
  const [range, setRange] = useState<Range>('week')
  const { ensureRange, itemsForDate } = useData()

  const days = useMemo(() => (range === 'week' ? weekDays(fromKey(date)) : monthDays(fromKey(date))), [range, date])
  const prevDays = useMemo(
    () => (range === 'week' ? days.map((d) => shiftKey(d, -7)) : monthDays(addMonths(fromKey(date), -1))),
    [range, days, date],
  )
  const from = days[0]
  const to = days[days.length - 1]
  const pFrom = prevDays[0]
  const pTo = prevDays[prevDays.length - 1]
  useEffect(() => {
    ensureRange(from, to)
    ensureRange(pFrom, pTo)
  }, [from, to, pFrom, pTo, ensureRange])

  const perDay = useMemo(() => days.map((d) => ({ date: d, items: itemsForDate(d) })), [days, itemsForDate])
  const all = useMemo(() => perDay.flatMap((d) => d.items), [perDay])
  const summary = useMemo(() => summarize(all), [all])
  const prevItems = useMemo(() => prevDays.flatMap(itemsForDate), [prevDays, itemsForDate])
  const prevSummary = useMemo(() => summarize(prevItems), [prevItems])

  const rate = (items: DayItem[]) => {
    const s = summarize(items)
    return s.total - s.skipped > 0 ? s.completionRate : null
  }
  const cur: Series = perDay.map((d) => rate(d.items))
  const prev: Series = prevDays.map((d) => rate(itemsForDate(d)))
  const labels = days.map((d) => (range === 'week' ? weekdayLabel(d) : String(Number(d.slice(8)))))

  const perTask = useMemo(() => {
    const map = new Map<string, { task: Task; items: DayItem[] }>()
    for (const it of all) {
      const entry = map.get(it.task.id) ?? { task: it.task, items: [] }
      entry.items.push(it)
      map.set(it.task.id, entry)
    }
    return [...map.values()]
      .map((e) => ({ task: e.task, summary: summarize(e.items) }))
      .sort((a, b) => b.summary.total - a.summary.total || a.task.title.localeCompare(b.task.title))
  }, [all])

  const notes = useMemo(
    () => all.filter((i) => i.occurrence?.result_note).sort((a, b) => b.date.localeCompare(a.date)),
    [all],
  )

  const step = (dir: 1 | -1) =>
    setDate(range === 'week' ? shiftKey(date, 7 * dir) : toKey(addMonths(fromKey(date), dir)))

  const period = range === 'week' ? 'tuần' : 'tháng'
  const counted = summary.total - summary.skipped
  const progressDelta = prevSummary.total ? summary.avgProgress - prevSummary.avgProgress : null

  return (
    <div className="space-y-5">
      <PageHeader icon="bar-chart" title="Thống Kê" subtitle={`${fmt(from, 'dd/MM')} – ${fmt(to, 'dd/MM/yyyy')}`}>
        <div className="flex flex-wrap items-center gap-2">
          <DateNav onPrev={() => step(-1)} onNext={() => step(1)} onToday={() => setDate(todayKey())} />
          <div role="group" aria-label="Khoảng thời gian" className="flex overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
            {(['week', 'month'] as const).map((r) => (
              <button
                key={r}
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={`min-h-10 px-4 font-semibold ${range === r ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {r === 'week' ? 'Tuần' : 'Tháng'}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Tỷ lệ hoàn thành"
          value={`${summary.completionRate}%`}
          sub={`${summary.done}/${counted} việc`}
          visual={
            <DonutChart size={64} stroke={5} segments={[{ value: summary.completionRate, className: 'stroke-indigo-600', label: 'Hoàn thành' }, { value: 100 - summary.completionRate, className: 'stroke-transparent', label: 'Còn lại' }]} />
          }
        />
        <MetricTile
          label="Tiến độ trung bình"
          value={`${summary.avgProgress}%`}
          sub={<Delta value={progressDelta} suffix="%" label={` so với ${period} trước`} />}
          visual={<SoftIcon icon="trending-up" tone="indigo" className="h-12 w-12" />}
        />
        <MetricTile
          label="Chưa làm"
          value={summary.pending + summary.inProgress}
          sub={`${summary.skipped} bỏ qua`}
          visual={<SoftIcon icon="clock" tone="orange" className="h-12 w-12" />}
        />
        <MetricTile
          label="Chất lượng TB"
          value={summary.avgRating ? summary.avgRating : '–'}
          sub="Tự đánh giá"
          visual={<SoftIcon icon="star" tone="orange" className="h-12 w-12" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2" aria-labelledby="chart-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="chart-title" className="font-extrabold">Biểu đồ tiến độ</h2>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded bg-indigo-600" />{range === 'week' ? 'Tuần này' : 'Tháng này'}</span>
              <span className="flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed border-slate-300" />{range === 'week' ? 'Tuần trước' : 'Tháng trước'}</span>
            </div>
          </div>
          <LineChart cur={cur} prev={prev} labels={labels} range={range} />
        </section>

        <section className="card p-5" aria-labelledby="hl-title">
          <h2 id="hl-title" className="mb-4 flex items-center gap-2 font-extrabold">
            <Icon name="trophy" className="h-5 w-5 text-amber-500" /> Kết quả nổi bật
          </h2>
          <ul className="space-y-4">
            <li className="flex items-center gap-3">
              <SoftIcon icon="check-circle" tone="emerald" className="!h-9 !w-9" />
              <span className="flex-1 text-sm text-slate-600">Hoàn thành đúng hạn</span>
              <span className="font-extrabold tabular-nums">{summary.onTimeRate === null ? '–' : `${summary.onTimeRate}%`}</span>
            </li>
            <li className="flex items-center gap-3">
              <SoftIcon icon="clipboard" tone="indigo" className="!h-9 !w-9" />
              <span className="flex-1 text-sm text-slate-600">Tổng task {period}</span>
              <span className="font-extrabold tabular-nums">{summary.total}</span>
            </li>
            <li className="flex items-center gap-3">
              <SoftIcon icon="alert" tone="orange" className="!h-9 !w-9" />
              <span className="flex-1 text-sm text-slate-600">Task quá hạn</span>
              <span className="font-extrabold tabular-nums">{summary.overdue}</span>
            </li>
          </ul>
        </section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="p-5 pb-3 font-extrabold">Theo từng công việc</h2>
        {perTask.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-500">Không có công việc nào trong khoảng này.</p>
        ) : (
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
                <th scope="col" className="px-5 py-2.5 font-semibold">Công việc</th>
                <th scope="col" className="px-2 py-2.5 text-right font-semibold">Số lần</th>
                <th scope="col" className="px-2 py-2.5 text-right font-semibold">Xong</th>
                <th scope="col" className="px-2 py-2.5 text-right font-semibold">Bỏ qua</th>
                <th scope="col" className="px-2 py-2.5 text-right font-semibold">Chất lượng</th>
                <th scope="col" className="w-52 px-5 py-2.5 font-semibold">Tỷ lệ hoàn thành</th>
              </tr>
            </thead>
            <tbody>
              {perTask.map(({ task, summary: s }) => (
                <tr key={task.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorOf(task.color).dot}`} />
                      <span className="font-semibold">{task.title}</span>
                    </div>
                    <div className="pl-[18px] text-xs text-slate-500">{describeRecurrence(task) ?? 'Một lần'}</div>
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{s.total}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{s.done}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{s.skipped}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{s.avgRating ?? '–'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={s.completionRate} className="flex-1" />
                      <span className="w-10 text-right text-xs tabular-nums">{s.completionRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-extrabold">Kết quả đã ghi nhận</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có ghi chú kết quả. Bấm vào một công việc để ghi lại kết quả thực hiện.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((i) => (
              <li key={`${i.task.id}|${i.date}`} className="border-l-2 border-indigo-100 pl-3">
                <div className="text-xs text-slate-500">
                  {weekdayLabel(i.date)} {fmt(i.date, 'dd/MM')} · {i.task.title}
                  {i.occurrence?.rating ? ` · ${i.occurrence.rating}/5 sao` : ''}
                </div>
                <div className="whitespace-pre-wrap text-sm">{i.occurrence?.result_note}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
