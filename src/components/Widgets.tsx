import type { ReactNode } from 'react'
import type { Summary } from '../lib/stats'

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-2 overflow-hidden rounded-full bg-slate-200 ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all ${value >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  onPrev,
  onNext,
  onToday,
  actions,
}: {
  title: string
  subtitle?: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="mr-auto">
        <h1 className="text-xl font-bold capitalize">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1">
        <button className="btn-ghost" onClick={onPrev} aria-label="Trước">‹</button>
        <button className="btn-ghost" onClick={onToday}>Hôm nay</button>
        <button className="btn-ghost" onClick={onNext} aria-label="Sau">›</button>
      </div>
      {actions}
    </div>
  )
}

export function SummaryTiles({ summary }: { summary: Summary }) {
  const tiles = [
    { label: 'Tỷ lệ hoàn thành', value: `${summary.completionRate}%`, sub: `${summary.done}/${summary.total - summary.skipped} việc` },
    { label: 'Tiến độ trung bình', value: `${summary.avgProgress}%`, sub: `${summary.inProgress} đang làm` },
    { label: 'Chưa làm', value: String(summary.pending), sub: `${summary.skipped} bỏ qua` },
    { label: 'Chất lượng TB', value: summary.avgRating ? `${summary.avgRating} ★` : '–', sub: 'tự đánh giá' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="card p-4">
          <div className="text-xs text-slate-500">{t.label}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{t.value}</div>
          <div className="text-xs text-slate-500">{t.sub}</div>
        </div>
      ))}
    </div>
  )
}
