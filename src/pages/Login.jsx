import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../hooks/useSession'

export default function Login() {
  const navigate = useNavigate()
  const { isAuthed, loading: sessionLoading } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (sessionLoading) return
    if (isAuthed) navigate('/', { replace: true })
  }, [isAuthed, sessionLoading, navigate])

  const disabled = useMemo(() => {
    return (
      sessionLoading ||
      submitting ||
      email.trim().length === 0 ||
      password.trim().length === 0
    )
  }, [email, password, sessionLoading, submitting])

  async function onSubmit(e) {
    e.preventDefault()
    if (disabled) return

    setError('')
    setSubmitting(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        setError(signInError.message || 'Login gagal. Periksa email/password.')
        return
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(err?.message || 'Login gagal. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
          <div className="text-base font-bold text-slate-900">Customer Map</div>
          <div className="mt-1 text-xs text-slate-500">
            Login internal untuk akses dashboard
          </div>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="nama@perusahaan.com"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={disabled}
              className={[
                'w-full rounded-xl px-3 py-2 text-sm font-medium shadow-sm',
                disabled
                  ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                  : 'bg-slate-900 text-white hover:bg-slate-800',
              ].join(' ')}
            >
              {submitting ? 'Masuk…' : 'Masuk'}
            </button>
          </form>
        </div>

        <div className="mt-3 text-center text-xs text-slate-500">
          Session tersimpan otomatis (tidak perlu login berulang).
        </div>
      </div>
    </div>
  )
}

