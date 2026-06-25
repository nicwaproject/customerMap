import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Dashboard from './Dashboard'
import { useCustomersByBounds } from '../hooks/useCustomersByBounds'
import {
  getMeterReaderOptions,
  searchCustomers,
} from '../services/customerService'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

const INVALID_METER_READER_VALUES = new Set([
  '#n/a',
  'n/a',
  'na',
  'null',
  'undefined',
  '-',
])

function normalizeMeterReaderOption(value) {
  const trimmed = String(value ?? '').trim()
  const normalized = trimmed.toLowerCase()
  if (!trimmed || normalized === 'all') return null
  if (INVALID_METER_READER_VALUES.has(normalized)) return null
  return trimmed
}

function sortMeterReaderOptions(values) {
  return values.sort((a, b) =>
    a.localeCompare(b, 'id', { sensitivity: 'base' }),
  )
}

function mergeMeterReaderOptions(current, next) {
  const byKey = new Map()
  for (const value of current ?? []) {
    const normalized = normalizeMeterReaderOption(value)
    if (normalized) byKey.set(normalized.toLowerCase(), normalized)
  }
  for (const value of next ?? []) {
    const normalized = normalizeMeterReaderOption(value)
    if (normalized) byKey.set(normalized.toLowerCase(), normalized)
  }
  return sortMeterReaderOptions(Array.from(byKey.values()))
}

export default function RootDashboard() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [meterReaderFilter, setMeterReaderFilter] = useState('all')
  const [meterReaderOptions, setMeterReaderOptions] = useState([])
  const [meterReaderOptionsError, setMeterReaderOptionsError] = useState(null)
  const [query, setQuery] = useState('')
  const [labelMode, setLabelMode] = useState('none')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const [mapBounds, setMapBounds] = useState(null)
  const [mapZoom, setMapZoom] = useState(null)

  const { customers: boundsCustomers, error: boundsError } = useCustomersByBounds({
    bounds: mapBounds,
    zoom: mapZoom,
    statusFilter,
    meterReaderFilter,
  })

  const debouncedQuery = useDebouncedValue(query, 250)
  const [results, setResults] = useState([])
  const [resultsCount, setResultsCount] = useState(0)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)

  const fitOnChangeKey = useMemo(() => {
    return `${statusFilter}::${meterReaderFilter}::${query.trim().toLowerCase()}`
  }, [statusFilter, meterReaderFilter, query])

  const displayedMeterReaderOptions = useMemo(() => {
    return mergeMeterReaderOptions(
      meterReaderOptions,
      [
        ...boundsCustomers.map((customer) => customer.pembaca_meter),
        ...results.map((customer) => customer.pembaca_meter),
      ],
    )
  }, [boundsCustomers, meterReaderOptions, results])

  async function onLogout() {
    await supabase.auth.signOut()
  }

  function onSelectCustomerId(id, customerMaybe) {
    setSelectedCustomerId(id)
    if (customerMaybe) setSelectedCustomer(customerMaybe)
  }

  function onClearSearch() {
    setQuery('')
    setResults([])
    setResultsCount(0)
    setSearchLoading(false)
    setSearchError(null)
    setSelectedCustomerId(null)
    setSelectedCustomer(null)
  }

  function onStatusFilterChange(nextStatus) {
    setStatusFilter(nextStatus)
    setSelectedCustomerId(null)
    setSelectedCustomer(null)
  }

  function onMeterReaderFilterChange(nextMeterReader) {
    setMeterReaderFilter(nextMeterReader)
    setSelectedCustomerId(null)
    setSelectedCustomer(null)
  }

  const onBoundsChange = useCallback((bounds, zoom) => {
    setMapBounds(bounds)
    setMapZoom(zoom)
  }, [])

  useEffect(() => {
    let cancelled = false

    getMeterReaderOptions({
      onPage: (pageOptions) => {
        if (cancelled) return
        setMeterReaderOptions((current) =>
          mergeMeterReaderOptions(current, pageOptions),
        )
      },
    }).then(({ data, error }) => {
      if (cancelled) return
      setMeterReaderOptions((current) =>
        mergeMeterReaderOptions(current, data ?? []),
      )
      setMeterReaderOptionsError(error ?? null)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const q = String(debouncedQuery ?? '').trim()
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      setResultsCount(0)
      setSearchLoading(false)
      setSearchError(null)
      return
    }

    setSearchLoading(true)
    searchCustomers({
      query: q,
      status: statusFilter,
      meterReader: meterReaderFilter,
      limit: 25,
    }).then(({ data, count, error }) => {
      if (cancelled) return
      setSearchLoading(false)
      setSearchError(error ?? null)
      setResults(data ?? [])
      setResultsCount(typeof count === 'number' ? count : (data ?? []).length)
      setMeterReaderOptions((current) =>
        mergeMeterReaderOptions(
          current,
          (data ?? []).map((customer) => customer.pembaca_meter),
        ),
      )
    })

    return () => {
      cancelled = true
      setSearchLoading(false)
    }
  }, [debouncedQuery, statusFilter, meterReaderFilter])

  const customers = useMemo(() => {
    // Ensure selected customer is still renderable even if outside current bounds.
    if (!selectedCustomer) return boundsCustomers
    const exists = boundsCustomers.some((c) => c.id === selectedCustomer.id)
    if (exists) return boundsCustomers
    return [selectedCustomer, ...boundsCustomers]
  }, [boundsCustomers, selectedCustomer])

  return (
    <Dashboard
      customers={customers}
      results={results}
      resultsCount={resultsCount}
      boundsError={boundsError}
      searchError={searchError}
      searchLoading={searchLoading}
      query={query}
      onQueryChange={setQuery}
      onClearSearch={onClearSearch}
      statusFilter={statusFilter}
      onStatusFilterChange={onStatusFilterChange}
      meterReaderFilter={meterReaderFilter}
      meterReaderOptions={displayedMeterReaderOptions}
      meterReaderOptionsError={meterReaderOptionsError}
      onMeterReaderFilterChange={onMeterReaderFilterChange}
      labelMode={labelMode}
      onLabelModeChange={setLabelMode}
      selectedCustomerId={selectedCustomerId}
      onSelectCustomerId={onSelectCustomerId}
      selectedCustomer={selectedCustomer}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      fitOnChangeKey={fitOnChangeKey}
      onBoundsChange={onBoundsChange}
      onLogout={onLogout}
    />
  )
}
