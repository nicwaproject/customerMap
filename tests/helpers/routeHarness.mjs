import { readFile } from 'node:fs/promises'
import React from 'react'
import { transformWithOxc } from 'vite'

export function hookHarness() {
  const slots = []
  const effects = []
  let cursor = 0
  let stateWrites = 0
  const hooks = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], (value) => { stateWrites++; slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
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
        effects.push(() => {
          previous?.cleanup?.()
          slots[index] = { dependencies, cleanup: effect() }
        })
      }
    },
    useMemo(compute, dependencies) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || dependencies.some((value, key) => !Object.is(value, previous.dependencies[key]))) {
        slots[index] = { dependencies, value: compute() }
      }
      return slots[index].value
    },
    useCallback(callback, dependencies) { return hooks.useMemo(() => callback, dependencies) },
  }
  return {
    hooks,
    writes: () => stateWrites,
    render(compute) {
      cursor = 0
      const value = compute()
      while (effects.length) effects.shift()()
      return value
    },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()) },
  }
}

export async function loadModule(path, replacements, bindings, jsx = false) {
  const key = `__routeTest${Math.random().toString(36).slice(2)}`
  globalThis[key] = { React, ...bindings }
  let source = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
  for (const [before, after] of replacements) source = source.replace(before, after)
  source = `const testGlobals = globalThis['${key}']; const { React } = testGlobals;\n` + source
  if (jsx) source = (await transformWithOxc(source, path, { jsx: { runtime: 'classic' } })).code
  try { return await import(`data:text/javascript;base64,${Buffer.from(source + `\n//# sourceURL=${path}`).toString('base64')}`) }
  finally { delete globalThis[key] }
}

export function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

export function elements(element) {
  if (!element || typeof element !== 'object') return []
  const children = [element.props?.children].flat(Infinity)
  return [element, ...children.flatMap(elements)]
}
