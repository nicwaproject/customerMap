export const STATUS_OPTIONS = /** @type {const} */ ([
  { value: 'all', label: 'Semua', values: [] },
  { value: 'aktif', label: 'Aktif', values: ['aktif', 'Aktif', 'AKTIF'] },
  {
    value: 'putus_rampung',
    label: 'Putus Rampung',
    values: ['putus rampung', 'Putus Rampung', 'PUTUS RAMPUNG'],
  },
  {
    value: 'tutup_atas_permintaan_sendiri',
    label: 'Tutup Atas Permintaan Sendiri',
    values: [
      'tutup atas permintaan sendiri',
      'Tutup Atas Permintaan Sendiri',
      'TUTUP ATAS PERMINTAAN SENDIRI',
    ],
  },
  {
    value: 'tutup_sementara',
    label: 'Tutup Sementara',
    values: ['tutup sementara', 'Tutup Sementara', 'TUTUP SEMENTARA'],
  },
])

const STATUS_META = {
  aktif: {
    label: 'Aktif',
    markerColor: '#16a34a',
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    legendClass: 'bg-emerald-500',
  },
  putus_rampung: {
    label: 'Putus Rampung',
    markerColor: '#e11d48',
    badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200',
    legendClass: 'bg-rose-500',
  },
  tutup_atas_permintaan_sendiri: {
    label: 'Tutup Atas Permintaan Sendiri',
    markerColor: '#2563eb',
    badgeClass: 'bg-blue-50 text-blue-700 ring-blue-200',
    legendClass: 'bg-blue-500',
  },
  tutup_sementara: {
    label: 'Tutup Sementara',
    markerColor: '#eab308',
    badgeClass: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
    legendClass: 'bg-yellow-400',
  },
  unknown: {
    label: 'Tidak diketahui',
    markerColor: '#64748b',
    badgeClass: 'bg-slate-50 text-slate-700 ring-slate-200',
    legendClass: 'bg-slate-500',
  },
}

export function normalizeStatusKey(status) {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

  if (normalized === 'aktif') return 'aktif'
  if (normalized === 'putus rampung') return 'putus_rampung'
  if (normalized === 'tutup atas permintaan sendiri') {
    return 'tutup_atas_permintaan_sendiri'
  }
  if (normalized === 'tutup sementara') return 'tutup_sementara'
  return 'unknown'
}

export function getCustomerStatusMeta(status) {
  return STATUS_META[normalizeStatusKey(status)] ?? STATUS_META.unknown
}

export function getCustomerStatusColor(status) {
  return getCustomerStatusMeta(status).markerColor
}

export function getStatusFilterValues(statusFilter) {
  const option = STATUS_OPTIONS.find((item) => item.value === statusFilter)
  return option?.values ?? []
}
