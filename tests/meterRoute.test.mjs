import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRouteCustomers, buildNearestNeighborRoute, getCustomerCoordinates, haversineMeters, MAX_ROUTE_CUSTOMERS } from '../src/utils/meterRoute.js'

const start = { latitude: 0, longitude: 0 }
const customer = (id, longitude, latitude = 0) => ({ id, longitude, latitude })

test('Nearest Neighbor starts at live coordinates, visits every unique customer once, and totals each leg', async () => {
  const customers = Object.freeze([customer('C', 3), customer('A', 1), customer('B', 2)].map(Object.freeze))
  const route = await buildNearestNeighborRoute({ customers, start })
  assert.deepEqual(route.start, start)
  assert.deepEqual(route.stops.map((stop) => stop.customer.id), ['A', 'B', 'C'])
  assert.equal(new Set(route.stops.map((stop) => stop.key)).size, 3)
  assert.ok(Math.abs(route.totalDistanceMeters - haversineMeters(start, customers[0])) < 0.001)
  assert.deepEqual(customers.map((row) => row.id), ['C', 'A', 'B'], 'source dataset must not be mutated')
})

test('Haversine uses geographical distance, including across the antimeridian', () => {
  assert.equal(haversineMeters(start, start), 0)
  assert.ok(Math.abs(haversineMeters(start, customer(1, 1)) - 111194.9266) < 0.01)
  assert.ok(Math.abs(haversineMeters(customer(1, 179), customer(2, -179)) - 222389.8533) < 0.01)
})

test('invalid coordinates are excluded; duplicate identifiers are visited once; zero coordinates remain valid', async () => {
  const customers = [customer(1, '1'), customer('1', 2), customer(2, 0),
    customer(3, null), customer(4, ''), customer(5, 181), customer(6, NaN),
    customer(7, 1, 91), customer(8, true), customer(9, '   ')]
  const analysis = analyzeRouteCustomers(customers)
  assert.equal(analysis.stops.length, 2)
  assert.equal(analysis.invalidCoordinateCount, 7)
  assert.equal(analysis.duplicateCount, 1)
  assert.deepEqual(getCustomerCoordinates(customer(1, 0)), start)
  const route = await buildNearestNeighborRoute({ customers, start })
  assert.deepEqual(route.stops.map((stop) => stop.customer.id), [2, 1])
  assert.equal(route.invalidCoordinateCount, 7)
  assert.equal(route.duplicateCount, 1)
})

test('empty/invalid datasets and invalid origins produce understandable errors', async () => {
  await assert.rejects(buildNearestNeighborRoute({ customers: [], start }), /Tidak ada pelanggan/)
  await assert.rejects(buildNearestNeighborRoute({ customers: [customer(1, 1)], start: { latitude: null, longitude: 1 } }), /Lokasi awal tidak valid/)
})

test('large routes reject explicitly without silently truncating customers', async () => {
  const customers = Array.from({ length: MAX_ROUTE_CUSTOMERS + 1 }, (_, id) => customer(id, id / 1000))
  await assert.rejects(buildNearestNeighborRoute({ customers, start }), /dibatasi.*Persempit filter/)
  assert.equal(customers.length, MAX_ROUTE_CUSTOMERS + 1)
})

test('long scans yield to the event loop and can be cancelled during calculation', async () => {
  const customers = Array.from({ length: 2000 }, (_, id) => customer(id, id / 1000))
  const controller = new AbortController()
  let yields = 0
  await assert.rejects(buildNearestNeighborRoute({ customers, start, signal: controller.signal,
    yieldControl: async () => { if (++yields === 2) controller.abort() },
  }), { name: 'AbortError' })
  assert.equal(yields, 2)
  assert.equal(customers.length, 2000)
})
