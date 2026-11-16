import assert from 'node:assert/strict'
import { test } from 'node:test'
import { attachSlidingPill } from '../src/utils/slidingPill.js'

function fixture() {
  let active = { offsetLeft: 0, offsetTop: 70, offsetWidth: 215, offsetHeight: 40 }
  const container = { dataset: {}, querySelector(selector) { assert.equal(selector, 'button[aria-pressed="true"]'); return active } }
  const pill = { style: { removeProperty(key) { delete this[key] } } }
  let frameId = 0, disconnected = 0, resized
  const frames = new Map(), events = new Map()
  class Observer {
    constructor(callback) { resized = callback }
    observe(target) { assert.equal(target, container) }
    disconnect() { disconnected++ }
  }
  const dependencies = {
    Observer,
    viewport: {
      addEventListener(type, callback) { events.set(type, callback) },
      removeEventListener(type, callback) { if (events.get(type) === callback) events.delete(type) },
    },
    requestFrame(callback) { const id = frameId++; frames.set(id, callback); return id },
    cancelFrame(id) { frames.delete(id) },
  }
  const controller = attachSlidingPill(container, pill, dependencies)
  return {
    container, pill, controller, frames, events,
    setActive(value) { active = value },
    resize() { resized() },
    frame() { const [id, callback] = frames.entries().next().value; frames.delete(id); callback() },
    disconnected: () => disconnected,
  }
}

test('first render positions the pill on the restored tab before enabling transitions', () => {
  const f = fixture()
  assert.equal(f.pill.style.transform, 'translate3d(0px, 70px, 0)')
  assert.equal(f.pill.style.width, '215px')
  assert.equal(f.pill.style.height, '40px')
  assert.equal(f.container.dataset.pillReady, 'true')
  assert.equal(f.container.dataset.pillAnimated, undefined)
  f.frame()
  assert.equal(f.container.dataset.pillAnimated, 'true')
  f.controller.dispose()
})

test('rapid tab changes reuse the same pill and always target the latest active button', () => {
  const f = fixture(), pill = f.pill
  f.frame()
  for (const y of [110, 200, 30, 310]) {
    f.setActive({ offsetLeft: 0, offsetTop: y, offsetWidth: 215, offsetHeight: 40 })
    f.controller.update()
    assert.equal(f.pill, pill)
    assert.equal(f.pill.style.transform, `translate3d(0px, ${y}px, 0)`)
    assert.equal(f.container.dataset.pillAnimated, 'true')
  }
  assert.equal(f.frames.size, 0)
  f.controller.dispose()
})

test('font/layout resize and viewport changes keep both position and size aligned', () => {
  const f = fixture()
  f.frame()
  f.setActive({ offsetLeft: 8, offsetTop: 92, offsetWidth: 235, offsetHeight: 55 })
  f.resize()
  assert.equal(f.pill.style.width, '235px')
  assert.equal(f.pill.style.height, '55px')
  assert.equal(f.pill.style.transform, 'translate3d(8px, 92px, 0)')
  f.setActive({ offsetLeft: 0, offsetTop: 45, offsetWidth: 200, offsetHeight: 42 })
  f.events.get('resize')()
  assert.equal(f.pill.style.transform, 'translate3d(0px, 45px, 0)')
  f.controller.dispose()
})

test('a hidden mobile sidebar suspends the pill and reopens at the active position immediately', () => {
  const f = fixture()
  f.setActive({ offsetWidth: 0, offsetHeight: 0 })
  f.resize()
  assert.equal(f.container.dataset.pillReady, undefined)
  assert.equal(f.container.dataset.pillAnimated, undefined)
  assert.equal(f.frames.size, 0)
  f.setActive({ offsetLeft: 0, offsetTop: 182, offsetWidth: 230, offsetHeight: 42 })
  f.controller.update()
  assert.equal(f.container.dataset.pillReady, 'true')
  assert.equal(f.pill.style.transform, 'translate3d(0px, 182px, 0)')
  assert.equal(f.container.dataset.pillAnimated, undefined)
  f.frame()
  assert.equal(f.container.dataset.pillAnimated, 'true')
  f.controller.dispose()
})

test('cleanup cancels the first frame, disconnects resize and ignores late callbacks', () => {
  const f = fixture()
  const lateFrame = f.frames.values().next().value
  const lateResize = f.events.get('resize')
  f.controller.dispose()
  lateFrame()
  lateResize()
  f.resize()
  assert.equal(f.disconnected(), 1)
  assert.equal(f.frames.size, 0)
  assert.equal(f.events.size, 0)
  assert.deepEqual(f.container.dataset, {})
  assert.equal(f.pill.style.transform, undefined)
  assert.equal(f.pill.style.width, undefined)
})
