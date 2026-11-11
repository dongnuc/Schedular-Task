import { useEffect, useRef, type ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

interface Props {
  title: string
  icon?: IconName
  onClose: () => void
  children: ReactNode
}

export default function Modal({ title, icon, onClose, children }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-6 pb-2 pt-5">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            {icon && <Icon name={icon} className="h-5 w-5 text-indigo-600" strokeWidth={2.5} />}
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 pb-6 pt-2">{children}</div>
      </div>
    </div>
  )
}
