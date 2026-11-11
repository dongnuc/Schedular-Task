import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { isSupabaseConfigured } from './lib/supabase'
import DayPage from './pages/DayPage'
import LoginPage from './pages/LoginPage'
import MonthPage from './pages/MonthPage'
import SettingsPage from './pages/SettingsPage'
import StatsPage from './pages/StatsPage'
import WeekPage from './pages/WeekPage'

export default function App() {
  const { session, loading } = useAuth()

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto mt-24 max-w-md px-4">
        <div className="card p-6">
          <h1 className="text-lg font-semibold">Chưa cấu hình Supabase</h1>
          <p className="mt-2 text-sm text-slate-600">
            Điền <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code> vào file{' '}
            <code className="rounded bg-slate-100 px-1">.env.local</code> (lấy ở Supabase Dashboard →
            Project Settings → API Keys) rồi khởi động lại dev server.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="mt-24 text-center text-sm text-slate-500">Đang tải…</div>
  }

  if (!session) return <LoginPage />

  return (
    <DataProvider key={session.user.id}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DayPage />} />
          <Route path="week" element={<WeekPage />} />
          <Route path="month" element={<MonthPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}
