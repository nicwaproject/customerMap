import { useEffect, useMemo, useRef, useState } from 'react'
import { getCustomersByBounds } from '../services/customerService'
import { useDebouncedValue } from './useDebouncedValue'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function computeLimitForZoom(zoom) {
  // Keep response sizes predictable. This is a safe default and can be tuned later.
  // Lower zoom => bigger area => smaller limit.
  const z = Number(zoom)
  if (!Number.isFinite(z)) return 1500
  if (z <= 11) return 800
  if (z <= 12) return 1200
  if (z <= 13) return 1800
  if (z <= 14) return 2500
  if (z <= 15) return 3500
  return 5000
}

export function useCustomersByBounds({ bounds, zoom, statusFilter }) {
  const debounced = useDebouncedValue(
    { bounds, zoom, statusFilter },
    250,
  )

  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const requestIdRef = useRef(0)

  const key = useMemo(() => {
    if (!debounced.bounds) return ''
    const { south, west, north, east } = debounced.bounds
    const z = Number(debounced.zoom)
    return [
      debounced.statusFilter ?? 'all',
      z,
      south.toFixed(5),
      west.toFixed(5),
      north.toFixed(5),
      east.toFixed(5),
    ].join('::')
  }, [debounced])

  useEffect(() => {
    if (!debounced.bounds) return

    const rid = (requestIdRef.current += 1)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)

    const limit = clamp(computeLimitForZoom(debounced.zoom), 200, 8000)

    getCustomersByBounds({
      bounds: debounced.bounds,
      status: debounced.statusFilter,
      limit,
    })
      .then(({ data, error: err }) => {
        if (requestIdRef.current !== rid) return
        if (err) {
          setError(err)
          setCustomers([])
          return
        }
        setCustomers(data ?? [])
      })
      .catch((e) => {
        if (requestIdRef.current !== rid) return
        setError(e)
        setCustomers([])
      })
      .finally(() => {
        if (requestIdRef.current !== rid) return
        setLoading(false)
      })
  }, [key, debounced.bounds, debounced.zoom, debounced.statusFilter])

  return { customers, loading, error }
}

