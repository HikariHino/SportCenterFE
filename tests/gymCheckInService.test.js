import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, service, attendance, Table, Status, Dates
const descriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/gymCheckInService.js')
  attendance = await server.ssrLoadModule('/src/services/receptionistAttendanceService.js')
  Table = (await server.ssrLoadModule('/src/pages/CenterManager/FrontDeskGymHistory.jsx')).GymHistoryTable
  const controls = await server.ssrLoadModule('/src/components/GymHistoryControls.jsx')
  Status = controls.GymCheckInStatus; Dates = controls.GymDateRangeFields
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
const row = { id: 10, memberId: 2, memberName: 'Nguyễn An', checkInTime: '2026-10-30T18:00:00Z', checkOutTime: null, status: 'InGym', durationMinutes: 20 }
const range = { fromDate: '2026-10-31', toDate: '2026-10-31' }
function mock(payload) {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push(config)
    return { config, status: 200, headers: {}, data: typeof payload === 'function' ? payload(config) : payload }
  }
  return calls
}

test('Member history sends only date filters to the own-history endpoint and trims the covered UTC days', async () => {
  const signal = new AbortController().signal
  const calls = mock({ data: [row, { ...row, id: 11, checkInTime: '2026-10-31T18:00:00Z' }] })
  const result = await service.getMyGymCheckInHistory({ ...range, memberId: 999, status: 'InGym', search: 'another member' }, { signal })
  assert.deepEqual(result.map(item => item.id), [10])
  assert.equal(calls[0].url, '/GymCheckIns/my-history')
  assert.deepEqual(calls[0].params, { fromDate: '2026-10-30', toDate: '2026-10-31' })
  assert.equal(calls[0].signal, signal)
})

test('CenterManager history uses the existing history endpoint with member, search and status filters', async () => {
  const calls = mock([row])
  assert.equal((await service.getGymCheckInHistory({ ...range, memberId: '2', search: '  Nguyễn An  ', status: 'ForgotCheckOut' })).length, 1)
  assert.equal(calls[0].url, '/GymCheckIns/history')
  assert.deepEqual(calls[0].params, { fromDate: '2026-10-30', toDate: '2026-10-31', memberId: 2, search: 'Nguyễn An', status: 'ForgotCheckOut' })
})

test('summary reconciles the summary API with exact Vietnam-date records instead of counting extra UTC visits', async () => {
  const calls = mock(config => config.url.endsWith('/summary-by-member')
    ? [{ memberId: 2, totalCheckIns: 3, totalDurationMinutes: 60, lastCheckInTime: '2026-10-31T18:00:00Z' }]
    : [row, { ...row, id: 11, checkInTime: '2026-10-31T18:00:00Z' }])
  const result = await service.getGymCheckInSummaryByMember(range)
  assert.equal(result[0].totalCheckIns, 1)
  assert.equal(result[0].totalDurationMinutes, 20)
  assert.equal(result[0].lastCheckInTime, row.checkInTime)
  assert.deepEqual(calls.map(call => call.url).sort(), ['/GymCheckIns/history', '/GymCheckIns/summary-by-member'])
})

test('all-time summary uses the server totals without another history request', async () => {
  const expected = [{ memberId: 2, totalCheckIns: 4, totalDurationMinutes: 200, lastCheckInTime: row.checkInTime }]
  const calls = mock({ success: true, data: expected })
  assert.deepEqual(await service.getGymCheckInSummaryByMember({ search: ' An ' }), expected)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].params.search, 'An')
})

test('invalid ranges, member IDs and statuses do not request history; failed and malformed responses do not show empty success', async () => {
  let calls = mock([])
  for (const filters of [{ fromDate: '2026-99-01' }, { fromDate: '2026-11-02', toDate: '2026-11-01' }, { memberId: -1 }, { status: 'Invalid' }]) {
    await assert.rejects(service.getGymCheckInHistory(filters))
  }
  assert.equal(calls.length, 0)
  for (const body of [{ success: false, message: 'Server rejected history' }, { statusCode: 403 }, {}, [null], [{ ...row, checkInTime: 'invalid' }]]) {
    calls = mock(body)
    await assert.rejects(service.getGymCheckInHistory())
    await assert.rejects(service.getMyGymCheckInHistory())
  }
})

test('history table distinguishes forgotten checkout and only offers checkout for live visits', () => {
  const html = renderToStaticMarkup(createElement(Table, { items: [row,
    { ...row, id: 11, status: 'ForgotCheckOut' }, { ...row, id: 12, status: 'CheckedOut', checkOutTime: '2026-10-30T19:00:00Z' }], onCheckOut() {} }))
  assert.match(html, /Quên check-out/)
  assert.match(html, /Đã ra về/)
  assert.match(html, /data-checkout-id="10"/)
  assert.doesNotMatch(html, /data-checkout-id="11"|data-checkout-id="12"/)
  assert.match(renderToStaticMarkup(createElement(Status, { item: { ...row, status: 'ForgotCheckOut' } })), /data-status="ForgotCheckOut"/)
})

test('date controls expose labeled range inputs and day presets for both roles', () => {
  const html = renderToStaticMarkup(createElement(Dates, { value: range, onChange() {}, onPreset() {} }))
  assert.equal((html.match(/type="date"/g) || []).length, 2)
  for (const text of ['Từ ngày', 'Đến ngày', 'Hôm nay', '7 ngày', 'Tất cả']) assert.ok(html.includes(text))
})

test('staff attendance posts to Attendances/mark and verifies the saved member and session', async () => {
  const calls = mock({ id: 1, memberId: 2, sessionId: 5, status: 'Present' })
  await attendance.markReceptionistAttendance({ memberId: 2, sessionId: 5, status: 'Present' })
  assert.equal(calls[0].url, '/Attendances/mark')
  assert.deepEqual(JSON.parse(calls[0].data), { memberId: 2, sessionId: 5, status: 'Present' })
  mock({ id: 1, memberId: 999, sessionId: 5, status: 'Present' })
  await assert.rejects(attendance.markReceptionistAttendance({ memberId: 2, sessionId: 5, status: 'Present' }), /đúng học viên/)
})

test('aborted history reads never call the adapter and staff API failures never report saved attendance', async () => {
  const calls = mock([])
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(service.getGymCheckInHistory(range, { signal: controller.signal }))
  assert.equal(calls.length, 0)
  for (const body of [{ success: false, message: 'Chưa đến thời gian điểm danh' }, { statusCode: 409 },
    { memberId: 2, sessionId: 999, status: 'Present' }, { memberId: 2, sessionId: 5, status: 'Absent' }, null]) {
    mock(body)
    await assert.rejects(attendance.markReceptionistAttendance({ memberId: 2, sessionId: 5, status: 'Present' }))
  }
})

test('an older deployed BE without history routes shows an explicit unavailable error instead of an empty history', async () => {
  api.defaults.adapter = async config => {
    const error = new Error('Not found')
    error.config = config
    error.response = { status: 404, data: {} }
    throw error
  }
  for (const request of [() => service.getGymCheckInHistory(range), () => service.getGymCheckInSummaryByMember(range)]) {
    await assert.rejects(request(), error => error.code === 'GYM_HISTORY_UNAVAILABLE' && /chưa được cập nhật/.test(error.message))
  }
})
