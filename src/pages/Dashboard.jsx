import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import MapView from '../components/MapView.jsx'
import Sidebar from '../components/Sidebar.jsx'

export default function Dashboard({
  myLocation,
  activeWorkspace,
  onWorkspaceChange,
  bacaMeter,
  customers,
  results,
  resultsCount,
  boundsError,
  searchError,
  searchLoading,
  query,
  onQueryChange,
  onClearSearch,
  statusFilter,
  onStatusFilterChange,
  meterReaderFilter,
  meterReaderOptions,
  meterReaderOptionsError,
  onMeterReaderFilterChange,
  labelMode,
  onLabelModeChange,
  selectedCustomerId,
  onSelectCustomerId,
  selectedCustomer,
  sidebarOpen,
  setSidebarOpen,
  fitOnChangeKey,
  onBoundsChange,
  onLogout,
}) {
  const isBacaMeter = activeWorkspace === 'baca-meter'
  const hasBacaMeterResults = isBacaMeter && bacaMeter.customers !== null
  const displayedCustomers = hasBacaMeterResults ? bacaMeter.customers : customers

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-100 text-slate-900">
      <MapView
        myLocation={myLocation}
        route={bacaMeter.route}
        routeVisible={isBacaMeter}
        navigationEnabled={!isBacaMeter}
        localNearestOnly={isBacaMeter}
        datasetKey={hasBacaMeterResults ? bacaMeter.customers : 'cs'}
        customers={displayedCustomers}
        searchQuery={query}
        searchResults={results}
        labelMode={labelMode}
        fitOnChangeKey={isBacaMeter ? null : fitOnChangeKey}
        selectedCustomer={selectedCustomer}
        selectedCustomerId={hasBacaMeterResults ? null : selectedCustomerId}
        onBoundsChange={onBoundsChange}
        statusFilter={statusFilter}
        meterReaderFilter={meterReaderFilter}
      />

      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        className={[
          'fixed z-[1200] inline-flex items-center gap-2 rounded-2xl',
          'border border-slate-200 bg-white/95 px-3 py-2 text-sm font-medium',
          'text-slate-800 shadow-lg backdrop-blur transition hover:bg-white',
          'top-[calc(env(safe-area-inset-top)+1rem)]',
          sidebarOpen ? 'left-4 sm:left-auto sm:right-4' : 'right-4',
        ].join(' ')}
        aria-label={sidebarOpen ? 'Tutup sidebar' : 'Buka sidebar'}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? (
          <>
            <PanelRightClose size={18} />
            Tutup
          </>
        ) : (
          <>
            <PanelRightOpen size={18} />
            Menu
          </>
        )}
      </button>

      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-[900] bg-black/20 backdrop-blur-[1px]"
          aria-label="Tutup sidebar overlay"
        />
      )}

      <Sidebar
        activeWorkspace={activeWorkspace}
        onWorkspaceChange={onWorkspaceChange}
        bacaMeter={bacaMeter}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        meterReaderFilter={meterReaderFilter}
        meterReaderOptions={meterReaderOptions}
        meterReaderOptionsError={meterReaderOptionsError}
        onMeterReaderFilterChange={onMeterReaderFilterChange}
        labelMode={labelMode}
        onLabelModeChange={onLabelModeChange}
        query={query}
        onQueryChange={onQueryChange}
        onClearSearch={onClearSearch}
        resultsCount={resultsCount}
        results={results}
        selectedCustomerId={selectedCustomerId}
        onSelectResult={(c) => onSelectCustomerId(c.id, c)}
        onLogout={onLogout}
        boundsError={boundsError}
        searchError={searchError}
        searchLoading={searchLoading}
      />
    </div>
  )
}
