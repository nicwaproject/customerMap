import { memo, useEffect, useMemo, useRef } from 'react'
import { Polyline, Tooltip, useMap } from 'react-leaflet'

// Keep this controller mounted when hidden, so restoring a tab never replays fitBounds.
export default memo(function MeterRouteLayer({ route, visible, boundsReportSuppressedRef }) {
  const map = useMap()
  const previousRouteRef = useRef(null)
  const positions = useMemo(() => route ? [
    [route.start.latitude, route.start.longitude],
    ...route.stops.map((stop) => [stop.latitude, stop.longitude]),
  ] : [], [route])

  useEffect(() => {
    const changed = previousRouteRef.current !== route
    previousRouteRef.current = route
    if (!changed || !route || !visible) return
    const wasSuppressed = boundsReportSuppressedRef.current
    boundsReportSuppressedRef.current = true
    try {
      map.stop()
      map.fitBounds(positions, { padding: [32, 32], maxZoom: 17, animate: false })
    } finally {
      boundsReportSuppressedRef.current = wasSuppressed
    }
  }, [boundsReportSuppressedRef, map, positions, route, visible])

  if (!visible || !route) return null
  return (
    <Polyline positions={positions} pathOptions={{ color: '#7c3aed', weight: 4, opacity: 0.8 }} bubblingMouseEvents={false}>
      <Tooltip sticky>Rute perkiraan garis lurus, bukan rute jalan.</Tooltip>
    </Polyline>
  )
})
