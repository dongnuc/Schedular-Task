import { useRef, type ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-2 overflow-hidden rounded-full bg-slate-100 ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all ${value >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function PageHeader({
  icon,
  iconClass = 'bg-indigo-50 text-indigo-600',
  title,
  subtitle,
  children,
}: {
  icon: IconName
  iconClass?: string
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${iconClass}`}>
          <Icon name={icon} className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

export function DateNav({
  onPrev,
  onNext,
  onToday,
}: {
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button className="btn-icon" onClick={onPrev} aria-label="Trước">
        <Icon name="chevron-left" />
      </button>
      <button className="btn-ghost" onClick={onToday}>Hôm nay</button>
      <button className="btn-icon" onClick={onNext} aria-label="Sau">
        <Icon name="chevron-right" />
      </button>
    </div>
  )
}

export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn-primary" onClick={onClick}>
      <Icon name="plus" className="h-4 w-4" strokeWidth={2.5} /> Thêm việc
    </button>
  )
}

/** Nút lịch: mở bộ chọn ngày của trình duyệt. */
export function DatePickerButton({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <span className="relative inline-flex">
      <button
        className="btn-icon"
        aria-label="Chọn ngày"
        onClick={() => {
          const el = ref.current
          if (!el) return
          if (typeof el.showPicker === 'function') el.showPicker()
          else el.focus()
        }}
      >
        <Icon name="calendar" />
      </button>
      <input
        ref={ref}
        type="date"
        value={value}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </span>
  )
}

export type Tone = 'indigo' | 'emerald' | 'sky' | 'orange' | 'violet'

const TONE_SOLID: Record<Tone, string> = {
  indigo: 'bg-indigo-600',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  orange: 'bg-orange-500',
  violet: 'bg-violet-500',
}

const TONE_SOFT: Record<Tone, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  sky: 'bg-sky-50 text-sky-600',
  orange: 'bg-orange-50 text-orange-600',
  violet: 'bg-violet-50 text-violet-600',
}

/** Ô số liệu: icon tròn đặc màu + số lớn + nhãn. */
export function StatTile({
  icon,
  tone,
  value,
  label,
  note,
}: {
  icon: IconName
  tone: Tone
  value: string | number
  label: string
  note?: ReactNode
}) {
  return (
    <div className="card flex items-center gap-3.5 p-4">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-white ${TONE_SOLID[tone]}`}>
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold leading-none tabular-nums">{value}</div>
        <div className="mt-1 text-sm text-slate-600">{label}</div>
        {note && <div className="mt-0.5 text-xs">{note}</div>}
      </div>
    </div>
  )
}

/** Ô số liệu kiểu thống kê: nhãn trên, số lớn, mô tả, hình minh hoạ bên phải. */
export function MetricTile({
  label,
  value,
  sub,
  visual,
}: {
  label: string
  value: string | number
  sub?: ReactNode
  visual?: ReactNode
}) {
  return (
    <div className="card flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <div className="mt-1 text-3xl font-extrabold leading-none tabular-nums">{value}</div>
        {sub && <div className="mt-1.5 text-xs text-slate-500">{sub}</div>}
      </div>
      {visual}
    </div>
  )
}

export function SoftIcon({ icon, tone, className = '' }: { icon: IconName; tone: Tone; className?: string }) {
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${TONE_SOFT[tone]} ${className}`}>
      <Icon name={icon} className="h-5 w-5" />
    </span>
  )
}

export function Delta({ value, suffix = '%', label }: { value: number | null; suffix?: string; label?: string }) {
  if (value === null) return <span className="text-slate-400">{label ?? 'Chưa có dữ liệu kỳ trước'}</span>
  const up = value >= 0
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icon name={up ? 'trending-up' : 'trending-down'} className="h-3.5 w-3.5" />
      {up ? '+' : ''}
      {value}
      {suffix}
      {label && <span className="font-normal text-slate-500">{label}</span>}
    </span>
  )
}

export interface DonutSegment {
  value: number
  className: string // ví dụ "stroke-emerald-500"
  label: string
}

/** Biểu đồ vòng. `segments` được chuẩn hoá theo tổng; children hiển thị ở giữa. */
export function DonutChart({
  segments,
  size = 120,
  stroke = 4.5,
  children,
}: {
  segments: DonutSegment[]
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  let offset = 0
  const summary = segments.map((s) => `${s.label}: ${s.value}`).join(', ')
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="-rotate-90" role="img" aria-label={`Biểu đồ vòng. ${summary}`}>
        <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth={stroke} className="stroke-slate-100" />
        {total > 0 &&
          segments.map((s, i) => {
            const pct = (s.value / total) * 100
            const el = (
              <circle
                key={i}
                cx="18"
                cy="18"
                r="15.9155"
                fill="none"
                strokeWidth={stroke}
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeDashoffset={-offset}
                className={s.className}
              />
            )
            offset += pct
            return el
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
