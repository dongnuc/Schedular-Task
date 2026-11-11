export interface ColorDef {
  key: string
  label: string
  dot: string
  soft: string
  border: string
}

// Class viết đầy đủ để Tailwind quét được.
export const COLORS: ColorDef[] = [
  { key: 'blue', label: 'Xanh dương', dot: 'bg-blue-500', soft: 'bg-blue-50', border: 'border-l-blue-500' },
  { key: 'green', label: 'Xanh lá', dot: 'bg-emerald-500', soft: 'bg-emerald-50', border: 'border-l-emerald-500' },
  { key: 'amber', label: 'Vàng', dot: 'bg-amber-500', soft: 'bg-amber-50', border: 'border-l-amber-500' },
  { key: 'red', label: 'Đỏ', dot: 'bg-rose-500', soft: 'bg-rose-50', border: 'border-l-rose-500' },
  { key: 'purple', label: 'Tím', dot: 'bg-violet-500', soft: 'bg-violet-50', border: 'border-l-violet-500' },
  { key: 'teal', label: 'Xanh ngọc', dot: 'bg-teal-500', soft: 'bg-teal-50', border: 'border-l-teal-500' },
  { key: 'slate', label: 'Xám', dot: 'bg-slate-500', soft: 'bg-slate-100', border: 'border-l-slate-500' },
]

export const colorOf = (key: string) => COLORS.find((c) => c.key === key) ?? COLORS[0]

export const PRIORITY_LABEL: Record<number, string> = { 1: 'Thấp', 2: 'Vừa', 3: 'Cao' }

export const STATUS_LABEL = {
  pending: 'Chưa làm',
  in_progress: 'Đang làm',
  done: 'Hoàn thành',
  skipped: 'Bỏ qua',
} as const

export const STATUS_BADGE = {
  pending: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-amber-100 text-amber-800',
  done: 'bg-emerald-100 text-emerald-800',
  skipped: 'bg-slate-100 text-slate-400 line-through',
} as const
