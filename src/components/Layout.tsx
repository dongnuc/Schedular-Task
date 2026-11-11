import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { UIContext, type UIValue } from '../context/UIContext'
import { todayKey } from '../lib/dates'
import type { DayItem, Task } from '../lib/types'
import Icon, { Illustration, Logo, type IconName } from './Icon'
import OccurrenceModal from './OccurrenceModal'
import TaskFormModal from './TaskFormModal'

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Hôm nay', icon: 'home' },
  { to: '/week', label: 'Tuần', icon: 'calendar' },
  { to: '/month', label: 'Tháng', icon: 'calendar-days' },
  { to: '/dashboard', label: 'Tổng quan', icon: 'dashboard' },
  { to: '/stats', label: 'Thống kê', icon: 'bar-chart' },
  { to: '/settings', label: 'Cài đặt', icon: 'settings' },
]

type ModalState =
  | { kind: 'form'; task?: Task; date: string }
  | { kind: 'occurrence'; item: DayItem }
  | null

function UserMenu({ placement }: { placement: 'up' | 'down' }) {
  const { session, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const email = session?.user.email ?? ''
  const name = email.split('@')[0] || 'Bạn'

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-slate-50"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-600 text-sm font-bold uppercase text-white">
          {name[0]}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
        <Icon name="chevron-down" className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div
          role="menu"
          className={`card absolute z-40 w-56 p-1.5 ${
            placement === 'up' ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2'
          }`}
        >
          <div className="truncate px-3 py-2 text-xs text-slate-500">{email}</div>
          <Link
            role="menuitem"
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
          >
            <Icon name="settings" className="h-4 w-4" /> Cài đặt
          </Link>
          <button
            role="menuitem"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
          >
            <Icon name="log-out" className="h-4 w-4" /> Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { error, clearError, loading } = useData()
  const { search } = useLocation()
  const [modal, setModal] = useState<ModalState>(null)

  const ui = useMemo<UIValue>(
    () => ({
      openTaskForm: (opts) =>
        setModal({ kind: 'form', task: opts?.task, date: opts?.date ?? todayKey() }),
      openOccurrence: (item) => setModal({ kind: 'occurrence', item }),
    }),
    [],
  )

  // Giữ ?d=... khi chuyển giữa các trang xem theo ngày.
  const linkTo = (to: string) => (to === '/settings' ? to : `${to}${search}`)

  return (
    <UIContext.Provider value={ui}>
      <div className="bg-app min-h-screen">
        {/* Sidebar desktop */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-100 bg-white/80 p-4 backdrop-blur lg:flex">
          <div className="flex items-center gap-2.5 px-2 pb-6 pt-2">
            <Logo />
            <span className="text-xl font-extrabold tracking-tight">TaskEasy</span>
          </div>
          <nav aria-label="Điều hướng chính" className="space-y-1">
            {NAV.filter((n) => n.to !== '/settings').map((n) => (
              <NavLink
                key={n.to}
                to={linkTo(n.to)}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                <Icon name={n.icon} className="h-5 w-5" />
                {n.label}
              </NavLink>
            ))}
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <Icon name="settings" className="h-5 w-5" />
              Cài đặt
            </NavLink>
          </nav>
          <div className="mt-auto flex flex-col items-center gap-3">
            <Illustration className="h-28 w-auto" />
            <div className="w-full border-t border-slate-100 pt-3">
              <UserMenu placement="up" />
            </div>
          </div>
        </aside>

        {/* Thanh trên cho mobile/tablet */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-100 bg-white/90 px-4 py-2 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-extrabold tracking-tight">TaskEasy</span>
          </div>
          <div className="w-40">
            <UserMenu placement="down" />
          </div>
        </header>

        <div className="lg:pl-60">
          {error && (
            <div
              role="alert"
              className="mx-auto mt-4 flex max-w-6xl items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 sm:mx-8"
            >
              <span>Lỗi: {error}</span>
              <button onClick={clearError} aria-label="Đóng thông báo lỗi" className="p-1">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          )}
          <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-8 lg:pb-10 lg:pt-8">
            {loading ? <p className="text-sm text-slate-500">Đang tải dữ liệu…</p> : <Outlet />}
          </main>
        </div>

        {/* Thanh điều hướng dưới cho mobile */}
        <nav
          aria-label="Điều hướng chính"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-100 bg-white/95 backdrop-blur lg:hidden"
        >
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={linkTo(n.to)}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                  isActive ? 'text-indigo-700' : 'text-slate-500'
                }`
              }
            >
              <Icon name={n.icon} className="h-5 w-5" />
              {n.label}
            </NavLink>
          ))}
        </nav>

        {modal?.kind === 'form' && (
          <TaskFormModal task={modal.task} defaultDate={modal.date} onClose={() => setModal(null)} />
        )}
        {modal?.kind === 'occurrence' && (
          <OccurrenceModal
            item={modal.item}
            onClose={() => setModal(null)}
            onEdit={() => setModal({ kind: 'form', task: modal.item.task, date: modal.item.date })}
          />
        )}
      </div>
    </UIContext.Provider>
  )
}
