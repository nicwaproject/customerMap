import { Search, X } from 'lucide-react'
import { STATUS_OPTIONS, getCustomerStatusMeta } from '../utils/customerStatus'

const LABEL_OPTIONS = /** @type {const} */ ([
  { value: 'none', label: 'Tidak tampil' },
  { value: 'nama', label: 'Nama pelanggan' },
  { value: 'id', label: 'Nomor pelanggan' },
])

export default function Sidebar({
  open,
  onClose,
  statusFilter,
  onStatusFilterChange,
  labelMode,
  onLabelModeChange,
  query,
  onQueryChange,
  onClearSearch,
  resultsCount,
  results,
  onSelectResult,
  selectedCustomerId,
  onLogout,
  boundsError,
  searchError,
  searchLoading,
}) {
  return (
    <aside
      className={[
        'pointer-events-auto absolute right-0 top-0 z-[1000] h-full w-[320px] max-w-[92vw]',
        'border-l bg-white shadow-xl',
        'transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
      aria-hidden={!open}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-4">
          <div>
            <div className="text-base font-bold leading-5 text-slate-900">
              Customer Map
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Dashboard peta distribusi pelanggan air
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Logout
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Tutup
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-auto px-4 py-4">
          {boundsError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              Gagal memuat pelanggan peta.{' '}
              {boundsError?.message ?? String(boundsError)}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Pencarian
            </label>
            <div className="relative mt-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Cari nama, nomor pelanggan, atau alamat…"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
              {query.trim().length > 0 && (
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Clear pencarian"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {searchLoading && (
              <div
                className="mt-2 flex items-center gap-2 text-xs text-slate-500"
                role="status"
                aria-live="polite"
              >
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                Mencari pelanggan...
              </div>
            )}

            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-600">
                Filter status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {query.trim().length > 0 && (
              <div className="mt-2">
                {searchError && (
                  <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    Pencarian gagal. {searchError?.message ?? String(searchError)}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <div>
                    {searchLoading ? (
                      'Mencari...'
                    ) : (
                      <>
                        Ditemukan <span className="font-medium">{resultsCount}</span>{' '}
                        pelanggan
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onClearSearch}
                    className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-2 max-h-44 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {(results ?? []).map((c) => {
                    const selected = selectedCustomerId === c.id
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => onSelectResult(c)}
                        className={[
                          'w-full rounded-lg px-2 py-2 text-left text-sm transition',
                          selected
                            ? 'bg-white shadow-sm ring-1 ring-slate-200'
                            : 'hover:bg-white hover:shadow-sm',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-900">
                              {c.nama}
                            </div>
                            <div className="truncate text-xs text-slate-600">
                              {c.id}
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500">
                              {c.alamat ?? '-'}
                            </div>
                          </div>
                          {(() => {
                            const statusMeta = getCustomerStatusMeta(c.status)
                            return (
                              <span
                                className={[
                                  'mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs ring-1',
                                  statusMeta.badgeClass,
                                ].join(' ')}
                              >
                                {c.status ?? statusMeta.label}
                              </span>
                            )
                          })()}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Label di peta
            </label>
            <select
              value={labelMode}
              onChange={(e) => onLabelModeChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              {LABEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-slate-500">
              Label akan muncul saat zoom mendekat.
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-slate-700">Legenda</div>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              {STATUS_OPTIONS.filter((opt) => opt.value !== 'all').map((opt) => {
                const statusMeta = getCustomerStatusMeta(opt.label)
                return (
                  <div key={opt.value} className="flex items-center gap-2">
                    <span
                      className={[
                        'h-3 w-3 rounded-full border border-white shadow-sm',
                        statusMeta.legendClass,
                      ].join(' ')}
                    />
                    <span>{opt.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="border-t px-4 py-3 text-xs text-slate-500">
          Sidebar ini overlay di atas peta (map tetap full view).
        </div>
      </div>
    </aside>
  )
}
