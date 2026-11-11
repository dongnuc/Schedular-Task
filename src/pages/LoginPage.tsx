import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage({ kind: 'error', text: error.message })
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage({ kind: 'error', text: error.message })
      else if (!data.session)
        setMessage({
          kind: 'info',
          text: 'Đã tạo tài khoản. Hãy mở email để xác nhận rồi đăng nhập.',
        })
    }
    setBusy(false)
  }

  return (
    <div className="mx-auto mt-20 max-w-sm px-4">
      <div className="mb-6 text-center">
        <div className="text-4xl">🗓️</div>
        <h1 className="mt-2 text-2xl font-bold">Schedular</h1>
        <p className="text-sm text-slate-500">Lập kế hoạch và theo dõi tiến độ công việc</p>
      </div>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {message && (
          <p className={`text-sm ${message.kind === 'error' ? 'text-rose-600' : 'text-emerald-700'}`}>
            {message.text}
          </p>
        )}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Đang xử lý…' : mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}
        </button>
        <button
          type="button"
          className="w-full text-center text-sm text-indigo-600 hover:underline"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setMessage(null)
          }}
        >
          {mode === 'signin' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
        </button>
      </form>
    </div>
  )
}
