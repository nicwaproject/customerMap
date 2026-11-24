import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function locationHarness(geolocation, secure = true) {
  const slots = []
  const cleanups = []
  let cursor = 0
  let writes = 0
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: secure } })
  globalThis.__locationHooks = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], (value) => { slots[index] = value; writes++ }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(effect) {
      const index = cursor++
      if (!(index in slots)) {
        slots[index] = true
        cleanups.push(effect())
      }
    },
  }
  const source = (await readFile(new URL('../src/hooks/useMyLocation.js', import.meta.url), 'utf8'))
    .replace("import { useEffect, useRef, useState } from 'react'", 'const { useEffect, useRef, useState } = globalThis.__locationHooks')
  const { useMyLocation } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Math.random()}`)
  return {
    render() { cursor = 0; return useMyLocation() },
    unmount() { cleanups.forEach((cleanup) => cleanup?.()) },
    writes: () => writes,
    restore() {
      if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor)
      else delete globalThis.navigator
      if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor)
      else delete globalThis.window
    },
  }
}

function fakeGPS() {
  const requests = []
  return { requests, getCurrentPosition(success, failure, options) { requests.push({ success, failure, options }) } }
}

const coords = { latitude: -8.577, longitude: 116.105, accuracy: 25 }

test('GPS is requested only by click, with high accuracy; refresh replaces the saved position', async () => {
  const gps = fakeGPS()
  const harness = await locationHarness(gps)
  try {
    let state = harness.render()
    assert.equal(gps.requests.length, 0)
    assert.equal(state.location, null)
    const firstRequest = state.requestLocation()
    const sharedRequest = state.requestLocation()
    assert.equal(firstRequest, sharedRequest, 'map and routing share an in-flight location request')
    assert.equal(gps.requests.length, 1, 'prevent duplicate pending requests')
    assert.deepEqual(gps.requests[0].options, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
    assert.equal(harness.render().loading, true)
    gps.requests[0].success({ coords })
    assert.deepEqual(await firstRequest, coords)
    state = harness.render()
    assert.deepEqual(state.location, coords)
    assert.equal(state.loading, false)
    const previous = state.location
    assert.equal(harness.render().location, previous, 'ordinary rerenders preserve location')
    state.requestLocation()
    const refreshed = { ...coords, latitude: -8.58, accuracy: 10 }
    gps.requests[1].success({ coords: refreshed })
    state = harness.render()
    assert.deepEqual(state.location, refreshed)
    assert.notEqual(state.location, previous)
    assert.equal(gps.requests.length, 2)
  } finally { harness.restore() }
})

test('permission, unavailable, timeout and unexpected errors preserve the previous location and allow retry', async () => {
  const gps = fakeGPS()
  const harness = await locationHarness(gps)
  try {
    harness.render().requestLocation()
    gps.requests[0].success({ coords })
    for (const [code, message] of [[1, /Izin lokasi ditolak/], [2, /Lokasi belum tersedia/], [3, /terlalu lama/], [99, /Gagal mendapatkan lokasi/]]) {
      harness.render().requestLocation()
      gps.requests.at(-1).failure({ code })
      const state = harness.render()
      assert.equal(state.loading, false)
      assert.match(state.error, message)
      assert.deepEqual(state.location, coords)
    }
  } finally { harness.restore() }
})

test('insecure origins and unsupported browsers fail before requesting permission', async () => {
  const gps = fakeGPS()
  let harness = await locationHarness(gps, false)
  try {
    harness.render().requestLocation()
    assert.match(harness.render().error, /HTTPS atau localhost/)
    assert.equal(gps.requests.length, 0)
  } finally { harness.restore() }
  harness = await locationHarness(undefined)
  try {
    harness.render().requestLocation()
    assert.match(harness.render().error, /tidak mendukung/)
    assert.equal(harness.render().loading, false)
  } finally { harness.restore() }
})

test('synchronous GPS errors and malformed coordinates are handled', async () => {
  let harness = await locationHarness({ getCurrentPosition() { throw new Error('GPS failed') } })
  try {
    harness.render().requestLocation()
    assert.equal(harness.render().loading, false)
    assert.match(harness.render().error, /Gagal mendapatkan lokasi/)
  } finally { harness.restore() }
  const gps = fakeGPS()
  harness = await locationHarness(gps)
  try {
    harness.render().requestLocation()
    gps.requests[0].success({ coords: { ...coords, latitude: NaN } })
    assert.equal(harness.render().location, null)
    assert.match(harness.render().error, /Lokasi belum tersedia/)
  } finally { harness.restore() }
})

test('late GPS callbacks after unmount do not change state', async () => {
  const gps = fakeGPS()
  const harness = await locationHarness(gps)
  try {
    harness.render().requestLocation()
    harness.unmount()
    const writes = harness.writes()
    gps.requests[0].success({ coords })
    gps.requests[0].failure({ code: 3 })
    assert.equal(harness.writes(), writes)
  } finally { harness.restore() }
})

test('location recenter bounds are not reported, including when workspace callbacks change', async () => {
  const source = await readFile(new URL('../src/components/MapView.jsx', import.meta.url), 'utf8')
  const controller = source.slice(source.indexOf('function BoundsReporter('), source.indexOf('function ClickNearestController('))
  const slots = []
  let cursor = 0
  const effects = []
  let events
  let latitude = -8.577
  let zoom = 14
  const map = {
    getBounds: () => ({ getSouth: () => latitude, getNorth: () => latitude + 1, getWest: () => 116, getEast: () => 117 }),
    getZoom: () => zoom,
    on() {}, off() {},
  }
  globalThis.__boundsHooks = {
    useMap: () => map,
    useMapEvents: (handlers) => { events = handlers },
    useCallback: (callback) => callback,
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect: (effect) => { effects.push(effect) },
  }
  const code = `const { useMap, useMapEvents, useCallback, useRef, useEffect } = globalThis.__boundsHooks; ${controller}; export { BoundsReporter };`
  const { BoundsReporter } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const reports = []
  const suppressedRef = { current: false }
  const render = () => {
    cursor = 0
    BoundsReporter({ suppressedRef, onChange: (...args) => reports.push(args) })
    while (effects.length) effects.shift()()
  }
  render()
  assert.equal(reports.length, 1)
  suppressedRef.current = true
  latitude = -9
  zoom = 17
  events.zoomend()
  events.moveend()
  suppressedRef.current = false
  render()
  assert.equal(reports.length, 1, 'GPS bounds must not be sent on recenter or tab switches')
  latitude = -9.1
  events.moveend()
  assert.equal(reports.length, 2, 'normal user map movement still reports bounds')
})

test('the shared Leaflet control updates one dot/circle, preserves layers on rerender, and cleans up', async () => {
  const { default: React } = await import('react')
  const { transformWithOxc } = await import('vite')
  const components = Object.fromEntries(['Circle', 'CircleMarker', 'Pane', 'Tooltip', 'Crosshair', 'LoaderCircle'].map((name) => [name, () => null]))
  const slots = []
  const pendingEffects = []
  let cursor = 0
  let additions = 0
  let removals = 0
  let detached = 0
  let clicks = 0
  const moves = []
  const suppressedRef = { current: false }
  const state = { location: null, error: null, loading: false, requestLocation: () => { clicks++ } }
  const map = { stop() {}, setView(center, zoom, options) {
    assert.equal(suppressedRef.current, true, 'GPS recenter must suppress customer requests')
    moves.push({ center, zoom, options })
  } }
  globalThis.__locationControlTest = {
    React, ...components,
    useMyLocation: () => state,
    useMap: () => map,
    createPortal: (children, container) => React.createElement('portal', { container }, children),
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index]]
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
    L: {
      DomUtil: { create: () => ({}) },
      DomEvent: { disableClickPropagation() {}, disableScrollPropagation() {}, off() { detached++ } },
      control(options) {
        assert.equal(options.position, 'bottomleft')
        return { addTo() { additions++ }, remove() { removals++ } }
      },
    },
  }
  const source = (await readFile(new URL('../src/components/MyLocationControl.jsx', import.meta.url), 'utf8'))
    .replace(/^import .*\n/gm, '')
  const globals = 'const { React, useState, useEffect, createPortal, Circle, CircleMarker, Pane, Tooltip, useMap, Crosshair, LoaderCircle, L, useMyLocation } = globalThis.__locationControlTest;\n'
  const { code } = await transformWithOxc(globals + source, 'MyLocationControl.jsx', { jsx: { runtime: 'classic' } })
  const { default: MyLocationControl } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const render = () => {
    cursor = 0
    const element = MyLocationControl({ boundsReportSuppressedRef: suppressedRef, myLocation: state })
    while (pendingEffects.length) pendingEffects.shift()()
    return element
  }
  let element = render()
  assert.equal(additions, 1)
  assert.equal(moves.length, 0)
  let portal = element.props.children[0]
  const container = portal.props.container
  let button = portal.props.children.props.children[0]
  assert.equal(button.props.title, 'Lokasi Saya')
  assert.equal(button.props['aria-label'], 'Lokasi Saya')
  button.props.onClick()
  assert.equal(clicks, 1)
  state.loading = true
  button = render().props.children[0].props.children.props.children[0]
  assert.equal(button.props.disabled, true)
  assert.equal(button.props.children.type, components.LoaderCircle)
  state.loading = false
  state.location = coords
  element = render()
  assert.deepEqual(moves, [{ center: [coords.latitude, coords.longitude], zoom: 17, options: { animate: false } }])
  assert.equal(suppressedRef.current, false)
  let pane = element.props.children[1]
  assert.equal(pane.type, components.Pane)
  const [circle, marker] = pane.props.children
  assert.equal(circle.type, components.Circle)
  assert.equal(circle.props.radius, 25)
  assert.equal(circle.props.interactive, false)
  assert.equal(marker.type, components.CircleMarker)
  assert.equal(marker.props.pathOptions.fillColor, '#2563eb')
  assert.equal(marker.props.children.props.children, 'Lokasi Saya')
  render()
  assert.equal(moves.length, 1, 'ordinary workspace/data rerenders must not recenter')
  state.location = { ...coords, latitude: -8.6, accuracy: 12 }
  element = render()
  pane = element.props.children[1]
  assert.equal(pane.props.children.length, 2, 'refresh retains one accuracy circle and one dot')
  assert.equal(pane.props.children[0].props.radius, 12)
  assert.deepEqual(pane.props.children[1].props.center, [-8.6, coords.longitude])
  assert.equal(moves.length, 2)
  assert.equal(additions, 1, 'do not duplicate Leaflet controls')
  assert.equal(element.props.children[0].props.container, container)
  state.error = 'Lokasi belum tersedia.'
  portal = render().props.children[0]
  assert.equal(portal.props.children.props.children[2].props.role, 'alert')
  assert.equal(render().props.children[1].type, components.Pane, 'errors must retain the last location layers')
  for (const slot of slots) slot?.cleanup?.()
  assert.equal(removals, 1)
  assert.equal(detached, 1)
})
