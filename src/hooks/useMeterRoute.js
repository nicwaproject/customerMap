import { useEffect, useMemo, useRef, useState } from 'react'
import { analyzeRouteCustomers, buildNearestNeighborRoute, MAX_ROUTE_CUSTOMERS } from '../utils/meterRoute'

export function useMeterRoute({ customers, requestLocation }) {
  const [route, setRoute] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(null)
  const [routeStage, setRouteStage] = useState('')
  const requestRef = useRef(null)
  const routeCustomers = useMemo(() => analyzeRouteCustomers(customers ?? []), [customers])
  const validCustomerCount = routeCustomers.stops.length
  const routeLimitExceeded = validCustomerCount > MAX_ROUTE_CUSTOMERS

  useEffect(() => () => {
    requestRef.current?.abort()
    requestRef.current = null
  }, [])

  function clearRoute() {
    requestRef.current?.abort()
    requestRef.current = null
    setRoute(null)
    setRouteLoading(false)
    setRouteError(null)
    setRouteStage('')
  }

  async function generateRoute() {
    if (requestRef.current || !validCustomerCount || routeLimitExceeded) return
    const controller = new AbortController()
    requestRef.current = controller
    setRouteLoading(true)
    setRouteError(null)
    setRouteStage('Mendapatkan lokasi...')
    try {
      const start = await requestLocation()
      if (controller.signal.aborted) return
      if (!start) throw new Error('Lokasi belum didapatkan. Periksa izin lokasi atau GPS, lalu coba Buat Rute lagi.')
      setRouteStage('Menyusun rute...')
      const nextRoute = await buildNearestNeighborRoute({ customers, start, signal: controller.signal })
      if (!controller.signal.aborted) setRoute(nextRoute)
    } catch (error) {
      if (!controller.signal.aborted) {
        setRouteError(error?.message ?? 'Gagal menyusun rute. Silakan coba lagi.')
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setRouteLoading(false)
        setRouteStage('')
      }
    }
  }

  return { route, routeLoading, routeError, routeStage, generateRoute, clearRoute,
    validCustomerCount, invalidCoordinateCount: routeCustomers.invalidCoordinateCount,
    routeLimitExceeded, maxRouteCustomers: MAX_ROUTE_CUSTOMERS }
}
