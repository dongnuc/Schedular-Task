import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { addMonths } from 'date-fns'
import { fmt, fromKey, monthGrid, todayKey } from '../lib/dates'
import Icon from './Icon'

const HEAD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const PANEL_W = 288

/** Hộp nổi gắn vào nút neo; render qua portal để không bị modal cắt. */
function Popover({
  anchorRef,
  align = 'left',
  label,
  onClose,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>
  align?: 'left' | 'right'
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect()
      const p = panelRef.current
      if (!a || !p) return
      const w = p.offsetWidth
      const h = p.offsetHeight
      const left = Math.max(8, Math.min(align === 'right' ? a.right - w : a.left, window.innerWidth - w - 8))
      let top = a.bottom + 8
      if (top + h > window.innerHeight - 8 && a.top - h - 8 >= 8) top = a.top - h - 8
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchorRef, align])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !anchorRef.current?.contains(t)) onClose()
    }
    // Capture + stopPropagation để Esc chỉ đóng lịch, không đóng luôn modal bên dưới.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        anchorRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [anchorRef, onClose])

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, width: PANEL_W, visibility: pos ? 'visible' : 'hidden' }}
      className="card z-[60] p-3"
    >
      {children}
    </div>,
    document.body,
  )
}

function Calendar({
  value,
  min,
  clearable,
  onPick,
  onClear,
}: {
  value: string
  min?: string
  clearable?: boolean
  onPick: (d: string) => void
  onClear: () => void
}) {
  const [view, setView] = useState(() => fromKey(value || todayKey()))
  const days = useMemo(() => monthGrid(view), [view])
  const today = todayKey()

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="btn-icon !h-8 !w-8 !rounded-lg" aria-label="Tháng trước" onClick={() => setView(addMonths(view, -1))}>
          <Icon name="chevron-left" className="h-4 w-4" />
        </button>
        <div className="text-sm font-extrabold" aria-live="polite">{fmt(view, "'Tháng' MM/yyyy")}</div>
        <button type="button" className="btn-icon !h-8 !w-8 !rounded-lg" aria-label="Tháng sau" onClick={() => setView(addMonths(view, 1))}>
          <Icon name="chevron-right" className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-500">
        {HEAD.map((h) => <div key={h} className="py-1">{h}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => {
          const outside = fromKey(d).getMonth() !== view.getMonth()
          const selected = d === value
          const disabled = Boolean(min && d < min)
          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              aria-label={fmt(d, 'EEEE, dd/MM/yyyy')}
              aria-current={d === today ? 'date' : undefined}
              aria-pressed={selected}
              onClick={() => onPick(d)}
              className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-sm tabular-nums transition-colors ${
                selected
                  ? 'bg-indigo-600 font-bold text-white'
                  : disabled
                    ? 'cursor-not-allowed text-slate-300'
                    : d === today
                      ? 'font-bold text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-50'
                      : outside
                        ? 'text-slate-400 hover:bg-slate-50'
                        : 'text-slate-800 hover:bg-indigo-50'
              }`}
            >
              {Number(d.slice(8))}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
        {clearable && value ? (
          <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50" onClick={onClear}>
            Xoá ngày
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={Boolean(min && today < min)}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:text-slate-300 disabled:hover:bg-transparent"
          onClick={() => onPick(today)}
        >
          Hôm nay
        </button>
      </div>
    </div>
  )
}

/** Ô chọn ngày dùng trong form: bấm để mở lịch. */
export function DateField({
  id,
  value,
  onChange,
  min,
  clearable = false,
  placeholder = 'Chọn ngày',
}: {
  id?: string
  value: string
  onChange: (d: string) => void
  min?: string
  clearable?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={ref}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span className={value ? '' : 'text-slate-400'}>{value ? fmt(value, 'dd/MM/yyyy') : placeholder}</span>
        <Icon name="calendar" className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <Popover anchorRef={ref} label="Chọn ngày" onClose={() => setOpen(false)}>
          <Calendar
            value={value}
            min={min}
            clearable={clearable}
            onPick={(d) => {
              onChange(d)
              setOpen(false)
            }}
            onClear={() => {
              onChange('')
              setOpen(false)
            }}
          />
        </Popover>
      )}
    </>
  )
}

/** Nút icon lịch (thanh tiêu đề trang Hôm nay) mở lịch chọn ngày. */
export function DatePickerButton({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={ref}
        className="btn-icon"
        aria-label="Chọn ngày"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="calendar" />
      </button>
      {open && (
        <Popover anchorRef={ref} align="right" label="Chọn ngày" onClose={() => setOpen(false)}>
          <Calendar
            value={value}
            onPick={(d) => {
              onChange(d)
              setOpen(false)
            }}
            onClear={() => setOpen(false)}
          />
        </Popover>
      )}
    </>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))

/** Chọn giờ bằng hai ô chọn giờ/phút (bước 5 phút). `optional` cho phép để trống. */
export function TimeField({
  id,
  label,
  value,
  onChange,
  optional = false,
}: {
  id?: string
  label: string
  value: string
  onChange: (t: string) => void
  optional?: boolean
}) {
  const [h = '', m = ''] = value ? value.slice(0, 5).split(':') : []
  const minutes = useMemo(() => {
    const base = Array.from({ length: 12 }, (_, i) => pad(i * 5))
    return m && !base.includes(m) ? [...base, m].sort() : base
  }, [m])

  return (
    <div className="flex items-center gap-1.5">
      <select
        id={id}
        aria-label={`${label} - giờ`}
        className="input px-2.5"
        value={h}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}:${m || '00'}` : '')}
      >
        {optional && <option value="">--</option>}
        {HOURS.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <span aria-hidden="true" className="font-bold text-slate-400">:</span>
      <select
        aria-label={`${label} - phút`}
        className="input px-2.5"
        disabled={!h}
        value={h ? m || '00' : ''}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
      >
        {!h && <option value="">--</option>}
        {minutes.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </div>
  )
}
