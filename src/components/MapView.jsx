import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { createRoot } from 'react-dom/client'
import L from 'leaflet'
import 'leaflet.markercluster'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Check, Copy, Route, ScanEye } from 'lucide-react'
import CustomerPopup from './popup/CustomerPopup'
import { getNearestCustomer } from '../services/customerService'
import { getCustomerStatusColor } from '../utils/customerStatus'

function isValidLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
}

const BASE_RADIUS = 6
const BASE_DIAMETER = BASE_RADIUS * 2
const MARKER_HIT_DIAMETER = 22
const CLUSTER_DISABLE_ZOOM = 16
const LABEL_MIN_ZOOM = CLUSTER_DISABLE_ZOOM
const UNKNOWN_KELURAHAN = 'Kelurahan tidak diketahui'
const DEFAULT_VIEW = {
  center: [-8.577, 116.105],
  zoom: 14,
}

function getDotFillColor(status, selected) {
  if (selected) return '#f59e0b'
  return getCustomerStatusColor(status)
}

function getCustomerLabel(customer, labelMode) {
  if (labelMode === 'id') return customer.id
  if (labelMode === 'nama') return customer.nama
  return ''
}

function getKelurahanLabel(customer) {
  return String(customer?.kelurahan ?? '').trim() || UNKNOWN_KELURAHAN
}

function getCustomerKey(customer) {
  const key = customer?.id ?? customer?.no_langganan
  return key == null ? null : String(key)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function hashStringToInt(input) {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function getCustomerLabelOffset(customer) {
  // Deterministic small jitter so labels near each other don't stack perfectly.
  const seed = hashStringToInt(String(customer.id ?? customer.nama ?? ''))
  const xOptions = [-18, -10, 0, 10, 18]
  const yOptions = [-18, -14, -12, -10]
  const x = xOptions[seed % xOptions.length]
  const y = yOptions[(seed >> 3) % yOptions.length]
  return [x, y]
}

function makeDotIcon(status, selected, diameter) {
  const fill = getDotFillColor(status, selected)
  const size = diameter
  const border = selected ? '#f59e0b' : '#ffffff'

  const html = `<div class="customer-dot-marker" style="width:${size}px;height:${size}px;background:${fill};border-color:${border};"></div>`

  return L.divIcon({
    className: 'customer-dot-icon',
    html,
    iconSize: [MARKER_HIT_DIAMETER, MARKER_HIT_DIAMETER],
    iconAnchor: [MARKER_HIT_DIAMETER / 2, MARKER_HIT_DIAMETER / 2],
  })
}

function makeKelurahanClusterIcon(kelurahanLabel, cluster) {
  const count = cluster.getChildCount()
  const safeKelurahan = escapeHtml(kelurahanLabel)
  const safeCount = escapeHtml(count)

  return L.divIcon({
    className: 'customer-kelurahan-cluster-icon',
    html: `
      <div class="customer-kelurahan-cluster">
        <span class="customer-kelurahan-cluster__count">${safeCount}</span>
        <span class="customer-kelurahan-cluster__label">${safeKelurahan}</span>
      </div>
    `,
    iconSize: [150, 42],
    iconAnchor: [75, 21],
  })
}

async function copyText(value) {
  const text = String(value ?? '').trim()
  if (!text) return false

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(input)
  return copied
}

function InitialViewController({ onDone }) {
  const map = useMap()
  const doneRef = useRef(false)

  useEffect(() => {
    if (doneRef.current) return
    map.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom, { animate: false })
    doneRef.current = true
    onDone()
  }, [map, onDone])

  return null
}

function DynamicFitBoundsController({
  bounds,
  enabled,
  fitKey,
  disabledBecauseSelected,
}) {
  const map = useMap()
  const lastFitKeyRef = useRef(null)

  useEffect(() => {
    if (!enabled) return
    if (!fitKey) return
    if (!bounds) return
    if (disabledBecauseSelected) return
    if (lastFitKeyRef.current === null) {
      // Don't run fitBounds on the first enabled render.
      // Only run after the user triggers a change (fitKey changes).
      lastFitKeyRef.current = fitKey
      return
    }
    if (lastFitKeyRef.current === fitKey) return

    map.fitBounds(bounds, { padding: [24, 24] })
    lastFitKeyRef.current = fitKey
  }, [map, bounds, enabled, fitKey, disabledBecauseSelected])
  return null
}

function LabelVisibilityController({ labelMode, onChange }) {
  const map = useMapEvents({
    zoomend: () => {
      onChange(labelMode !== 'none' && map.getZoom() >= LABEL_MIN_ZOOM)
    },
  })

  useEffect(() => {
    onChange(labelMode !== 'none' && map.getZoom() >= LABEL_MIN_ZOOM)
  }, [map, labelMode, onChange])

  return null
}

function FocusSelectedCustomer({
  selectedCustomer,
  markerRefs,
  pendingPopupCustomerKeyRef,
}) {
  const map = useMap()
  useEffect(() => {
    if (!selectedCustomer) return
    const lat = Number(selectedCustomer.latitude)
    const lng = Number(selectedCustomer.longitude)
    if (!isValidLatLng(lat, lng)) return
    const customerKey = getCustomerKey(selectedCustomer)
    if (customerKey) {
      pendingPopupCustomerKeyRef.current = customerKey
    }

    const targetZoom = Math.max(map.getZoom(), 18)
    map.flyTo([lat, lng], targetZoom, { duration: 0.6 })

    const openSelectedPopup = () => {
      const marker = customerKey ? markerRefs.current.get(customerKey) : null
      if (!marker) return
      marker.openPopup()
      if (pendingPopupCustomerKeyRef.current === customerKey) {
        pendingPopupCustomerKeyRef.current = null
      }
    }

    const timeoutId = window.setTimeout(openSelectedPopup, 700)
    map.once('moveend', openSelectedPopup)

    return () => {
      window.clearTimeout(timeoutId)
      map.off('moveend', openSelectedPopup)
    }
  }, [map, markerRefs, pendingPopupCustomerKeyRef, selectedCustomer])
  return null
}

function SearchNavigationController({
  query,
  results,
  pendingPopupCustomerKeyRef,
  onNavigateResult,
  zoom = 18,
}) {
  const map = useMap()
  const lastNavigationKeyRef = useRef(null)

  const validResults = useMemo(() => {
    return (results ?? [])
      .map((customer) => {
        const lat = Number(customer.latitude)
        const lng = Number(customer.longitude)
        if (!isValidLatLng(lat, lng)) return null
        return { customer, lat, lng }
      })
      .filter(Boolean)
  }, [results])

  const resultKey = useMemo(() => {
    const q = String(query ?? '').trim().toLowerCase()
    if (!q) return ''

    const firstResult = validResults[0]
    if (!firstResult) return `${q}::no-results`

    const key = getCustomerKey(firstResult.customer) ?? ''
    return `${q}::${key}:${firstResult.lat}:${firstResult.lng}:${validResults.length}`
  }, [query, validResults])

  useEffect(() => {
    const q = String(query ?? '').trim()
    if (!q) {
      lastNavigationKeyRef.current = null
      pendingPopupCustomerKeyRef.current = null
      return undefined
    }

    if (lastNavigationKeyRef.current === resultKey) return undefined
    lastNavigationKeyRef.current = resultKey

    if (validResults.length === 0) {
      pendingPopupCustomerKeyRef.current = null
      return undefined
    }

    const [{ customer, lat, lng }] = validResults
    pendingPopupCustomerKeyRef.current = null
    onNavigateResult(customer)

    map.closePopup()
    map.flyTo([lat, lng], zoom, { duration: 1.5 })
    return undefined
  }, [
    map,
    onNavigateResult,
    pendingPopupCustomerKeyRef,
    query,
    resultKey,
    validResults,
    zoom,
  ])

  return null
}

function BoundsReporter({ onChange }) {
  const lastKeyRef = useRef('')
  const popupOpenRef = useRef(false)
  const map = useMap()

  const report = useCallback(() => {
    if (popupOpenRef.current) return
    if (!onChange) return
    const b = map.getBounds()
    const nextKey = [
      b.getSouth().toFixed(6),
      b.getWest().toFixed(6),
      b.getNorth().toFixed(6),
      b.getEast().toFixed(6),
      map.getZoom().toFixed(3),
    ].join('::')

    if (lastKeyRef.current === nextKey) return
    lastKeyRef.current = nextKey

    onChange(
      {
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      },
      map.getZoom(),
    )
  }, [map, onChange])

  useMapEvents({
    moveend: report,
    zoomend: report,
  })

  useEffect(() => {
    report()
  }, [report])

  useEffect(() => {
    const handlePopupOpen = () => {
      popupOpenRef.current = true
    }
    const handlePopupClose = () => {
      popupOpenRef.current = false
    }

    map.on('popupopen', handlePopupOpen)
    map.on('popupclose', handlePopupClose)

    return () => {
      map.off('popupopen', handlePopupOpen)
      map.off('popupclose', handlePopupClose)
    }
  }, [map])

  return null
}

function ClickNearestController({
  enabled,
  statusFilter,
  meterReaderFilter,
  onFound,
}) {
  const map = useMapEvents({
    click: async (e) => {
      if (!enabled) return
      // Avoid triggering when clicking markers/popups (best-effort).
      const t = e?.originalEvent?.target
      if (t && typeof t.closest === 'function') {
        if (
          t.closest('.customer-dot-icon') ||
          t.closest('.leaflet-marker-icon') ||
          t.closest('.leaflet-interactive') ||
          t.closest('.leaflet-popup')
        ) {
          return
        }
      }

      const lat = e.latlng?.lat
      const lng = e.latlng?.lng
      const { data, distanceMeters } = await getNearestCustomer({
        lat,
        lng,
        status: statusFilter,
        meterReader: meterReaderFilter,
      })
      if (!data) return
      onFound?.({
        clickLatLng: { lat, lng },
        customer: data,
        distanceMeters: distanceMeters ?? null,
      })
    },
  })

  useEffect(() => {
    // keep hook active
    void map
  }, [map])

  return null
}

function NearestPopupContent({ nearest }) {
  const [copiedCustomerId, setCopiedCustomerId] = useState(null)

  if (!nearest) return null
  const lat = Number(nearest.customer?.latitude)
  const lng = Number(nearest.customer?.longitude)
  const customerId = nearest.customer?.id ?? nearest.customer?.no_langganan ?? ''
  const copied = Boolean(customerId) && copiedCustomerId === String(customerId)
  const mapsHref =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : null
  const streetViewHref =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`
      : null

  return (
    <div className="min-w-[240px]">
      <div className="text-xs text-slate-600">Terdekat dari titik klik</div>
      <div className="mt-1 text-base font-semibold text-slate-900">
        {nearest.customer?.nama ?? '-'}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <div className="min-w-0 truncate text-xs text-slate-600">
          {customerId || '-'}
        </div>
        {customerId && (
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation()
              const ok = await copyText(customerId)
              if (!ok) return
              setCopiedCustomerId(String(customerId))
              window.setTimeout(() => setCopiedCustomerId(null), 1400)
            }}
            className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-50"
            aria-label="Copy ID pelanggan terdekat"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Tersalin' : 'Copy'}
          </button>
        )}
      </div>
      <div className="mt-2 text-sm text-slate-700">
        {nearest.customer?.alamat ?? '-'}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-600">
        <div>Pembaca meter</div>
        <div className="font-medium text-slate-800">
          {nearest.customer?.pembaca_meter ?? '-'}
        </div>
      </div>
      {typeof nearest.distanceMeters === 'number' && (
        <div className="mt-1 text-xs text-slate-600">
          Jarak ± {Math.round(nearest.distanceMeters)} m
        </div>
      )}
      {(mapsHref || streetViewHref) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {mapsHref && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Route size={16} />
              Rute
            </a>
          )}
          {streetViewHref && (
            <a
              href={streetViewHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <ScanEye size={16} />
              Street View
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function NearestPopupController({ nearest, onNearestClose }) {
  const map = useMap()

  useEffect(() => {
    const nearestLat = nearest?.clickLatLng?.lat
    const nearestLng = nearest?.clickLatLng?.lng

    if (!nearest || !isValidLatLng(nearestLat, nearestLng)) {
      return undefined
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    const popup = L.popup({
      autoPanPadding: [32, 32],
      className: 'customer-map-popup',
      maxWidth: 320,
      minWidth: 240,
    })
      .setLatLng([nearestLat, nearestLng])
      .setContent(container)

    root.render(<NearestPopupContent nearest={nearest} />)

    let cleaningUp = false
    const handleRemove = () => {
      if (cleaningUp) return
      onNearestClose()
    }

    popup.on('remove', handleRemove)
    popup.openOn(map)

    return () => {
      cleaningUp = true
      popup.off('remove', handleRemove)
      if (map.hasLayer(popup)) {
        map.removeLayer(popup)
      }
      root.unmount()
    }
  }, [map, nearest, onNearestClose])

  return null
}

const ClusteredCustomerMarkers = memo(function ClusteredCustomerMarkers({
  customerGroupsByKelurahan,
  labelMode,
  markerRefs,
  pendingPopupCustomerKeyRef,
  selectedCustomerId,
  highlightedCustomerKey,
  showLabels,
  onCustomerClick,
}) {
  return customerGroupsByKelurahan.map(({ kelurahan, customers: groupCustomers }) => (
    <MarkerClusterGroup
      key={kelurahan}
      chunkedLoading
      disableClusteringAtZoom={CLUSTER_DISABLE_ZOOM}
      iconCreateFunction={(cluster) => makeKelurahanClusterIcon(kelurahan, cluster)}
      maxClusterRadius={(zoom) => (zoom >= CLUSTER_DISABLE_ZOOM - 1 ? 24 : 60)}
    >
      {groupCustomers.map((c) => {
        const lat = Number(c.latitude)
        const lng = Number(c.longitude)
        if (!isValidLatLng(lat, lng)) return null
        const customerKey = getCustomerKey(c)
        const selected =
          (selectedCustomerId != null && c.id === selectedCustomerId) ||
          (customerKey != null && customerKey === highlightedCustomerKey)
        return (
          <Marker
            key={c.id}
            ref={(marker) => {
              if (!customerKey) return
              if (!marker) {
                markerRefs.current.delete(customerKey)
                return
              }

              markerRefs.current.set(customerKey, marker)

              if (pendingPopupCustomerKeyRef.current === customerKey) {
                pendingPopupCustomerKeyRef.current = null
                window.setTimeout(() => marker.openPopup(), 0)
              }
            }}
            position={[lat, lng]}
            icon={makeDotIcon(c.status, selected, BASE_DIAMETER)}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e)
                if (e.originalEvent) {
                  L.DomEvent.stop(e.originalEvent)
                }
                onCustomerClick(c)
              },
            }}
          >
            <Popup
              autoPanPadding={[32, 32]}
              className="customer-map-popup"
              maxWidth={320}
              minWidth={240}
            >
              <CustomerPopup customer={c} />
            </Popup>
            {showLabels && (
              <Tooltip
                permanent
                direction="top"
                offset={getCustomerLabelOffset(c)}
                opacity={1}
                className="customer-label-tooltip"
              >
                {getCustomerLabel(c, labelMode)}
              </Tooltip>
            )}
          </Marker>
        )
      })}
    </MarkerClusterGroup>
  ))
})

export default function MapView({
  customers,
  searchQuery = '',
  searchResults = [],
  labelMode = 'none',
  fitOnChangeKey,
  selectedCustomer,
  selectedCustomerId,
  onBoundsChange,
  statusFilter = 'all',
  meterReaderFilter = 'all',
}) {
  const [showLabels, setShowLabels] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [nearest, setNearest] = useState(null)
  const [highlightedCustomerKey, setHighlightedCustomerKey] = useState(null)
  const markerRefs = useRef(new Map())
  const pendingPopupCustomerKeyRef = useRef(null)

  const markerCustomers = useMemo(() => customers ?? [], [customers])
  const boundsCustomers = markerCustomers

  const customerGroupsByKelurahan = useMemo(() => {
    const groups = new Map()

    for (const customer of markerCustomers) {
      const kelurahan = getKelurahanLabel(customer)
      if (!groups.has(kelurahan)) {
        groups.set(kelurahan, [])
      }
      groups.get(kelurahan).push(customer)
    }

    return Array.from(groups, ([kelurahan, groupCustomers]) => ({
      kelurahan,
      customers: groupCustomers,
    }))
  }, [markerCustomers])

  const positions = useMemo(() => {
    return boundsCustomers
      .map((c) => [Number(c.latitude), Number(c.longitude)])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
  }, [boundsCustomers])

  const bounds = useMemo(() => {
    if (positions.length === 0) return null
    return L.latLngBounds(positions.map((p) => L.latLng(p[0], p[1])))
  }, [positions])

  const handleCustomerClick = useCallback((customer) => {
    setNearest(null)
    const customerKey = getCustomerKey(customer)
    if (customerKey) setHighlightedCustomerKey(customerKey)
  }, [])

  const handleNearestPopupClose = useCallback(() => {
    setNearest(null)
  }, [])

  const handleSearchNavigateResult = useCallback((customer) => {
    setNearest(null)
    const customerKey = getCustomerKey(customer)
    setHighlightedCustomerKey(customerKey)
  }, [])

  useEffect(() => {
    if (!highlightedCustomerKey) return undefined

    const timeoutId = window.setTimeout(() => {
      setHighlightedCustomerKey(null)
    }, 3500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [highlightedCustomerKey])

  return (
    <MapContainer
      center={DEFAULT_VIEW.center}
      zoom={DEFAULT_VIEW.zoom}
      zoomControl={false}
      scrollWheelZoom
      className="h-full w-full"
    >
      <ZoomControl position="bottomleft" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <InitialViewController onDone={() => setIsInitialLoad(false)} />
      <BoundsReporter onChange={onBoundsChange} />
      <ClickNearestController
        enabled
        statusFilter={statusFilter}
        meterReaderFilter={meterReaderFilter}
        onFound={(payload) => {
          setNearest(payload)
        }}
      />
      <DynamicFitBoundsController
        bounds={bounds}
        enabled={
          !isInitialLoad &&
          Boolean(fitOnChangeKey) &&
          String(searchQuery ?? '').trim().length === 0
        }
        fitKey={fitOnChangeKey}
        disabledBecauseSelected={Boolean(selectedCustomer)}
      />
      <FocusSelectedCustomer
        selectedCustomer={selectedCustomer}
        markerRefs={markerRefs}
        pendingPopupCustomerKeyRef={pendingPopupCustomerKeyRef}
      />
      <SearchNavigationController
        query={searchQuery}
        results={searchResults}
        pendingPopupCustomerKeyRef={pendingPopupCustomerKeyRef}
        onNavigateResult={handleSearchNavigateResult}
      />
      <LabelVisibilityController labelMode={labelMode} onChange={setShowLabels} />

      <ClusteredCustomerMarkers
        customerGroupsByKelurahan={customerGroupsByKelurahan}
        labelMode={labelMode}
        markerRefs={markerRefs}
        pendingPopupCustomerKeyRef={pendingPopupCustomerKeyRef}
        selectedCustomerId={selectedCustomerId}
        highlightedCustomerKey={highlightedCustomerKey}
        showLabels={showLabels}
        onCustomerClick={handleCustomerClick}
      />

      <NearestPopupController
        nearest={nearest}
        onNearestClose={handleNearestPopupClose}
      />
    </MapContainer>
  )
}
