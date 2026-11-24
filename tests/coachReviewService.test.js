import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, api, service, registration, reviews, calls, sessionCoach, wrongResponse
const descriptors = new Map()
const valid = { id: 101, memberId: 69, sessionId: 10, status: 'Completed', sessionStatus: 'Completed',
  attendanceStatus: 'Present', endsAt: '2020-01-01T10:00:00Z', hasReviewed: true, review: { rating: 1 } }

before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/coachReviewService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function mock() {
  registration = { ...valid }; reviews = []; calls = []; sessionCoach = 7; wrongResponse = false
  api.defaults.adapter = async config => {
    calls.push({ url: config.url, method: config.method, data: config.data ? JSON.parse(config.data) : null })
    let data
    if (config.url === '/class-registrations/mine') data = { items: [registration], total: 1, page: 1 }
    else if (config.url === '/class-sessions') data = { items: [{ id: 10, coachId: sessionCoach, coachName: 'Coach 7' }], total: 1, page: 1 }
    else {
      assert.match(config.url, /^\/coaches\/[78]\/reviews$/)
      if (config.method === 'get') {
        const page = config.params.page
        data = { coachId: sessionCoach, averageRating: reviews.length ? 4 : null, reviewCount: reviews.length,
          items: reviews.slice(page - 1, page), total: reviews.length, page }
      } else {
        const payload = JSON.parse(config.data)
        data = { id: 50, coachId: wrongResponse ? 99 : sessionCoach, memberId: 69, ...payload }
        reviews = [...reviews.filter(item => item.memberId !== 69), data]
      }
    }
    return { data: { success: true, data }, status: 200, headers: {}, config }
  }
}
const writes = () => calls.filter(item => ['post', 'put'].includes(item.method))

test('POST persists to CoachReviews even when the registration already has a legacy ClassReview; reload and PUT use the same review', async () => {
  mock()
  const saved = await service.saveMemberCoachReview(101, 7, { rating: 5, comment: '  Coach tốt  ' })
  assert.equal(saved.coachId, 7)
  assert.deepEqual(writes(), [{ url: '/coaches/7/reviews', method: 'post', data: { rating: 5, comment: 'Coach tốt' } }])
  assert.equal((await service.loadMemberCoachReview(101)).review.rating, 5)
  await service.saveMemberCoachReview(101, 7, { rating: 3, comment: '' })
  assert.equal(writes()[1].method, 'put')
  assert.equal((await service.loadMemberCoachReview(101)).review.rating, 3)
  assert.equal(reviews.filter(item => item.memberId === 69).length, 1)
  assert.ok(!calls.some(item => /class-registrations\/\d+\/review/.test(item.url)))
})

test('finds the signed-in member on later review pages rather than using another member review', async () => {
  mock()
  reviews = [{ id: 49, coachId: 7, memberId: 88, rating: 1 }, { id: 50, coachId: 7, memberId: 69, rating: 4 }]
  const context = await service.loadMemberCoachReview(101)
  assert.equal(context.review.memberId, 69)
  await service.saveMemberCoachReview(101, 7, { rating: 5 })
  assert.equal(writes()[0].method, 'put')
})

test('attendance and coach changes prevent writes; Present and Late are accepted', async () => {
  for (const attendanceStatus of ['Absent', 'Excused', null]) {
    mock(); registration.attendanceStatus = attendanceStatus
    await assert.rejects(service.saveMemberCoachReview(101, 7, { rating: 5 }))
    assert.equal(writes().length, 0)
  }
  mock(); sessionCoach = 8
  await assert.rejects(service.saveMemberCoachReview(101, 7, { rating: 5 }), /đã thay đổi/)
  assert.equal(writes().length, 0)
  mock(); registration.attendanceStatus = 'Late'
  await service.saveMemberCoachReview(101, 7, { rating: 5 })
  assert.equal(writes().length, 1)
})

test('invalid input and mismatched save responses never report a successfully saved coach review', async () => {
  mock()
  for (const rating of [0, 6, 1.5]) await assert.rejects(service.saveMemberCoachReview(101, 7, { rating }))
  await assert.rejects(service.saveMemberCoachReview(101, 7, { rating: 5, comment: 'a'.repeat(2001) }))
  assert.equal(writes().length, 0)
  wrongResponse = true
  await assert.rejects(service.saveMemberCoachReview(101, 7, { rating: 5 }), /Chưa xác nhận/)
})
