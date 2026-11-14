import assert from 'node:assert/strict'
import { test } from 'node:test'
import { observePageReveals, playPageTransition } from '../src/utils/pageMotion.js'

function fixture({ reduced = false } = {}) {
  const calls = [], listeners = new Set()
  const media = {
    matches: reduced,
    addEventListener(type, listener) { assert.equal(type, 'change'); listeners.add(listener) },
    removeEventListener(type, listener) { listeners.delete(listener) },
  }
  const makeElement = () => ({
    style: {}, hidden: false,
    animate(frames, options) {
      const call = { frames, options, cancelled: 0, element: this }
      calls.push(call)
      return { cancel() { call.cancelled++ } }
    },
  })
  const heading = makeElement()
  const root = { ...makeElement(), querySelector: () => heading }
  const matchMedia = query => { assert.equal(query, '(prefers-reduced-motion: reduce)'); return media }
  return { calls, listeners, media, makeElement, root, heading, matchMedia }
}

test('tab transition animates existing content and heading without moving fixed-dialog ancestors or changing styles', () => {
  const { calls, root, heading, matchMedia } = fixture()
  const state = { draft: 'Unsaved form', messages: ['Keep AI chat history'] }
  root.state = state
  const dispose = playPageTransition(root, { matchMedia })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].element, root)
  assert.equal(calls[1].element, heading)
  for (const frame of calls[0].frames) {
    assert.equal(frame.transform, undefined)
    assert.equal(frame.filter, undefined)
  }
  assert.equal(calls[0].options.fill, 'none')
  assert.ok(calls.every(call => call.options.duration <= 500))
  assert.equal(root.state, state)
  assert.deepEqual(root.style, {})
  assert.equal(root.hidden, false)
  dispose()
  assert.ok(calls.every(call => call.cancelled === 1))
})

test('rapid navigation cancels the previous view animations before playing the new view', () => {
  const { calls, root, matchMedia, listeners } = fixture()
  const leave = playPageTransition(root, { matchMedia })
  leave()
  const leaveNext = playPageTransition(root, { matchMedia })
  assert.deepEqual(calls.map(call => call.cancelled), [1, 1, 0, 0])
  leaveNext()
  assert.equal(listeners.size, 0)
})

test('reduced motion skips page transitions and immediately cancels animations when changed at runtime', () => {
  const reduced = fixture({ reduced: true })
  playPageTransition(reduced.root, { matchMedia: reduced.matchMedia })()
  assert.equal(reduced.calls.length, 0)
  const active = fixture()
  const dispose = playPageTransition(active.root, { matchMedia: active.matchMedia })
  active.media.matches = true
  active.listeners.forEach(listener => listener({ matches: true }))
  assert.ok(active.calls.every(call => call.cancelled === 1))
  dispose()
  assert.ok(active.calls.every(call => call.cancelled === 1))
  assert.equal(active.listeners.size, 0)
})

test('content remains visible when animation or observer APIs are missing or reject an effect', () => {
  assert.doesNotThrow(() => playPageTransition(null)())
  assert.doesNotThrow(() => playPageTransition({})())
  const { root, matchMedia } = fixture()
  root.animate = () => { throw new Error('Animation unavailable') }
  assert.doesNotThrow(() => playPageTransition(root, { matchMedia })())
  assert.doesNotThrow(() => observePageReveals(root, '.section', { Observer: undefined })())
  assert.deepEqual(root.style, {})
})

test('landing sections reveal once on viewport entry and release observers on navigation', () => {
  const { calls, root, matchMedia, makeElement, listeners } = fixture()
  const sections = [makeElement(), makeElement()]
  let onEntries, disconnected = 0
  const observed = [], unobserved = []
  class Observer {
    constructor(callback, options) { onEntries = callback; assert.equal(options.threshold, .08) }
    observe(element) { observed.push(element) }
    unobserve(element) { unobserved.push(element) }
    disconnect() { disconnected++ }
  }
  root.querySelectorAll = selector => { assert.equal(selector, '.section'); return sections }
  const dispose = observePageReveals(root, '.section', { Observer, matchMedia })
  assert.deepEqual(observed, sections)
  assert.equal(calls.length, 0)
  onEntries([{ target: sections[0], isIntersecting: false }])
  assert.equal(calls.length, 0)
  onEntries([{ target: sections[0], isIntersecting: true }])
  onEntries([{ target: sections[0], isIntersecting: true }])
  assert.equal(calls.length, 1)
  assert.deepEqual(unobserved, [sections[0]])
  onEntries([{ target: sections[1], isIntersecting: true }])
  assert.equal(calls.length, 2)
  assert.ok(sections.every(section => !section.hidden && Object.keys(section.style).length === 0))
  dispose()
  assert.equal(disconnected, 1)
  assert.equal(listeners.size, 0)
  assert.ok(calls.every(call => call.cancelled === 1))
})

test('landing reveal respects reduced motion before initialization and while sections are being observed', () => {
  const reduced = fixture({ reduced: true })
  class UnusedObserver { constructor() { assert.fail('Should not observe with reduced motion') } }
  observePageReveals(reduced.root, '.section', { matchMedia: reduced.matchMedia, Observer: UnusedObserver })()
  const active = fixture()
  let onEntries
  const section = active.makeElement()
  active.root.querySelectorAll = () => [section]
  class Observer {
    constructor(callback) { onEntries = callback }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  const dispose = observePageReveals(active.root, '.section', { matchMedia: active.matchMedia, Observer })
  active.media.matches = true
  active.listeners.forEach(listener => listener({ matches: true }))
  onEntries([{ target: section, isIntersecting: true }])
  assert.equal(active.calls.length, 0)
  dispose()
})
