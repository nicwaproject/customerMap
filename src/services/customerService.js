import { supabase } from '../lib/supabase'
import { getStatusFilterValues } from '../utils/customerStatus'

const TABLE = 'pelanggan'

function toIlikePattern(q) {
  const trimmed = String(q ?? '').trim()
  if (trimmed.length === 0) return null
  // Note: Supabase ilike uses SQL LIKE semantics; we keep it simple.
  return `%${trimmed}%`
}

function applyStatusFilter(query, status) {
  const values = getStatusFilterValues(status)
  if (values.length === 0) return query
  return query.in('status', values)
}

export function normalizeCustomer(row) {
  if (!row) return null
  return {
    // keep existing frontend naming stable where possible
    id: row.no_langganan ?? row.id ?? null,
    no_langganan: row.no_langganan ?? null,
    status: row.status ?? null,
    nama: row.nama ?? null,
    alamat: row.alamat ?? null,
    pembaca_meter: row.pembaca_meter ?? null,
    jalan: row.jalan ?? null,
    kelurahan: row.kelurahan ?? null,
    kecamatan: row.kecamatan ?? null,
    no_body_m: row.no_body_m ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    golongan: row.gol ?? row.golongan ?? row.status_group ?? null,
  }
}

export async function getCustomersByBounds({
  bounds,
  status = 'all',
  zoom = 13,
}) {
  if (!bounds) return { data: [], error: null }

  const { south, west, north, east } = bounds

  let limit = 1000

if (zoom >= 16) {
  limit = 12000
} else if (zoom >= 14) {
  limit = 4000
}

  let q = supabase
    .from(TABLE)
    .select(
      [
        'no_langganan',
        'status',
        'nama',
        'alamat',
        'pembaca_meter',
        'jalan',
        'kelurahan',
        'kecamatan',
        'no_body_m',
        'gol',
        'latitude',
        'longitude',
      ].join(','),
    )
    .gte('latitude', south)
    .lte('latitude', north)
    .gte('longitude', west)
    .lte('longitude', east)
    .limit(limit)

  q = applyStatusFilter(q, status)

  const { data, error } = await q
  return { data: (data ?? []).map(normalizeCustomer), error }
}

export async function searchCustomers({
  query,
  status = 'all',
  limit = 25,
}) {
  const pattern = toIlikePattern(query)
  if (!pattern) return { data: [], error: null }

  const selectColumns = [
    'no_langganan',
    'status',
    'nama',
    'alamat',
    'kelurahan',
    'kecamatan',
    'pembaca_meter',
    'gol',
    'latitude',
    'longitude',
    'jalan',
    'no_body_m',
  ].join(',')

  // 1) Search text columns first to avoid potential SQL type issues
  //    (e.g. no_langganan could be numeric, and ilike on numeric may fail).
  let textQuery = supabase
    .from(TABLE)
    .select(selectColumns, { count: 'estimated' })
    .or(
      [`nama.ilike.${pattern}`, `alamat.ilike.${pattern}`, `kelurahan.ilike.${pattern}`].join(
        ',',
      ),
    )
    .limit(limit)

  textQuery = applyStatusFilter(textQuery, status)

  const { data: textRows, error: textError, count } = await textQuery
  if (textError) {
    return { data: [], error: textError, count: count ?? null }
  }

  const normalizedText = (textRows ?? []).map(normalizeCustomer).filter(Boolean)

  // 2) Best-effort search for no_langganan (partial match when possible).
  //    If the column type doesn't support ilike, we ignore the error and keep text matches.
  const remaining = Math.max(0, limit - normalizedText.length)
  if (remaining === 0) {
    return { data: normalizedText, error: null, count: count ?? normalizedText.length }
  }

  let noLangQuery = supabase
    .from(TABLE)
    .select(selectColumns)
    .ilike('no_langganan', pattern)
    .limit(remaining)

  noLangQuery = applyStatusFilter(noLangQuery, status)

  const { data: noLangRows, error: noLangError } = await noLangQuery
  if (noLangError) {
    return { data: normalizedText, error: null, count: count ?? normalizedText.length }
  }

  const normalizedNoLang = (noLangRows ?? []).map(normalizeCustomer).filter(Boolean)

  // De-dupe by `id` (no_langganan).
  const mergedById = new Map()
  for (const c of normalizedText) mergedById.set(String(c.id ?? ''), c)
  for (const c of normalizedNoLang) mergedById.set(String(c.id ?? ''), c)

  return {
    data: Array.from(mergedById.values()).slice(0, limit),
    error: null,
    count: count ?? mergedById.size,
  }
}

export async function getCustomerById(id) {
  const key = String(id ?? '').trim()
  if (!key) return { data: null, error: null }

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      [
        'no_langganan',
        'status',
        'nama',
        'alamat',
        'kelurahan',
        'kecamatan',
        'pembaca_meter',
        'gol',
        'jalan',
        'no_body_m',
        'latitude',
        'longitude',
      ].join(','),
    )
    .eq('no_langganan', key)
    .maybeSingle()

  return { data: normalizeCustomer(data), error }
}

function haversineMeters(a, b) {
  const R = 6371000
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

export async function getNearestCustomer({
  lat,
  lng,
  status = 'all',
  maxTries = 3,
}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { data: null, error: null }
  }

  // We progressively expand a bbox around the click.
  // 0.003° ~ 333m (lat) near equator, good starting point for operational use.
  const deltas = [0.003, 0.01, 0.03].slice(0, maxTries)

  for (const d of deltas) {
    const bounds = {
      south: lat - d,
      north: lat + d,
      west: lng - d,
      east: lng + d,
    }
    const { data, error } = await getCustomersByBounds({
      bounds,
      status,
      zoom: 16,
      limit: 2000,
    })
    if (error) return { data: null, error }
    if (!data || data.length === 0) continue

    let best = null
    let bestDist = Infinity

    for (const c of data) {
      const clat = Number(c.latitude)
      const clng = Number(c.longitude)
      if (!Number.isFinite(clat) || !Number.isFinite(clng)) continue
      const dist = haversineMeters({ lat, lng }, { lat: clat, lng: clng })
      if (dist < bestDist) {
        bestDist = dist
        best = c
      }
    }

    if (best) return { data: best, distanceMeters: bestDist, error: null }
  }

  return { data: null, error: null }
}
