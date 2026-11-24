import test from 'node:test'
import assert from 'node:assert/strict'
import * as utils from '../src/utils/meterRoute.js'
import { deferred, hookHarness, loadModule } from './helpers/routeHarness.mjs'

const origin = { latitude: 0, longitude: 0, accuracy: 10 }
const rows = [{ id: 'far', latitude: 0, longitude: 2 }, { id: 'near', latitude: 0, longitude: 1 }, { id: 'bad', latitude: null, longitude: 1 }]

async function setup() {
  const harness = hookHarness()
  const { useMeterRoute } = await loadModule('src/hooks/useMeterRoute.js', [
    ["import { useEffect, useMemo, useRef, useState } from 'react'", 'const { useEffect, useMemo, useRef, useState } = testGlobals.hooks'],
    ["import { analyzeRouteCustomers, buildNearestNeighborRoute, MAX_ROUTE_CUSTOMERS } from '../utils/meterRoute'", 'const { analyzeRouteCustomers, buildNearestNeighborRoute, MAX_ROUTE_CUSTOMERS } = testGlobals.utils'],
  ], { hooks: harness.hooks, utils })
  const fetches = []
  const gps = []
  const { useBacaMeter } = await loadModule('src/hooks/useBacaMeter.js', [
    ["import { useEffect, useRef, useState } from 'react'", 'const { useEffect, useRef, useState } = testGlobals.hooks'],
    ["import { useMeterRoute } from './useMeterRoute'", 'const { useMeterRoute } = testGlobals'],
    ["import { getCustomersByReadingDate } from '../services/customerService'", 'const { getCustomersByReadingDate } = testGlobals'],
  ], { hooks: harness.hooks, useMeterRoute,
    getCustomersByReadingDate: (filters) => { const request = deferred(); fetches.push({ filters, ...request }); return request.promise },
  })
  const requestLocation = () => { const request = deferred(); gps.push(request); return request.promise }
  const render = () => harness.render(() => useBacaMeter({ requestLocation }))
  const apply = async (data = rows) => {
    const pending = render().applyFilters({ preventDefault() {} })
    fetches.at(-1).resolve({ data, error: null })
    await pending
    return render()
  }
  const generate = async () => {
    const pending = render().generateRoute()
    gps.at(-1).resolve(origin)
    await pending
    return render()
  }
  return { harness, render, apply, generate, fetches, gps }
}

test('filtering works without GPS; routing uses only applied results and starts at fresh user coordinates', async () => {
  const { render, apply, generate, fetches, gps } = await setup()
  let state = render()
  await state.generateRoute()
  assert.equal(gps.length, 0)
  assert.equal(state.validCustomerCount, 0)
  state.setDate('2026-10-15')
  state.setMeterReader('Ani')
  state = await apply()
  assert.equal(gps.length, 0, 'applying filters must not request location')
  assert.equal(state.route, null, 'applying filters must not calculate routes')
  assert.equal(state.customers.length, 3)
  assert.equal(state.validCustomerCount, 2)
  assert.equal(state.invalidCoordinateCount, 1)
  assert.deepEqual(state.appliedFilters, { date: '2026-10-15', meterReader: 'Ani' })
  state.setDate('2026-10-16')
  state = await generate()
  assert.equal(gps.length, 1)
  assert.equal(fetches.length, 1, 'routing must not fetch another customer dataset')
  assert.deepEqual(state.route.start, { latitude: 0, longitude: 0 })
  assert.deepEqual(state.route.stops.map((stop) => stop.customer.id), ['near', 'far'])
  assert.equal(state.appliedFilters.date, '2026-10-15', 'drafts do not change the routed dataset')
  assert.equal(state.routeLoading, false)
})

test('failed filters preserve the last route and dataset; successful filters clear the route only on completion', async (t) => {
  t.mock.method(console, 'error', () => {})
  const { render, apply, generate, fetches } = await setup()
  await apply()
  let state = await generate()
  const previous = { route: state.route, customers: state.customers, filters: state.appliedFilters }
  state.setDate('2026-10-16')
  let pending = render().applyFilters({ preventDefault() {} })
  assert.equal(render().route, previous.route, 'keep route during loading')
  fetches.at(-1).resolve({ data: [], error: { code: 'NETWORK', message: 'failed' } })
  await pending
  state = render()
  assert.equal(state.route, previous.route)
  assert.equal(state.customers, previous.customers)
  assert.equal(state.appliedFilters, previous.filters)
  pending = state.applyFilters({ preventDefault() {} })
  assert.equal(render().route, previous.route)
  fetches.at(-1).resolve({ data: [], error: null })
  await pending
  state = render()
  assert.equal(state.route, null)
  assert.deepEqual(state.customers, [])
  assert.equal(state.validCustomerCount, 0)
  assert.equal(state.appliedFilters.date, '2026-10-16')
})

test('Hapus Rute keeps filter results and never requests/clears GPS', async () => {
  const { render, apply, generate, gps } = await setup()
  await apply()
  let state = await generate()
  const previous = { customers: state.customers, filters: state.appliedFilters }
  state.clearRoute()
  state = render()
  assert.equal(state.route, null)
  assert.equal(state.customers, previous.customers)
  assert.equal(state.appliedFilters, previous.filters)
  assert.equal(gps.length, 1)
})

test('GPS denial preserves the previous route and allows retry; duplicate route clicks share one request', async () => {
  const { render, apply, generate, gps } = await setup()
  await apply()
  const previousRoute = (await generate()).route
  const pending = render().generateRoute()
  await render().generateRoute()
  assert.equal(gps.length, 2)
  assert.equal(render().routeLoading, true)
  gps.at(-1).resolve(null)
  await pending
  let state = render()
  assert.equal(state.route, previousRoute)
  assert.equal(state.routeLoading, false)
  assert.match(state.routeError, /izin lokasi atau GPS/)
  state = await generate()
  assert.equal(state.routeError, null)
})

test('a new successful filter cancels a route waiting for GPS, preventing stale routes', async () => {
  const { render, apply, gps } = await setup()
  await apply()
  const pending = render().generateRoute()
  await apply([{ id: 'new', latitude: 1, longitude: 1 }])
  gps.at(-1).resolve(origin)
  await pending
  const state = render()
  assert.equal(state.route, null)
  assert.equal(state.customers[0].id, 'new')
  assert.equal(state.routeLoading, false)
})

test('oversized datasets retain all filter results, expose the limit, and do not request GPS', async () => {
  const { render, apply, gps } = await setup()
  let state = await apply(Array.from({ length: utils.MAX_ROUTE_CUSTOMERS + 1 }, (_, id) => ({ id, latitude: 0, longitude: 1 })))
  assert.equal(state.customers.length, utils.MAX_ROUTE_CUSTOMERS + 1)
  assert.equal(state.routeLimitExceeded, true)
  await state.generateRoute()
  state = render()
  assert.equal(state.route, null)
  assert.equal(gps.length, 0)
})

test('route completion after unmount cannot write state', async () => {
  const { harness, render, apply, gps } = await setup()
  await apply()
  const pending = render().generateRoute()
  harness.unmount()
  const writes = harness.writes()
  gps.at(-1).resolve(origin)
  await pending
  assert.equal(harness.writes(), writes)
})
