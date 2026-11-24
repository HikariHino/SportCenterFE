import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot, CoachPlans, MemberPlans, api, plans, calls, failure, release, hold
const descriptors = new Map()
const plan = (id, status = 'Active') => ({ id, planName: `Giáo án ${id}`, status, goal: 'GeneralFitness',
  startDate: '2026-11-01', endDate: '2026-11-30', coachName: 'Coach An', exercises: [
    { id: id * 10, exerciseName: 'Squat', sets: 3, reps: 12, notes: 'Kỹ thuật tốt' },
  ] })

before(async () => {
  window = new Window({ url: 'http://localhost/coach' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, CustomEvent: window.CustomEvent, localStorage: window.localStorage,
    sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  CoachPlans = (await server.ssrLoadModule('/src/pages/Coach/StudentsView.jsx')).TrainingPlanListDialog
  MemberPlans = (await server.ssrLoadModule('/src/pages/member/TrainingPlansView.jsx')).TrainingPlansView
  createRoot = (await import('react-dom/client')).createRoot
})

after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

async function screen(run) {
  plans = [plan(1), plan(2, 'Completed')]; calls = []; failure = ''; hold = false; release = null
  api.defaults.adapter = async config => {
    calls.push(config)
    let data
    if (config.method === 'get') {
      assert.ok(['/members/me', '/TrainingPlans/members/9'].includes(config.url), config.url)
      data = config.url === '/members/me' ? { memberId: 9 } : plans
    } else {
      if (hold) await new Promise(resolve => { release = resolve })
      if (failure) return { config, data: { success: false, message: failure }, status: 200, headers: {} }
      if (config.method === 'delete') {
        assert.equal(config.url, '/TrainingPlans/1')
        plans = plans.filter(item => item.id !== 1)
      } else {
        assert.equal(config.method, 'put')
        assert.equal(config.url, '/TrainingPlans/1/status')
        assert.deepEqual(config.params, { status: 'Completed' })
        plans = plans.map(item => item.id === 1 ? { ...item, status: 'Completed' } : item)
      }
      data = null
    }
    return { config, data: { success: true, data }, status: 200, headers: {} }
  }
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  const render = element => act(async () => root.render(element))
  try { await run(container, render) }
  finally {
    if (release) await act(async () => release())
    await act(async () => root.unmount()); container.remove()
  }
}
const clickText = (container, text) => act(async () => {
  const button = [...container.querySelectorAll('button')].find(node => node.textContent.trim() === text)
  assert.ok(button, text); button.click()
})
const coach = onClose => h(CoachPlans, { student: { memberId: 9, name: 'Học viên An' }, onClose: onClose || (() => {}) })
const writes = () => calls.filter(call => call.method !== 'get')

test('coach deletion requires confirmation, supports cancel, prevents duplicate requests and removes only the deleted plan', () => screen(async (container, render) => {
  let closed = 0
  await render(coach(() => { closed++ }))
  await clickText(container, 'Xóa giáo án')
  assert.match(container.querySelector('.coach-plan-action-confirm').textContent, /Giáo án 1.*Học viên An/)
  assert.equal(writes().length, 0)
  await clickText(container, 'Hủy')
  assert.equal(writes().length, 0)
  assert.equal(container.querySelectorAll('.coach-member-plan').length, 2)
  await clickText(container, 'Xóa giáo án')
  hold = true
  const confirm = [...container.querySelectorAll('button')].find(node => node.textContent === 'Xác nhận xóa')
  await act(async () => { confirm.click(); confirm.click() })
  assert.equal(writes().length, 1)
  assert.ok(container.querySelector('[aria-label="Đóng danh sách giáo án"]').disabled)
  assert.equal(container.querySelectorAll('.coach-member-plan').length, 2, 'keep data until server succeeds')
  await act(async () => release())
  release = null
  assert.equal(container.querySelectorAll('.coach-member-plan').length, 1)
  assert.match(container.querySelector('.coach-member-plan h3').textContent, /Giáo án 2/)
  assert.match(container.querySelector('[role="status"]').textContent, /Đã xóa/)
  assert.equal(closed, 0)
}))

test('server refusal keeps the plan and error visible, and deletion can be retried', () => screen(async (container, render) => {
  await render(coach())
  failure = 'Bạn chỉ có thể cập nhật giáo án do chính mình phụ trách.'
  await clickText(container, 'Xóa giáo án')
  await clickText(container, 'Xác nhận xóa')
  assert.equal(container.querySelectorAll('.coach-member-plan').length, 2)
  assert.match(container.querySelector('[role="alert"]').textContent, /chính mình phụ trách/)
  failure = ''
  await clickText(container, 'Xác nhận xóa')
  assert.equal(container.querySelectorAll('.coach-member-plan').length, 1)
}))

test('completed status is saved before moving the plan into member history with exercises and notes', () => screen(async (container, render) => {
  await render(coach())
  await clickText(container, 'Đánh dấu hoàn thành')
  assert.equal(writes().length, 0)
  await clickText(container, 'Xác nhận hoàn thành')
  assert.equal(writes().length, 1)
  assert.match(container.querySelector('.coach-member-plan b').textContent, /Đã hoàn thành/)
  assert.ok(![...container.querySelectorAll('button')].some(node => node.textContent.includes('Đánh dấu hoàn thành')))
  await render(h(MemberPlans, { completedOnly: true }))
  assert.equal(container.querySelectorAll('.training-plans-card').length, 2)
  assert.match(container.textContent, /Lịch sử giáo án đã hoàn thành/)
  assert.match(container.textContent, /Squat/)
  assert.match(container.textContent, /Kỹ thuật tốt/)
  assert.equal(container.querySelector('.coach-member-plan-actions'), null)
  await render(h(MemberPlans))
  assert.equal(container.querySelector('.training-plans-card'), null)
}))

test('member history includes only completed status, keeps pagination and never infers completion from an end date', () => screen(async (container, render) => {
  plans = [plan(1), plan(2, 'Expired'), plan(3, 'Cancelled'), ...Array.from({ length: 11 }, (_, i) => plan(i + 4, i === 0 ? 'completed' : 'Completed'))]
  await render(h(MemberPlans, { completedOnly: true }))
  assert.equal(container.querySelectorAll('.training-plans-card').length, 10)
  assert.match(container.querySelector('.training-plans-count').textContent, /11 giáo án/)
  await act(async () => container.querySelector('[aria-label="Trang sau: Giáo án đã hoàn thành"]').click())
  assert.equal(container.querySelectorAll('.training-plans-card').length, 1)
  await render(h(MemberPlans))
  assert.equal(container.querySelectorAll('.training-plans-card').length, 3)
  assert.equal(writes().length, 0)
}))

test('empty completed history shows a clear message', () => screen(async (container, render) => {
  plans = [plan(1)]
  await render(h(MemberPlans, { completedOnly: true }))
  assert.match(container.textContent, /Chưa có giáo án đã hoàn thành/)
  assert.equal(container.querySelector('.training-plans-card'), null)
}))
