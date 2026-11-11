import { useEffect, useMemo, useState } from 'react'
import { addMonths } from 'date-fns'
import { PageHeader, ProgressBar, SummaryTiles } from '../components/Widgets'
import { useData } from '../context/DataContext'
import { colorOf } from '../lib/colors'
import { fmt, fromKey, monthDays, shiftKey, toKey, todayKey, weekDays } from '../lib/dates'
import { describeRecurrence } from '../lib/recurrence'
import { summarize } from '../lib/stats'
import type { DayItem, Task } from '../lib/types'
import { useDateParam } from '../lib/useDateParam'

type Range = 'week' | 'month'

export default function StatsPage() {
  const [date, setDate] = useDateParam()
  const [range, setRange] = useState<Range>('week')
  const { ensureRange, itemsForDate } = useData()

  const days = useMemo(
    () => (range === 'week' ? weekDays(fromKey(date)) : monthDays(fromKey(date))),
    [range, date],
  )
  const from = days[0]
  const to = days[days.length - 1]
  useEffect(() => ensureRange(from, to), [from, to, ensureRange])

  const perDay = useMemo(
    () => days.map((d) => ({ date: d, items: itemsForDate(d) })),
    [days, itemsForDate],
  )
  const all = useMemo(() => perDay.flatMap((d) => d.items), [perDay])
  const summary = useMemo(() => summarize(all), [all])

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
    () =>
      all
        .filter((i) => i.occurrence?.result_note)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [all],
  )

  const step = (dir: 1 | -1) =>
    setDate(range === 'week' ? shiftKey(date, 7 * dir) : toKey(addMonths(fromKey(date), dir)))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Thống kê"
        subtitle={`${fmt(from, 'dd/MM')} – ${fmt(to, 'dd/MM/yyyy')}`}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={() => setDate(todayKey())}
        actions={
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
            {(['week', 'month'] as const).map((r) => (
              <button
                key={r}
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={`px-3 py-2 font-medium ${
                  range === r ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {r === 'week' ? 'Tuần' : 'Tháng'}
              </button>
            ))}
          </div>
        }
      />

      <SummaryTiles summary={summary} />

      <section className="card p-4">
        <h2 className="text-sm font-semibold">Tỷ lệ hoàn thành theo ngày</h2>
        <p className="mb-3 text-xs text-slate-500">Chiều cao cột = % việc hoàn thành trong ngày</p>
        <div className="flex h-40 items-end gap-[3px]">
          {perDay.map(({ date: d, items }) => {
            const s = summarize(items)
            const counted = s.total - s.skipped
            return (
              <div
                key={d}
                className="group relative flex h-full flex-1 flex-col justify-end"
                title={`${fmt(d, 'EEEEEE dd/MM')}: ${counted ? `${s.done}/${counted} việc (${s.completionRate}%)` : 'không có việc'}`}
              >
                {range === 'week' && counted > 0 && (
                  <div className="mb-1 text-center text-[11px] tabular-nums text-slate-600">
                    {s.completionRate}%
                  </div>
                )}
                <div
                  className={`w-full rounded-t ${counted ? 'bg-indigo-500 group-hover:bg-indigo-600' : 'bg-slate-200'}`}
                  style={{ height: counted ? `${Math.max(2, s.completionRate * 0.85)}%` : '2px' }}
                />
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex gap-[3px] border-t border-slate-200 pt-1">
          {perDay.map(({ date: d }) => (
            <div
              key={d}
              className={`flex-1 text-center text-[10px] ${
                d === todayKey() ? 'font-bold text-indigo-700' : 'text-slate-500'
              }`}
            >
              {range === 'week' ? fmt(d, 'EEEEEE') : Number(d.slice(8)) % 5 === 0 || d.endsWith('-01') ? Number(d.slice(8)) : ''}
            </div>
          ))}
        </div>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="p-4 pb-2 text-sm font-semibold">Theo từng công việc</h2>
        {perTask.length === 0 ? (
          <p className="p-4 pt-0 text-sm text-slate-500">Không có công việc nào trong khoảng này.</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Công việc</th>
                <th className="px-2 py-2 text-right font-medium">Số lần</th>
                <th className="px-2 py-2 text-right font-medium">Xong</th>
                <th className="px-2 py-2 text-right font-medium">Bỏ qua</th>
                <th className="px-2 py-2 text-right font-medium">Chất lượng</th>
                <th className="w-48 px-4 py-2 font-medium">Tỷ lệ hoàn thành</th>
              </tr>
            </thead>
            <tbody>
              {perTask.map(({ task, summary: s }) => (
                <tr key={task.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorOf(task.color).dot}`} />
                      <span className="font-medium">{task.title}</span>
                    </div>
                    <div className="pl-[18px] text-xs text-slate-500">
                      {describeRecurrence(task) ?? 'Một lần'}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.total}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.done}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.skipped}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {s.avgRating ? `${s.avgRating} ★` : '–'}
                  </td>
                  <td className="px-4 py-2">
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

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">Kết quả đã ghi nhận</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có ghi chú kết quả. Bấm vào một công việc để ghi lại kết quả thực hiện.
          </p>
        ) : (
          <ul className="space-y-3">
            {notes.map((i) => (
              <li key={`${i.task.id}|${i.date}`} className="border-l-2 border-slate-200 pl-3">
                <div className="text-xs text-slate-500">
                  {fmt(i.date, 'EEEEEE dd/MM')} · {i.task.title}
                  {i.occurrence?.rating ? ` · ${i.occurrence.rating} ★` : ''}
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
