import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          console.warn('[Supabase] getSession error', error)
        }
        setSession(data?.session ?? null)
        setLoading(false)
      })
      .catch((err) => {
        if (!mounted) return
        console.warn('[Supabase] getSession failed', err)
        setSession(null)
        setLoading(false)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return
      setSession(next ?? null)
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  return { session, loading, isAuthed: Boolean(session) }
}

