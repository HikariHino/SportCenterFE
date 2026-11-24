import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, api, quality
const descriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  quality = (await server.ssrLoadModule('/src/services/coachSessionQualityService.js')).getCoachSessionQuality
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function mock({ repeat = false, failLast = false, malformed = false } = {}) {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push(config)
    const page = config.params.page
    let data
    if (config.url === '/class-sessions') {
      assert.equal(config.params.coachId, 1)
      data = { items: [{ id: repeat ? 10 : page === 1 ? 10 : 11, coachId: 1 }], total: 2, page }
    } else if (config.url === '/class-sessions/10/reviews') {
      if (page === 2 && failLast) throw new Error('Không tải được trang cuối')
      data = { items: page === 1 ? [{ id: 101, rating: malformed ? 8 : 5 }, { id: 102, rating: 5 }] : [{ id: 103, rating: 5 }], total: 3, page }
    } else {
      assert.equal(config.url, '/class-sessions/11/reviews')
      data = { items: [{ id: 104, rating: 1 }], total: 1, page }
    }
    return { data: { success: true, data }, status: 200, headers: {}, config }
  }
  return calls
}

test('session quality includes all pages and weights each individual review, not session averages', async () => {
  const calls = mock(), controller = new AbortController()
  assert.deepEqual(await quality(1, { signal: controller.signal }), { averageRating: 4, reviewCount: 4 })
  assert.deepEqual(calls.filter(call => call.url === '/class-sessions').map(call => call.params.page), [1, 2])
  assert.deepEqual(calls.filter(call => call.url === '/class-sessions/10/reviews').map(call => call.params.page), [1, 2])
  assert.ok(calls.every(call => call.signal === controller.signal))
})

test('partial reads, repeated pages and invalid stars do not report an incomplete average', async () => {
  for (const options of [{ repeat: true }, { failLast: true }, { malformed: true }]) {
    mock(options)
    await assert.rejects(quality(1))
  }
})

test('session assignment determines whose quality score receives the review, even if a server ignores the coach filter', async () => {
  api.defaults.adapter = async config => {
    let data = { items: [{ id: 10, coachId: 1 }, { id: 11, coachId: 2 }], total: 2, page: 1 }
    if (config.url !== '/class-sessions') {
      assert.equal(config.url, '/class-sessions/10/reviews')
      data = { items: [{ id: 101, rating: 5 }], total: 1, page: 1 }
    }
    return { data: { success: true, data }, status: 200, headers: {}, config }
  }
  assert.deepEqual(await quality(1), { averageRating: 5, reviewCount: 1 })
})
