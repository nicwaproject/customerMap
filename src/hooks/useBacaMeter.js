import { useEffect, useRef, useState } from 'react'
import { useMeterRoute } from './useMeterRoute'
import { getCustomersByReadingDate } from '../services/customerService'

export function getLocalDate(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

export function useBacaMeter({ requestLocation } = {}) {
  const [date, setDate] = useState(getLocalDate)
  const [meterReader, setMeterReader] = useState('')
  // null means no filter has succeeded yet; [] means an applied filter matched nobody.
  const [customers, setCustomers] = useState(null)
  const [appliedFilters, setAppliedFilters] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const request = useRef(null)
  const routing = useMeterRoute({ customers, requestLocation })

  useEffect(() => () => request.current?.abort(), [])

  async function applyFilters(event) {
    event.preventDefault()
    if (!date || request.current) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError(null)
    const filters = { date, meterReader }
    try {
      const { data, error } = await getCustomersByReadingDate({ ...filters, signal: controller.signal })
      if (controller.signal.aborted) return
      if (error) throw error
      // Commit a new dataset and invalidate its route only after every page succeeds.
      routing.clearRoute()
      setCustomers(data)
      setAppliedFilters(filters)
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('[Baca Meter] Customer filtering failed', {
          operation: 'get_customers_by_reading_day',
          date: filters.date,
          day: Number(filters.date.split('-')[2]),
          meterReader: filters.meterReader || null,
          code: error?.code ?? error?.cause?.code ?? null,
          message: error?.message ?? String(error),
          details: error?.details ?? null,
          hint: error?.hint ?? null,
        })
        setError(error?.code === 'PGRST202'
          ? 'Filter tanggal baca belum tersedia di server. Hubungi administrator.'
          : 'Gagal memuat pelanggan. Silakan coba lagi.')
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
      if (request.current === controller) request.current = null
    }
  }

  return { date, setDate, meterReader, setMeterReader,
    customers, appliedFilters, loading, error, applyFilters, ...routing }
}
