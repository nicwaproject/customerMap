import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { transformWithOxc } from 'vite'

async function loadComponent(path, replacements, globals) {
  globalThis.__workspaceTest = { React, ...globals }
  let source = await readFile(new URL(path, import.meta.url), 'utf8')
  for (const [before, after] of replacements) source = source.replace(before, after)
  const { code } = await transformWithOxc('const { React } = globalThis.__workspaceTest;\n' + source, path, { jsx: { runtime: 'classic' } })
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${Math.random()}`)
}

const MapView = () => null
const Sidebar = () => null

test('sidebar switches preserve initial markers, then restore independently applied datasets', async () => {
  const { default: Dashboard } = await loadComponent('../src/pages/Dashboard.jsx', [
    ["import { PanelRightClose, PanelRightOpen } from 'lucide-react'", 'const PanelRightClose = () => null; const PanelRightOpen = () => null'],
    ["import MapView from '../components/MapView.jsx'", 'const { MapView } = globalThis.__workspaceTest'],
    ["import Sidebar from '../components/Sidebar.jsx'", 'const { Sidebar } = globalThis.__workspaceTest'],
  ], { MapView, Sidebar })
  const csCustomers = [{ id: 'cs-customer' }]
  const selectedCustomer = csCustomers[0]
  const savedRoute = { stops: [] }
  const myLocation = { location: { latitude: -8.5, longitude: 116.1 } }
  const props = { activeWorkspace: 'cs', myLocation, bacaMeter: { customers: null, appliedFilters: null, route: savedRoute },
    customers: csCustomers, selectedCustomer, selectedCustomerId: selectedCustomer.id,
    results: csCustomers, query: 'customer', fitOnChangeKey: 'unchanged-cs-filter' }
  const mapProps = () => Dashboard(props).props.children.find((child) => child?.type === MapView).props
  const initial = mapProps()
  assert.equal(initial.routeVisible, false)
  assert.equal(initial.route, savedRoute)
  assert.equal(initial.myLocation, myLocation)
  props.activeWorkspace = 'baca-meter'
  let map = mapProps()
  assert.equal(map.routeVisible, true)
  assert.equal(map.route, savedRoute)
  assert.equal(map.myLocation, myLocation)
  assert.equal(map.customers, initial.customers)
  assert.equal(map.datasetKey, initial.datasetKey)
  assert.equal(map.selectedCustomerId, initial.selectedCustomerId)
  assert.equal(map.navigationEnabled, false)
  assert.equal(map.searchQuery, initial.searchQuery, 'switches must not reset navigation history')
  assert.equal(map.selectedCustomer, initial.selectedCustomer)
  props.bacaMeter.date = '2026-10-25'
  props.bacaMeter.meterReader = 'Ani'
  assert.equal(mapProps().customers, csCustomers, 'draft changes must preserve markers')
  const readingCustomers = [{ id: 'reading-customer' }]
  props.bacaMeter.customers = readingCustomers
  props.bacaMeter.appliedFilters = { date: '2026-10-25', meterReader: 'Ani' }
  assert.equal(mapProps().customers, readingCustomers)
  props.activeWorkspace = 'cs'
  assert.equal(mapProps().routeVisible, false)
  assert.equal(mapProps().route, savedRoute)
  assert.equal(mapProps().customers, csCustomers)
  assert.equal(mapProps().selectedCustomer, selectedCustomer)
  props.activeWorkspace = 'baca-meter'
  assert.equal(mapProps().customers, readingCustomers)
  props.bacaMeter.customers = []
  assert.deepEqual(mapProps().customers, [], 'a successfully applied empty result must clear markers')
})

test('both workspaces share the CS options pipeline with no date condition or tab-triggered fetch', async () => {
  const slots = []
  let cursor = 0
  const effects = []
  const hookMocks = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
    useEffect(effect, dependencies) {
      const index = cursor++
      if (!slots[index] || dependencies.some((value, key) => !Object.is(value, slots[index][key]))) {
        effects.push(effect)
        slots[index] = dependencies
      }
    },
    useMemo: (compute) => compute(),
    useCallback: (callback) => callback,
  }
  let optionCalls = 0
  const filters = { customers: null, appliedFilters: null, date: '2026-10-24', meterReader: '' }
  const Dashboard = () => null
  const { default: RootDashboard } = await loadComponent('../src/pages/RootDashboard.jsx', [
    ["import { useCallback, useEffect, useMemo, useState } from 'react'", 'const { useCallback, useEffect, useMemo, useState } = globalThis.__workspaceTest'],
    ["import { supabase } from '../lib/supabase'", 'const supabase = {}'],
    ["import Dashboard from './Dashboard'", 'const { Dashboard } = globalThis.__workspaceTest'],
    ["import { useCustomersByBounds } from '../hooks/useCustomersByBounds'", 'const useCustomersByBounds = () => ({ customers: [{ pembaca_meter: "Zara" }], error: null })'],
    ["import {\n  getMeterReaderOptions,\n  searchCustomers,\n} from '../services/customerService'", 'const { getMeterReaderOptions } = globalThis.__workspaceTest; const searchCustomers = () => { throw new Error("Unexpected search") }'],
    ["import { useMyLocation } from '../hooks/useMyLocation'", 'const useMyLocation = () => ({ requestLocation() {} })'],
    ["import { useBacaMeter } from '../hooks/useBacaMeter'", 'const { useBacaMeter } = globalThis.__workspaceTest'],
    ["import { useDebouncedValue } from '../hooks/useDebouncedValue'", 'const useDebouncedValue = (value) => value'],
  ], { ...hookMocks, Dashboard, useBacaMeter: () => filters,
    getMeterReaderOptions: async (options) => {
      optionCalls++
      assert.equal(options.maxRows, Infinity)
      assert.equal(options.date, undefined)
      const data = ['Budi', 'Ani', 'Ani', '', null]
      options.onPage(data)
      return { data, error: null }
    },
  })
  const render = () => {
    cursor = 0
    const element = RootDashboard()
    while (effects.length) effects.shift()()
    return element.props
  }
  let props = render()
  await Promise.resolve()
  props = render()
  assert.deepEqual(props.bacaMeter.options, ['Ani', 'Budi', 'Zara'])
  assert.equal(props.bacaMeter.options, props.meterReaderOptions)
  assert.equal(props.bacaMeter.optionsLoading, false)
  props.onWorkspaceChange('baca-meter')
  props = render()
  assert.equal(props.activeWorkspace, 'baca-meter')
  assert.equal(props.bacaMeter.options, props.meterReaderOptions)
  props.bacaMeter.date = '2026-10-25'
  props.onWorkspaceChange('cs')
  render()
  assert.equal(optionCalls, 1)
})

test('restoring the CS workspace does not replay search or selected-customer map navigation', async () => {
  const source = await readFile(new URL('../src/components/MapView.jsx', import.meta.url), 'utf8')
  const controllers = source.slice(source.indexOf('function FocusSelectedCustomer('), source.indexOf('function BoundsReporter('))
  const slots = []
  let cursor = 0
  const effects = []
  let flyCalls = 0
  const map = { getZoom: () => 14, flyTo: () => { flyCalls++ }, once() {}, off() {}, closePopup() {} }
  globalThis.__navigationTest = {
    useMap: () => map,
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useMemo: (compute) => compute(),
    useEffect(effect, dependencies) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || dependencies.some((value, key) => !Object.is(value, previous.dependencies[key]))) {
        effects.push(() => {
          previous?.cleanup?.()
          slots[index] = { dependencies, cleanup: effect() }
        })
      }
    },
  }
  const code = `const { useMap, useRef, useMemo, useEffect } = globalThis.__navigationTest;
    const isValidLatLng = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng);
    const getCustomerKey = (customer) => customer.id;
    const window = { setTimeout: () => 1, clearTimeout() {} };
    ${controllers}
    export { FocusSelectedCustomer, SearchNavigationController };`
  const { FocusSelectedCustomer, SearchNavigationController } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const customer = { id: 'cs-customer', latitude: -8.5, longitude: 116.1 }
  const pendingPopupCustomerKeyRef = { current: null }
  const markerRefs = { current: new Map() }
  const results = [customer]
  const onNavigateResult = () => {}
  const render = (enabled) => {
    cursor = 0
    FocusSelectedCustomer({ enabled, selectedCustomer: customer, markerRefs, pendingPopupCustomerKeyRef })
    SearchNavigationController({ enabled, query: 'customer', results, pendingPopupCustomerKeyRef, onNavigateResult })
    while (effects.length) effects.shift()()
  }
  render(true)
  assert.equal(flyCalls, 2)
  render(false)
  render(true)
  assert.equal(flyCalls, 2, 'switching tabs must not call flyTo again')
})
