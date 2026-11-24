import test from 'node:test'
import assert from 'node:assert/strict'
import { elements, hookHarness, loadModule } from './helpers/routeHarness.mjs'

const near = { id: 'near', nama: 'Near', latitude: 0, longitude: 1 }
const far = { id: 'far', nama: 'Far', latitude: 0, longitude: 2 }
const route = { start: { latitude: 0, longitude: 0 }, stops: [
  { customer: near, latitude: 0, longitude: 1, key: 'id:near' },
  { customer: far, latitude: 0, longitude: 2, key: 'id:far' },
], totalDistanceMeters: 222000, invalidCoordinateCount: 1, duplicateCount: 0 }

const button = (tree, text) => elements(tree).find((element) => element.type === 'button' && element.props.children === text)

test('Baca Meter enables Buat Rute after valid results, displays count/summary and wires Hapus Rute', async () => {
  const { default: BacaMeterWorkspace } = await loadModule('src/components/workspaces/BacaMeterWorkspace.jsx', [], {}, true)
  let generated = 0
  let cleared = 0
  const props = { date: '2026-10-15', meterReader: '', options: [], customers: null, appliedFilters: null,
    validCustomerCount: 0, invalidCoordinateCount: 0, routeLoading: false, loading: false,
    generateRoute: () => generated++, clearRoute: () => cleared++, maxRouteCustomers: 5000,
  }
  let tree = BacaMeterWorkspace(props)
  assert.equal(button(tree, 'Buat Rute').props.disabled, true)
  assert.equal(elements(tree).find((element) => element.type === 'option').props.children, 'Semua pembaca')
  props.customers = [near, far, { id: 'bad' }]
  props.appliedFilters = { date: '2026-10-15', meterReader: '' }
  props.validCustomerCount = 2
  props.invalidCoordinateCount = 1
  tree = BacaMeterWorkspace(props)
  assert.equal(button(tree, 'Buat Rute').props.disabled, undefined)
  button(tree, 'Buat Rute').props.onClick()
  assert.equal(generated, 1)
  assert.ok(elements(tree).some((element) => element.props.children === 3), 'filtered customer count is shown')
  props.route = route
  tree = BacaMeterWorkspace(props)
  assert.ok(elements(tree).some((element) => element.props['aria-label'] === 'Rute Baca Meter'))
  assert.ok(elements(tree).some((element) => element.type === 'dd' && element.props.children === 2))
  button(tree, 'Hapus Rute').props.onClick()
  assert.equal(cleared, 1)
  props.routeLimitExceeded = true
  assert.equal(button(BacaMeterWorkspace(props), 'Buat Rute').props.disabled, true)
})

test('route polyline includes GPS origin, fits once, hides on CS and restores without resetting map view', async () => {
  const harness = hookHarness()
  const Polyline = () => null
  const Tooltip = () => null
  const suppressedRef = { current: false }
  const fits = []
  const map = { stop() {}, fitBounds(positions, options) {
    assert.equal(suppressedRef.current, true)
    fits.push({ positions, options })
  } }
  const { default: MeterRouteLayer } = await loadModule('src/components/MeterRouteLayer.jsx', [
    ["import { memo, useEffect, useMemo, useRef } from 'react'", 'const { useEffect, useMemo, useRef } = testGlobals.hooks; const memo = (component) => component'],
    ["import { Polyline, Tooltip, useMap } from 'react-leaflet'", 'const { Polyline, Tooltip, useMap } = testGlobals'],
  ], { hooks: harness.hooks, Polyline, Tooltip, useMap: () => map }, true)
  let activeRoute = null
  let visible = true
  const render = () => harness.render(() => MeterRouteLayer({ route: activeRoute, visible, boundsReportSuppressedRef: suppressedRef }))
  assert.equal(render(), null)
  activeRoute = route
  let tree = render()
  assert.equal(tree.type, Polyline)
  assert.deepEqual(tree.props.positions, [[0, 0], [0, 1], [0, 2]])
  assert.equal(tree.props.pathOptions.color, '#7c3aed')
  assert.equal(fits.length, 1)
  visible = false
  assert.equal(render(), null)
  visible = true
  tree = render()
  assert.deepEqual(tree.props.positions, [[0, 0], [0, 1], [0, 2]])
  assert.equal(fits.length, 1)
  activeRoute = null
  assert.equal(render(), null)
  assert.equal(fits.length, 1)
  visible = false
  activeRoute = { ...route }
  render()
  visible = true
  render()
  assert.equal(fits.length, 1, 'a route completed in the background must not move the map on tab selection')
})

test('MapView reuses clustered customer markers with visit numbering and existing customer popups', async () => {
  const names = ['MapContainer', 'Marker', 'Popup', 'TileLayer', 'Tooltip', 'ZoomControl', 'MarkerClusterGroup',
    'CustomerPopup', 'MyLocationControl', 'MeterRouteLayer']
  const components = Object.fromEntries(names.map((name) => [name, () => null]))
  const hooks = { useMemo: (compute) => compute(), useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: (initial) => ({ current: initial }), useCallback: (callback) => callback, useEffect() {}, memo: (component) => component }
  const imports = `const { useMemo, useState, useRef, useCallback, useEffect, memo,
    MapContainer, Marker, Popup, TileLayer, Tooltip, ZoomControl, MarkerClusterGroup,
    CustomerPopup, MyLocationControl, MeterRouteLayer, L } = testGlobals;
    const getCustomerStatusColor = () => '#00ff00';\n`
  const { default: RenderMap } = await loadModule('src/components/MapView.jsx', [
    [/^import[\s\S]*?from ['"][^'"]+['"]\n|^import ['"][^'"]+['"]\n/gm, ''],
    ['function isValidLatLng(', imports + 'function isValidLatLng('],
  ], { ...hooks, ...components, L: { divIcon: (options) => options, latLng: (...args) => args, latLngBounds: (positions) => positions } }, true)
  const props = { customers: [far, near, { id: 'bad', latitude: null, longitude: null }], route, routeVisible: true, myLocation: { location: route.start } }
  const markers = (tree) => {
    const cluster = elements(tree).find((element) => element.type?.name === 'ClusteredCustomerMarkers')
    return cluster.type(cluster.props).flatMap((group) => group.props.children).filter(Boolean)
  }
  let tree = RenderMap(props)
  let renderedMarkers = markers(tree)
  assert.equal(renderedMarkers.length, 2, 'route mode must not duplicate the normal customer markers')
  assert.deepEqual(renderedMarkers.map((marker) => marker.props.icon.html), [
    '<span class="meter-route-number">1</span>', '<span class="meter-route-number">2</span>',
  ])
  assert.equal(renderedMarkers[0].props.children[0].type, components.Popup)
  assert.equal(renderedMarkers[0].props.children[0].props.children.type, components.CustomerPopup)
  assert.equal(renderedMarkers[0].props.children[0].props.children.props.customer, near)
  assert.equal(elements(tree).find((element) => element.type === components.MyLocationControl).props.myLocation, props.myLocation)
  props.routeVisible = false
  tree = RenderMap(props)
  renderedMarkers = markers(tree)
  assert.ok(renderedMarkers.every((marker) => !marker.props.icon.html.includes('meter-route-number')))
  assert.equal(elements(tree).find((element) => element.type === components.MeterRouteLayer).props.visible, false)
  props.routeVisible = true
  props.route = null
  renderedMarkers = markers(RenderMap(props))
  assert.ok(renderedMarkers.every((marker) => !marker.props.icon.html.includes('meter-route-number')))
})
