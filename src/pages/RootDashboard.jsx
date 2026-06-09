import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Dashboard from './Dashboard'
import { useCustomersByBounds } from '../hooks/useCustomersByBounds'
import { searchCustomers } from '../services/customerService'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

export default function RootDashboard() {
  const [statusFilter, setStatusFilter] = useState('all')
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
  })

  const debouncedQuery = useDebouncedValue(query, 250)
  const [results, setResults] = useState([])
  const [resultsCount, setResultsCount] = useState(0)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)

  const fitOnChangeKey = useMemo(() => {
    return `${statusFilter}::${query.trim().toLowerCase()}`
  }, [statusFilter, query])

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

  const onBoundsChange = useCallback((bounds, zoom) => {
    setMapBounds(bounds)
    setMapZoom(zoom)
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
    searchCustomers({ query: q, status: statusFilter, limit: 25 }).then(
      ({ data, count, error }) => {
        if (cancelled) return
        setSearchLoading(false)
        setSearchError(error ?? null)
        setResults(data ?? [])
        setResultsCount(typeof count === 'number' ? count : (data ?? []).length)
      },
    )

    return () => {
      cancelled = true
      setSearchLoading(false)
    }
  }, [debouncedQuery, statusFilter])

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
