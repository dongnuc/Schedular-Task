import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { UIContext, type UIValue } from '../context/UIContext'
import { todayKey } from '../lib/dates'
import type { DayItem, Task } from '../lib/types'
import OccurrenceModal from './OccurrenceModal'
import TaskFormModal from './TaskFormModal'

const NAV = [
  { to: '/', label: 'Ngày', icon: '📋' },
  { to: '/week', label: 'Tuần', icon: '🗓️' },
  { to: '/month', label: 'Tháng', icon: '📅' },
  { to: '/stats', label: 'Thống kê', icon: '📊' },
  { to: '/settings', label: 'Cài đặt', icon: '⚙️' },
]

type ModalState =
  | { kind: 'form'; task?: Task; date: string }
  | { kind: 'occurrence'; item: DayItem }
  | null

export default function Layout() {
  const { signOut, session } = useAuth()
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

  // Giữ ?d=... khi chuyển giữa Ngày/Tuần/Tháng/Thống kê.
  const linkTo = (to: string) => (to === '/settings' ? to : `${to}${search}`)

  return (
    <UIContext.Provider value={ui}>
      <div className="min-h-screen pb-20 sm:pb-8">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
            <span className="text-lg font-bold">🗓️ Schedular</span>
            <nav className="hidden flex-1 gap-1 sm:flex">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={linkTo(n.to)}
                  end={n.to === '/'}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm font-medium ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-xs text-slate-500 md:inline">{session?.user.email}</span>
              <button className="btn-ghost" onClick={signOut}>Đăng xuất</button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            <span>Lỗi: {error}</span>
            <button onClick={clearError} aria-label="Đóng thông báo lỗi">✕</button>
          </div>
        )}

        <main className="mx-auto max-w-6xl px-4 py-5">
          {loading ? <p className="text-sm text-slate-500">Đang tải dữ liệu…</p> : <Outlet />}
        </main>

        {/* Thanh điều hướng dưới cho mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white sm:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={linkTo(n.to)}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center py-2 text-[11px] ${
                  isActive ? 'font-semibold text-indigo-700' : 'text-slate-500'
                }`
              }
            >
              <span className="text-lg leading-none">{n.icon}</span>
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
            onEdit={() =>
              setModal({ kind: 'form', task: modal.item.task, date: modal.item.date })
            }
          />
        )}
      </div>
    </UIContext.Provider>
  )
}
