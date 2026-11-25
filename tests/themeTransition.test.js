import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createThemeTransition } from '../src/utils/themeTransition.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}
const tick = () => new Promise(resolve => setImmediate(resolve))

function environment() {
  const classes = new Set(), requests = [], listeners = new Set()
  const root = { dataset: { theme: 'light' }, style: { colorScheme: 'light' }, classList: {
    add: name => classes.add(name), remove: name => classes.delete(name),
  } }
  const media = { matches: false, addEventListener: (_, listener) => listeners.add(listener), removeEventListener: (_, listener) => listeners.delete(listener) }
  const doc = { documentElement: root, visibilityState: 'visible', getAnimations: () => [],
    startViewTransition(callback) {
      const ready = deferred(), finished = deferred()
      const request = { ready: ready.promise, finished: finished.promise, skipped: false,
        commit() { callback(); ready.resolve() }, finish: () => finished.resolve(), fail: () => { ready.reject(new Error('Snapshot unavailable')); finished.resolve() },
        skipTransition() { this.skipped = true; ready.reject(new Error('Skipped')); finished.resolve() },
      }
      requests.push(request)
      return request
    },
  }
  return { root, media, doc, requests, classes, listeners, controller: createThemeTransition(doc, media) }
}

test('initial theme and unsupported browsers apply immediately without a transition or stranded class', () => {
  const state = environment()
  state.controller.apply('dark', { animate: false })
  assert.equal(state.root.dataset.theme, 'dark')
  assert.equal(state.requests.length, 0)
  delete state.doc.startViewTransition
  state.controller.apply('light')
  assert.equal(state.root.style.colorScheme, 'light')
  assert.equal(state.classes.size, 0)
  state.controller.dispose()
})

test('both directions keep the current palette until the snapshot callback and clean up after the fade', async () => {
  const state = environment()
  for (const theme of ['dark', 'light']) {
    const previous = state.root.dataset.theme
    state.controller.apply(theme)
    assert.equal(state.root.dataset.theme, previous)
    assert.ok(state.classes.has('theme-transitioning'))
    const request = state.requests.at(-1)
    request.commit()
    assert.equal(state.root.dataset.theme, theme)
    assert.equal(state.root.style.colorScheme, theme)
    request.finish(); await tick()
    assert.equal(state.classes.size, 0)
  }
  state.controller.dispose()
})

test('rapid toggles discard queued callbacks and old completion cannot clear a newer animation', async () => {
  const state = environment()
  state.controller.apply('dark')
  const first = state.requests[0]
  state.controller.apply('light')
  assert.equal(first.skipped, true)
  state.controller.apply('dark')
  const latest = state.requests.at(-1)
  first.commit(); first.finish(); await tick()
  assert.equal(state.root.dataset.theme, 'light')
  assert.ok(state.classes.has('theme-transitioning'))
  latest.commit(); latest.finish(); await tick()
  assert.equal(state.root.dataset.theme, 'dark')
  assert.equal(state.classes.size, 0)
  state.controller.dispose()
})

test('snapshot failures and synchronous API errors still apply the requested theme', async () => {
  const state = environment()
  state.controller.apply('dark')
  state.requests[0].fail(); await tick()
  assert.equal(state.root.dataset.theme, 'dark')
  assert.equal(state.classes.size, 0)
  state.doc.startViewTransition = () => { throw new Error('Not available') }
  state.controller.apply('light')
  assert.equal(state.root.dataset.theme, 'light')
  assert.equal(state.classes.size, 0)
  state.controller.dispose()
})

test('reduced motion, hidden tabs and disposal bypass or finish any pending animation', async () => {
  const state = environment()
  state.media.matches = true
  state.controller.apply('dark')
  state.media.matches = false; state.doc.visibilityState = 'hidden'
  state.controller.apply('light')
  assert.equal(state.requests.length, 0)
  state.doc.visibilityState = 'visible'
  state.controller.apply('dark')
  for (const listener of state.listeners) listener({ matches: true })
  assert.equal(state.requests[0].skipped, true)
  assert.equal(state.root.dataset.theme, 'dark')
  assert.equal(state.classes.size, 0)
  state.controller.apply('light')
  state.controller.dispose()
  state.requests.at(-1).commit(); await tick()
  assert.equal(state.root.dataset.theme, 'light')
  assert.equal(state.listeners.size, 0)
  assert.equal(state.classes.size, 0)
})

test('palette transitions finish for the snapshot while transforms and page animations keep running', () => {
  const state = environment(), finished = []
  state.doc.getAnimations = () => ['background-color', 'border-top-color', 'color', 'transform', 'opacity', ''].map(property => ({
    transitionProperty: property, finish: () => finished.push(property),
  }))
  state.controller.apply('dark'); state.requests[0].commit()
  assert.deepEqual(finished, ['background-color', 'border-top-color', 'color'])
  state.controller.dispose()
})
