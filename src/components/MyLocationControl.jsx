import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Circle, CircleMarker, Pane, Tooltip, useMap } from 'react-leaflet'
import { Crosshair, LoaderCircle } from 'lucide-react'
import L from 'leaflet'

export default function MyLocationControl({ boundsReportSuppressedRef, myLocation }) {
  const map = useMap()
  const { location, loading, error, requestLocation } = myLocation
  const [container] = useState(() => L.DomUtil.create('div', 'leaflet-control relative'))

  useEffect(() => {
    const control = L.control({ position: 'bottomleft' })
    control.onAdd = () => container
    L.DomEvent.disableClickPropagation(container)
    L.DomEvent.disableScrollPropagation(container)
    control.addTo(map)
    return () => {
      control.remove()
      L.DomEvent.off(container)
    }
  }, [container, map])

  useEffect(() => {
    if (!location) return
    // setView without animation emits its bounds events synchronously. Keep the
    // current customer dataset and avoid sending GPS-derived bounds to Supabase.
    const wasSuppressed = boundsReportSuppressedRef.current
    boundsReportSuppressedRef.current = true
    try {
      map.stop()
      map.setView([location.latitude, location.longitude], 17, { animate: false })
    } finally {
      boundsReportSuppressedRef.current = wasSuppressed
    }
  }, [boundsReportSuppressedRef, location, map])

  return (
    <>
      {createPortal(
        <>
          <button
            type="button"
            onClick={requestLocation}
            disabled={loading}
            aria-label="Lokasi Saya"
            title="Lokasi Saya"
            aria-busy={loading}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? <LoaderCircle size={20} className="animate-spin" aria-hidden="true" /> : <Crosshair size={20} aria-hidden="true" />}
          </button>
          <span role="status" className="sr-only">{loading ? 'Mencari lokasi...' : location ? 'Lokasi ditemukan.' : ''}</span>
          {error && (
            <div role="alert" className="absolute bottom-full left-1/2 mb-3 w-[min(280px,calc(100vw-32px))] -translate-x-1/2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-800 shadow-lg">
              {error}
            </div>
          )}
        </>,
        container,
      )}
      {location && (
        <Pane name="my-location" style={{ zIndex: 625 }}>
          <Circle
            center={[location.latitude, location.longitude]}
            radius={location.accuracy}
            interactive={false}
            pathOptions={{ color: '#3b82f6', weight: 1, opacity: 0.4, fillColor: '#3b82f6', fillOpacity: 0.12 }}
          />
          <CircleMarker
            center={[location.latitude, location.longitude]}
            radius={8}
            bubblingMouseEvents={false}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -10]}>Lokasi Saya</Tooltip>
          </CircleMarker>
        </Pane>
      )}
    </>
  )
}
