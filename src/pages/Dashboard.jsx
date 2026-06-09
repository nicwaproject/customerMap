import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import MapView from '../components/MapView.jsx'
import Sidebar from '../components/Sidebar.jsx'

export default function Dashboard({
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
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      <MapView
        customers={customers}
        searchQuery={query}
        searchResults={results}
        labelMode={labelMode}
        fitOnChangeKey={fitOnChangeKey}
        selectedCustomer={selectedCustomer}
        selectedCustomerId={selectedCustomerId}
        onBoundsChange={onBoundsChange}
        statusFilter={statusFilter}
      />

      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        className={[
          'absolute top-4 z-[1100] inline-flex items-center gap-2 rounded-2xl',
          'border border-slate-200 bg-white/95 px-3 py-2 text-sm font-medium',
          'text-slate-800 shadow-lg backdrop-blur transition hover:bg-white',
          sidebarOpen ? 'left-4' : 'right-4',
        ].join(' ')}
        aria-label={sidebarOpen ? 'Tutup sidebar' : 'Buka sidebar'}
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
          className="absolute inset-0 z-[900] bg-black/10"
          aria-label="Tutup sidebar overlay"
        />
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
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
