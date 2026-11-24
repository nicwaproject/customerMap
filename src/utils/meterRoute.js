// Exact Nearest Neighbor is O(n²). Never silently truncate a customer's route.
export const MAX_ROUTE_CUSTOMERS = 5000

export function getCustomerCoordinates(customer) {
  const lat = customer?.latitude
  const lng = customer?.longitude
  if ((typeof lat !== 'number' && typeof lat !== 'string') ||
      (typeof lng !== 'number' && typeof lng !== 'string') ||
      String(lat).trim() === '' || String(lng).trim() === '') return null
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}

export function analyzeRouteCustomers(customers = []) {
  const stops = []
  const seen = new Set()
  let invalidCoordinateCount = 0
  let duplicateCount = 0
  for (const [index, customer] of customers.entries()) {
    const coordinates = getCustomerCoordinates(customer)
    if (!coordinates) {
      invalidCoordinateCount++
      continue
    }
    const id = customer.id ?? customer.no_langganan
    const key = id == null ? `row:${index}` : `id:${id}`
    if (seen.has(key)) {
      duplicateCount++
      continue
    }
    seen.add(key)
    stops.push({ customer, key, ...coordinates })
  }
  return { stops, invalidCoordinateCount, duplicateCount }
}

export function haversineMeters(a, b) {
  const radians = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * radians
  const dLng = (b.longitude - a.longitude) * radians
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * radians) *
    Math.cos(b.latitude * radians) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}

function checkAborted(signal) {
  if (signal?.aborted) throw new DOMException('Route calculation cancelled', 'AbortError')
}

export async function buildNearestNeighborRoute({
  customers, start, signal,
  yieldControl = () => new Promise((resolve) => setTimeout(resolve, 0)),
}) {
  checkAborted(signal)
  const origin = getCustomerCoordinates(start)
  if (!origin) throw new Error('Lokasi awal tidak valid. Silakan ambil lokasi lagi.')
  const { stops, invalidCoordinateCount, duplicateCount } = analyzeRouteCustomers(customers)
  if (!stops.length) throw new Error('Tidak ada pelanggan dengan koordinat valid.')
  if (stops.length > MAX_ROUTE_CUSTOMERS) {
    throw new Error(`Rute dibatasi hingga ${MAX_ROUTE_CUSTOMERS.toLocaleString('id-ID')} pelanggan valid. Persempit filter pembaca meter; tidak ada pelanggan yang dipotong otomatis.`)
  }

  const visited = new Uint8Array(stops.length)
  const ordered = []
  let current = origin
  let totalDistanceMeters = 0
  let work = 0
  let sliceStarted = performance.now()
  // Yield before starting so loading feedback can paint, then time-slice the scan.
  await yieldControl()
  checkAborted(signal)
  while (ordered.length < stops.length) {
    let bestIndex = -1
    let bestDistance = Infinity
    for (let index = 0; index < stops.length; index++) {
      if (!visited[index]) {
        const distance = haversineMeters(current, stops[index])
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = index
        }
      }
      if (++work % 256 === 0 && performance.now() - sliceStarted >= 8) {
        await yieldControl()
        checkAborted(signal)
        sliceStarted = performance.now()
      }
    }
    visited[bestIndex] = 1
    current = stops[bestIndex]
    ordered.push(current)
    totalDistanceMeters += bestDistance
  }
  return { start: origin, stops: ordered, totalDistanceMeters, invalidCoordinateCount, duplicateCount }
}
