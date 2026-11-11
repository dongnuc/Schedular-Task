import { getISODay } from 'date-fns'
import { fromKey } from '../lib/dates'
import type { RecurrenceType } from '../lib/types'
import type { RecurrenceValue } from '../lib/recurrenceForm'
import { DateField } from './DatePicker'

const WEEKDAYS = [
  { iso: 1, label: 'T2', full: 'Thứ hai' },
  { iso: 2, label: 'T3', full: 'Thứ ba' },
  { iso: 3, label: 'T4', full: 'Thứ tư' },
  { iso: 4, label: 'T5', full: 'Thứ năm' },
  { iso: 5, label: 'T6', full: 'Thứ sáu' },
  { iso: 6, label: 'T7', full: 'Thứ bảy' },
  { iso: 7, label: 'CN', full: 'Chủ nhật' },
]

const PRESETS = [
  { label: 'Thứ 2 – Thứ 6', days: [1, 2, 3, 4, 5] },
  { label: 'Cuối tuần', days: [6, 7] },
  { label: 'Mỗi ngày', days: [1, 2, 3, 4, 5, 6, 7] },
]

const TYPES: { value: RecurrenceType; label: string }[] = [
  { value: 'none', label: 'Không lặp' },
  { value: 'daily', label: 'Hằng ngày' },
  { value: 'weekly', label: 'Các ngày trong tuần' },
  { value: 'monthly', label: 'Hằng tháng' },
]

const UNIT: Record<RecurrenceType, string> = { none: '', daily: 'ngày', weekly: 'tuần', monthly: 'tháng' }

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x))

interface Props {
  value: RecurrenceValue
  onChange: (v: RecurrenceValue) => void
  startDate: string
  idPrefix?: string
}

export default function RecurrenceFields({ value, onChange, startDate, idPrefix = 'rec' }: Props) {
  const set = (patch: Partial<RecurrenceValue>) => onChange({ ...value, ...patch })
  const toggleDay = (iso: number) =>
    set({ days: value.days.includes(iso) ? value.days.filter((d) => d !== iso) : [...value.days, iso] })

  const startIso = getISODay(fromKey(startDate))
  const effectiveDays = value.days.length ? value.days : [startIso]
  const weeklySummary = WEEKDAYS.filter((d) => effectiveDays.includes(d.iso)).map((d) => d.full).join(', ')

  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <label className="label" htmlFor={`${idPrefix}-type`}>Lặp lại</label>
      <select
        id={`${idPrefix}-type`}
        className="input"
        value={value.type}
        onChange={(e) => set({ type: e.target.value as RecurrenceType })}
      >
        {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      {value.type !== 'none' && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            Mỗi
            <input
              type="number"
              min={1}
              max={365}
              aria-label="Chu kỳ lặp"
              className="input w-20"
              value={value.interval}
              onChange={(e) => set({ interval: Number(e.target.value) })}
            />
            {UNIT[value.type]}
          </div>

          {value.type === 'weekly' && (
            <fieldset>
              <legend className="label">Chọn các ngày trong tuần</legend>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => {
                  const active = same(value.days, p.days)
                  return (
                    <button
                      key={p.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set({ days: active ? [] : p.days })}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => {
                  const on = value.days.includes(d.iso)
                  return (
                    <button
                      key={d.iso}
                      type="button"
                      aria-pressed={on}
                      aria-label={d.full}
                      onClick={() => toggleDay(d.iso)}
                      className={`h-10 w-11 rounded-xl text-sm font-semibold transition-colors ${
                        on ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50'
                      }`}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {value.days.length
                  ? `Lặp vào: ${weeklySummary}.`
                  : `Chưa chọn ngày nào → lặp vào ${weeklySummary} (thứ của ngày bắt đầu).`}
              </p>
            </fieldset>
          )}

          <div>
            <label className="label" htmlFor={`${idPrefix}-end`}>Lặp đến ngày (để trống = mãi mãi)</label>
            <DateField
              id={`${idPrefix}-end`}
              value={value.end}
              min={startDate}
              clearable
              placeholder="Không giới hạn"
              onChange={(end) => set({ end })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
