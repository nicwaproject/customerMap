export default function BacaMeterWorkspace({
  date, setDate, meterReader, setMeterReader, options, optionsError, optionsLoading,
  customers, appliedFilters, loading, error, applyFilters,
  route, routeLoading, routeError, routeStage, generateRoute, clearRoute,
  validCustomerCount, invalidCoordinateCount, routeLimitExceeded, maxRouteCustomers,
}) {
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
  const hasChanges = appliedFilters && (date !== appliedFilters.date || meterReader !== appliedFilters.meterReader)

  return (
    <form onSubmit={applyFilters} className="space-y-5 px-4 py-4">
      <div>
        <label htmlFor="reading-date" className="block text-sm font-medium text-slate-700">Tanggal Baca</label>
        <input id="reading-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
        <p className="mt-1 text-xs text-slate-500">Filter menggunakan hari dalam bulan saja, tanpa bulan dan tahun.</p>
      </div>
      <div>
        <label htmlFor="reading-meter-reader" className="block text-sm font-medium text-slate-700">Pembaca Meter</label>
        <select id="reading-meter-reader" value={meterReader} onChange={(event) => setMeterReader(event.target.value)} className={inputClass}>
          <option value="">Semua pembaca</option>
          {options.map((reader) => <option key={reader} value={reader}>{reader}</option>)}
        </select>
        {optionsLoading && <p role="status" className="mt-1 text-xs text-slate-500">Memuat pembaca meter...</p>}
        {optionsError && <p role="alert" className="mt-1 text-xs text-rose-700">Gagal memuat daftar pembaca meter.</p>}
      </div>
      <div className="space-y-2">
        <button type="submit" disabled={loading || !date} className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? 'Memuat pelanggan...' : 'Terapkan Filter'}
        </button>
        <button
          type="button"
          onClick={generateRoute}
          disabled={loading || routeLoading || !validCustomerCount || routeLimitExceeded}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {routeLoading ? routeStage : 'Buat Rute'}
        </button>
        {routeLoading && <p role="status" className="text-xs text-slate-500">{routeStage}</p>}
        {routeLimitExceeded && (
          <p className="text-xs text-amber-800">Terdapat {validCustomerCount.toLocaleString('id-ID')} pelanggan valid. Maksimum rute {maxRouteCustomers.toLocaleString('id-ID')} pelanggan agar aplikasi tetap responsif. Persempit filter pembaca meter; hasil filter tidak dipotong.</p>
        )}
        {appliedFilters && !validCustomerCount && customers.length > 0 && (
          <p className="text-xs text-slate-500">Tidak ada koordinat pelanggan yang valid untuk membuat rute.</p>
        )}
        {invalidCoordinateCount > 0 && !route && <p className="text-xs text-slate-500">Koordinat tidak valid: {invalidCoordinateCount}. Pelanggan ini tidak disertakan dalam rute.</p>}
      </div>
      {routeError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{routeError}</p>}
      {route && (
        <section aria-label="Rute Baca Meter" className="space-y-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Rute Baca Meter</h2>
          <dl className="space-y-2 text-xs text-slate-700">
            <div className="flex justify-between gap-2"><dt>Total Pelanggan</dt><dd className="font-medium">{route.stops.length}</dd></div>
            <div className="flex justify-between gap-2"><dt>Estimasi Jarak Garis Lurus</dt><dd className="font-medium">{(route.totalDistanceMeters / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} km</dd></div>
            <div className="flex justify-between gap-2"><dt>Koordinat Tidak Valid</dt><dd className="font-medium">{route.invalidCoordinateCount}</dd></div>
          </dl>
          {route.duplicateCount > 0 && <p className="text-xs text-slate-600">{route.duplicateCount} duplikat pelanggan digabungkan.</p>}
          <p className="text-xs leading-relaxed text-slate-600">Urutan kunjungan berdasarkan jarak geografis terdekat. Ini rute perkiraan garis lurus, bukan jarak atau petunjuk jalan.</p>
          <button type="button" onClick={clearRoute} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">Hapus Rute</button>
        </section>
      )}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error} Hasil sebelumnya tetap ditampilkan.</p>}
      <div role="status" aria-live="polite" aria-busy={loading} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="text-sm font-medium text-slate-700">Jumlah Pelanggan</div>
        <div className="mt-1 text-2xl font-semibold text-slate-900">{appliedFilters ? customers.length : '—'}</div>
        <p className="mt-2 text-xs text-slate-500">
          {loading ? 'Memuat pelanggan sesuai filter...' : !appliedFilters ? 'Pilih filter, lalu tekan Terapkan Filter.' : customers.length === 0 ? 'Tidak ada pelanggan yang sesuai dengan filter ini.' : `Hasil hari ke-${Number(appliedFilters.date.split('-')[2])} setiap bulan · ${appliedFilters.meterReader || 'Semua pembaca'}`}
        </p>
        {hasChanges && <p className="mt-2 text-xs text-slate-500">Perubahan filter belum diterapkan.</p>}
      </div>
    </form>
  )
}
