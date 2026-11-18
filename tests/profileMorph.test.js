import assert from 'node:assert/strict'
import { test } from 'node:test'
import { playProfileMorph } from '../src/utils/profileMorph.js'

function fixture({ reduced = false, height = 720 } = {}) {
  const calls = [], listeners = new Set()
  const media = {
    matches: reduced,
    addEventListener(type, callback) { assert.equal(type, 'change'); listeners.add(callback) },
    removeEventListener(type, callback) { listeners.delete(callback) },
  }
  const element = () => ({
    animate(frames, options) {
      let resolve, reject
      const finished = new Promise((yes, no) => { resolve = yes; reject = no })
      const call = { element: this, frames, options, cancelCount: 0, finish: resolve }
      calls.push(call)
      return { finished, cancel() { call.cancelCount++; reject(new Error('Cancelled')) } }
    },
  })
  const children = Array.from({ length: 4 }, element)
  const panel = { ...element(), style: { overflow: 'visible' }, children, getBoundingClientRect: () => ({ height }) }
  const matchMedia = query => { assert.equal(query, '(prefers-reduced-motion: reduce)'); return media }
  return { calls, listeners, media, panel, matchMedia }
}
const settled = () => new Promise(resolve => setImmediate(resolve))

test('profile morph expands the card and fades new content without changing form elements', async () => {
  const { calls, listeners, panel, matchMedia } = fixture()
  const fields = { fullName: 'Tên đã nhập', email: 'new@example.com' }
  panel.children[1].draft = fields
  playProfileMorph(panel, 300, { matchMedia })
  assert.deepEqual(calls[0].frames, [{ height: '300px' }, { height: '720px' }])
  assert.equal(calls[0].options.duration, 360)
  assert.equal(calls[0].frames[0].transform, undefined)
  assert.equal(calls.length, 4)
  assert.ok(calls.slice(1).every(call => call.options.duration + call.options.delay <= 360))
  assert.equal(calls.some(call => call.element === panel.children[0]), false, 'the edit/cancel header remains available')
  assert.equal(panel.style.overflow, 'hidden')
  assert.equal(panel.children[1].draft, fields)
  calls.forEach(call => call.finish())
  await settled()
  assert.deepEqual(panel.style, { overflow: 'visible' })
  assert.equal(listeners.size, 0)
})

test('cancel/save morphs back from the visible height and releases effects on rapid toggles', async () => {
  const { calls, panel, matchMedia, listeners } = fixture({ height: 300 })
  const dispose = playProfileMorph(panel, 720, { matchMedia })
  assert.deepEqual(calls[0].frames, [{ height: '720px' }, { height: '300px' }])
  dispose(); dispose()
  await settled()
  assert.ok(calls.every(call => call.cancelCount === 1))
  assert.equal(panel.style.overflow, 'visible')
  assert.equal(listeners.size, 0)
  const before = calls.length
  const cancelNext = playProfileMorph(panel, 460, { matchMedia })
  assert.deepEqual(calls[before].frames, [{ height: '460px' }, { height: '300px' }])
  cancelNext()
  await settled()
  assert.equal(panel.style.overflow, 'visible')
})

test('reduced motion skips transitions and cancels an active morph immediately when enabled', async () => {
  const reduced = fixture({ reduced: true })
  playProfileMorph(reduced.panel, 300, { matchMedia: reduced.matchMedia })()
  assert.equal(reduced.calls.length, 0)
  assert.equal(reduced.listeners.size, 0)
  const running = fixture()
  playProfileMorph(running.panel, 300, { matchMedia: running.matchMedia })
  running.listeners.forEach(callback => callback({ matches: true }))
  await settled()
  assert.ok(running.calls.every(call => call.cancelCount === 1))
  assert.equal(running.panel.style.overflow, 'visible')
  assert.equal(running.listeners.size, 0)
})

test('hidden, unmeasured and unsupported panels remain visible without animation side effects', () => {
  for (const height of [0, NaN, undefined]) {
    const current = fixture()
    playProfileMorph(current.panel, height, { matchMedia: current.matchMedia })()
    assert.equal(current.calls.length, 0)
    assert.equal(current.panel.style.overflow, 'visible')
  }
  assert.doesNotThrow(() => playProfileMorph(null, 300)())
  assert.doesNotThrow(() => playProfileMorph({}, 300)())
})

test('an unavailable effect restores styles and handles cancelled animation promises', async () => {
  const { panel, calls, matchMedia, listeners } = fixture()
  panel.children[1].animate = () => { throw new Error('Animation unavailable') }
  assert.doesNotThrow(() => playProfileMorph(panel, 300, { matchMedia })())
  await settled()
  assert.equal(panel.style.overflow, 'visible')
  assert.equal(listeners.size, 0)
  assert.equal(calls[0].cancelCount, 1)
})
