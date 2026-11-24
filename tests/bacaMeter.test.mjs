import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getStatusFilterValues } from '../src/utils/customerStatus.js'

globalThis.__customerStatusFilter = getStatusFilterValues

// Load the service with a fake Supabase transport; no credentials or live DB needed.
const source = (await readFile(new URL('../src/services/customerService.js', import.meta.url), 'utf8'))
  .replace("import { supabase } from '../lib/supabase'", 'const supabase = globalThis.__bacaMeterSupabase')
  .replace("import { getStatusFilterValues } from '../utils/customerStatus'", 'const getStatusFilterValues = globalThis.__customerStatusFilter')

async function serviceWith(pages) {
  const requests = []
  function buildRequest(metadata) {
      const request = { ...metadata, conditions: [], orders: [] }
      requests.push(request)
      const builder = {
        select(columns) { request.columns = columns; return this },
        eq(column, value) { request.conditions.push([column, value]); return this },
        in(column, values) { request.conditions.push([column, values]); return this },
        gte(column, value) { (request.bounds ??= []).push(['gte', column, value]); return this },
        lte(column, value) { (request.bounds ??= []).push(['lte', column, value]); return this },
        limit(value) { request.limit = value; return this },
        or(value) { request.or = value; return this },
        ilike(column, value) { request.ilike = [column, value]; return this },
        not() { return this },
        order(column) { request.orders.push(column); return this },
        range(from, to) { request.range = [from, to]; return this },
        abortSignal(signal) { request.signal = signal; return this },
        then(resolve, reject) {
          const page = pages.shift()
          assert.ok(page, 'Unexpected extra request')
          return Promise.resolve(page).then(resolve, reject)
        },
      }
      return builder
  }
  globalThis.__bacaMeterSupabase = {
    from: (table) => buildRequest({ table }),
    rpc: (name, args) => buildRequest({ rpc: name, args }),
  }
  const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Math.random()}`)
  return { ...module, requests }
}

const row = (id) => ({ no_langganan: id, nama: `Customer ${id}`, latitude: -8.5, longitude: 116.1 })

test('day-of-month and reader arguments apply on every RPC page beyond 1,000 rows', async () => {
  const rows = Array.from({ length: 1507 }, (_, index) => row(index))
  const { getCustomersByReadingDate, requests } = await serviceWith([
    { data: rows.slice(0, 1000) }, { data: rows.slice(1000) }, { data: [] },
  ])
  const signal = new AbortController().signal
  const result = await getCustomersByReadingDate({ date: '2026-10-24', meterReader: 'Reader A', signal })
  assert.equal(result.error, null)
  assert.equal(result.data.length, 1507)
  assert.equal(result.data[1506].id, 1506)
  assert.deepEqual(requests.map((request) => request.range), [[0, 999], [1000, 1999], [1507, 2506]])
  for (const request of requests) {
    assert.equal(request.rpc, 'get_customers_by_reading_day')
    assert.deepEqual(request.args, { p_day: 24, p_meter_reader: 'Reader A' })
    assert.deepEqual(request.conditions, [])
    assert.deepEqual(request.orders, ['no_langganan'])
    assert.equal(request.signal, signal)
  }
})

test('all readers use a null RPC argument and tolerate a server cap below 1,000', async () => {
  const { getCustomersByReadingDate, requests } = await serviceWith([
    { data: [row(1), row(2)] }, { data: [row(3)] }, { data: [] },
  ])
  const result = await getCustomersByReadingDate({ date: '2026-10-23' })
  assert.equal(result.data.length, 3)
  assert.deepEqual(requests.map((request) => request.range[0]), [0, 2, 3])
  assert.ok(requests.every((request) => request.args.p_meter_reader === null && request.args.p_day === 23))
})

test('empty date results return an empty successful dataset', async () => {
  const { getCustomersByReadingDate } = await serviceWith([{ data: [] }])
  assert.deepEqual(await getCustomersByReadingDate({ date: '2026-10-24' }), { data: [], error: null })
})

test('a failed later page discards partial results', async () => {
  const error = { message: 'Network error' }
  const { getCustomersByReadingDate } = await serviceWith([{ data: [row(1)] }, { data: null, error }])
  assert.deepEqual(await getCustomersByReadingDate({ date: '2026-10-24' }), { data: [], error })
})

test('reader names are unique, alphabetic, nonempty, and preserve exact query values', async () => {
  const { getMeterReaderOptions } = await serviceWith([
    { data: [{ pembaca_meter: 'Zara' }, { pembaca_meter: null }, { pembaca_meter: '' }] },
    { data: [{ pembaca_meter: 'Ani' }, { pembaca_meter: 'Zara' }, { pembaca_meter: '   ' }] },
    { data: [{ pembaca_meter: 'all' }] }, { data: [] },
  ])
  const result = await getMeterReaderOptions({ maxRows: Infinity, preserveValues: true })
  assert.deepEqual(result, { data: ['all', 'Ani', 'Zara'], error: null })
})

test('local date follows calendar getters across UTC day boundaries', async () => {
  const hookSource = await readFile(new URL('../src/hooks/useBacaMeter.js', import.meta.url), 'utf8')
  const dateFunction = hookSource.slice(hookSource.indexOf('export function getLocalDate'), hookSource.indexOf('export function useBacaMeter'))
  const { getLocalDate } = await import(`data:text/javascript;base64,${Buffer.from(dateFunction).toString('base64')}`)
  const originalTimezone = process.env.TZ
  try {
    process.env.TZ = 'Asia/Makassar'
    assert.equal(getLocalDate(new Date('2026-10-23T18:00:00Z')), '2026-10-24')
    process.env.TZ = 'America/Los_Angeles'
    assert.equal(getLocalDate(new Date('2026-10-24T02:00:00Z')), '2026-10-23')
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimezone
  }
})

test('draft filters stay independent of applied results and survive workspace switches', async (t) => {
  const diagnosticLog = t.mock.method(console, 'error', () => {})
  const slots = []
  let cursor = 0
  const pendingEffects = []
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(effect, dependencies) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || dependencies.some((value, key) => !Object.is(value, previous.dependencies[key]))) {
        pendingEffects.push(() => {
          previous?.cleanup?.()
          slots[index] = { dependencies, cleanup: effect() }
        })
      }
    },
  }
  const calls = []
  let complete
  globalThis.__bacaMeterHookTest = {
    ...react,
    getCustomersByReadingDate: (filters) => {
      calls.push(filters)
      return new Promise((resolve) => { complete = resolve })
    },
  }
  const hookSource = (await readFile(new URL('../src/hooks/useBacaMeter.js', import.meta.url), 'utf8'))
    .replace("import { useEffect, useRef, useState } from 'react'", 'const { useEffect, useRef, useState } = globalThis.__bacaMeterHookTest')
    .replace("import { getCustomersByReadingDate } from '../services/customerService'", 'const { getCustomersByReadingDate } = globalThis.__bacaMeterHookTest')
    .replace("import { useMeterRoute } from './useMeterRoute'", 'const useMeterRoute = () => ({ clearRoute() {} })')
  const { useBacaMeter } = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)
  const render = (active = true) => {
    cursor = 0
    const state = useBacaMeter(active)
    while (pendingEffects.length) pendingEffects.shift()()
    return state
  }
  let state = render(false)
  assert.equal(state.customers, null, 'unapplied results must not be an empty dataset')
  state = render()
  await Promise.resolve()
  state.setDate('2026-10-24')
  state.setMeterReader('Ani')
  state = render()
  assert.equal(calls.length, 0, 'editing filters must not fetch')
  const submit = () => ({ preventDefault() {} })
  const apply = state.applyFilters(submit())
  assert.equal(calls.length, 1)
  assert.equal(render().loading, true)
  await render().applyFilters(submit())
  assert.equal(calls.length, 1, 'duplicate submits must not start another request')
  complete({ data: [row(1)], error: null })
  await apply
  state = render()
  assert.deepEqual(state.appliedFilters, { date: '2026-10-24', meterReader: 'Ani' })
  const previousCustomers = state.customers
  state.setDate('2026-10-25')
  render(false)
  state = render(true)
  assert.equal(state.date, '2026-10-25')
  assert.equal(state.appliedFilters.date, '2026-10-24')
  assert.equal(state.customers, previousCustomers)
  assert.equal(calls.length, 1, 'switching workspaces must reuse applied results')
  const failedApply = state.applyFilters(submit())
  complete({ data: [], error: { code: 'PGRST202', message: 'Could not find the function', details: 'Missing RPC signature', hint: null } })
  await failedApply
  state = render()
  assert.match(state.error, /belum tersedia di server/)
  assert.deepEqual(diagnosticLog.mock.calls[0].arguments, [
    '[Baca Meter] Customer filtering failed',
    { operation: 'get_customers_by_reading_day', date: '2026-10-25', day: 25,
      meterReader: 'Ani', code: 'PGRST202', message: 'Could not find the function',
      details: 'Missing RPC signature', hint: null },
  ])
  assert.equal(state.loading, false)
  assert.equal(state.customers, previousCustomers, 'errors must preserve the last successful dataset')
  assert.equal(state.appliedFilters.date, '2026-10-24')
  const emptyApply = state.applyFilters(submit())
  complete({ data: [], error: null })
  await emptyApply
  state = render()
  assert.equal(state.customers.length, 0)
  assert.equal(state.appliedFilters.date, '2026-10-25')
})

test('selected month/year do not change the RPC day, including day 1 and day 31', async () => {
  for (const date of ['2026-10-24', '2026-09-24', '2025-08-24', '2026-01-01', '2026-12-31']) {
    const { getCustomersByReadingDate, requests } = await serviceWith([{ data: [] }])
    const result = await getCustomersByReadingDate({ date })
    assert.equal(result.error, null)
    assert.deepEqual(requests[0].args, { p_day: Number(date.slice(-2)), p_meter_reader: null })
    assert.equal(requests[0].table, undefined, 'must call a server RPC rather than scan customers in the browser')
  }
})

test('invalid or missing reading days do not issue database requests', async () => {
  const { getCustomersByReadingDate, requests } = await serviceWith([])
  for (const date of ['', undefined, '2026-10-00', '2026-10-32', 'invalid']) {
    const result = await getCustomersByReadingDate({ date })
    assert.ok(result.error)
    assert.deepEqual(result.data, [])
  }
  assert.equal(requests.length, 0)
})

test('missing day RPC is propagated with its original code and details without fallback scans', async () => {
  const error = { code: 'PGRST202', message: 'Could not find the function', details: 'Missing RPC signature', hint: null }
  const { getCustomersByReadingDate, requests } = await serviceWith([{ data: null, error }])
  const result = await getCustomersByReadingDate({ date: '2026-10-15', meterReader: 'Ani' })
  assert.equal(result.error, error)
  assert.deepEqual(result.data, [])
  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0].args, { p_day: 15, p_meter_reader: 'Ani' })
})

test('malformed successful responses reject the whole result instead of replacing markers with partial data', async () => {
  for (const data of [null, undefined, {}, { length: 1 }]) {
    const { getCustomersByReadingDate } = await serviceWith([{ data: [row(1)] }, { data }])
    const result = await getCustomersByReadingDate({ date: '2026-10-15' })
    assert.equal(result.error.code, 'INVALID_CUSTOMER_RESPONSE')
    assert.deepEqual(result.data, [])
  }
})

test('Customer Service keeps its existing bounds/status/reader query, independent of Baca Meter day RPC', async () => {
  const { getCustomersByBounds, requests } = await serviceWith([{ data: [row(1)], error: null }])
  const result = await getCustomersByBounds({ bounds: { south: -9, north: -8, west: 115, east: 117 }, status: 'aktif', meterReader: 'Ani', limit: 25 })
  assert.equal(result.data[0].id, 1)
  assert.equal(requests[0].table, 'pelanggan')
  assert.equal(requests[0].rpc, undefined)
  assert.deepEqual(requests[0].conditions, [['status', ['aktif', 'Aktif', 'AKTIF']], ['pembaca_meter', 'Ani']])
  assert.deepEqual(requests[0].bounds, [['gte', 'latitude', -9], ['lte', 'latitude', -8], ['gte', 'longitude', 115], ['lte', 'longitude', 117]])
  assert.equal(requests[0].limit, 25)
})

test('Customer Service text and customer-number searches keep status and reader filters', async () => {
  const { searchCustomers, requests } = await serviceWith([
    { data: [row(1)], count: 1, error: null }, { data: [row(2)], error: null },
  ])
  const result = await searchCustomers({ query: 'customer', status: 'aktif', meterReader: 'Ani' })
  assert.deepEqual(result.data.map((customer) => customer.id), [1, 2])
  assert.equal(requests.length, 2)
  assert.ok(requests[0].or.includes('nama.ilike.%customer%'))
  assert.deepEqual(requests[1].ilike, ['no_langganan', '%customer%'])
  for (const request of requests) {
    assert.equal(request.table, 'pelanggan')
    assert.equal(request.rpc, undefined)
    assert.deepEqual(request.conditions, [['status', ['aktif', 'Aktif', 'AKTIF']], ['pembaca_meter', 'Ani']])
  }
})
