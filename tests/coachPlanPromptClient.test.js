import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

let window, server, createRoot, Dialog, requests, failAi, holdAi, pendingAi
const descriptors = new Map()
const student = { memberId: 4, name: 'Nguyễn Văn An', sportName: 'Tennis', className: 'Tennis A' }
const catalog = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, exerciseName: `Exercise ${index + 1}` }))
const recommendation = { goal: 'Tăng sức bền', level: 'Beginner', daysPerWeek: 3,
  sessions: [{ day: 1, title: 'Kỹ thuật', exercises: catalog.map(item => ({ exerciseName: item.exerciseName, sets: 3, reps: 10 })) }], warnings: [] }

before(async () => {
  window = new Window({ url: 'http://localhost:3000/coach' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  const timeout = window.setTimeout.bind(window)
  window.setTimeout = (callback, delay, ...args) => timeout(callback, [500, 650].includes(delay) ? 0 : delay, ...args)
  server = await createServer({ configFile: false, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Dialog = (await server.ssrLoadModule('/src/pages/Coach/StudentsView.jsx')).TrainingPlanDialog
  const api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    const response = data => ({ data: { success: true, data }, status: 200, headers: {}, config })
    if (config.method === 'get') return response(catalog)
    const body = JSON.parse(config.data)
    requests.push({ url: config.url, body, signal: config.signal })
    if (config.url === '/ai/workout-recommendations') {
      if (failAi) throw new Error('AI đang bận')
      if (holdAi) await new Promise(resolve => { pendingAi = resolve })
      return response({ ...recommendation, level: body.level, daysPerWeek: body.daysPerWeek })
    }
    return response({ id: 90, ...body })
  }
  createRoot = (await import('react-dom/client')).createRoot
})

after(async () => {
  await server?.close()
  await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

async function screen(run) {
  requests = []; failAi = false; holdAi = false; pendingAi = null
  const container = document.body.appendChild(document.createElement('div'))
  const root = createRoot(container)
  try {
    await act(async () => root.render(h(Dialog, { student, onClose() {}, onCreated() {} })))
    await run(container)
  } finally {
    if (pendingAi) await act(async () => pendingAi())
    await act(async () => root.unmount())
    container.remove()
  }
}
const click = text => act(async () => {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text)
  assert.ok(button, text)
  button.click()
})
const change = (element, value) => act(async () => {
  const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
  element.dispatchEvent(new window.Event('input', { bubbles: true }))
})
const finishProgress = () => act(async () => { for (let count = 0; count < 10; count++) await new Promise(resolve => setTimeout(resolve, 5)) })

test('AI entry opens a prompt above exercises and keeps the goal editable', () => screen(async container => {
  assert.equal(container.querySelector('.coach-plan-ai-demo'), null)
  assert.equal(container.querySelector('.coach-plan-form-grid select').disabled, false)
  await click('Tạo bài tập bằng AI')
  const prompt = container.querySelector('textarea')
  assert.ok(prompt)
  assert.equal(prompt.maxLength, 400)
  assert.ok(container.querySelector('.coach-plan-ai-demo').compareDocumentPosition(container.querySelector('.coach-plan-exercises')) & window.Node.DOCUMENT_POSITION_FOLLOWING)
  assert.equal(container.querySelector('.coach-plan-form-grid select').disabled, false)
  assert.equal([...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Tạo').disabled, true)
  const options = container.querySelectorAll('.coach-plan-ai-options select')
  assert.equal(options.length, 2)
  assert.equal(options[0].value, 'Beginner')
  assert.equal(options[1].value, '3')
  await act(async () => container.querySelector('[aria-label="Đóng nhập yêu cầu AI"]').click())
  assert.equal(container.querySelector('textarea'), null)
  assert.equal(container.querySelector('.coach-plan-form-grid select').disabled, false)
  assert.equal(requests.length, 0)
}))

test('AI generation sends the prompt and chosen dates, previews and maps every returned exercise before an explicit save', () => screen(async container => {
  const dates = container.querySelectorAll('.coach-plan-form-grid input[type=date]')
  await change(dates[0], '2026-11-18'); await change(dates[1], '2026-12-16')
  await click('Tạo bài tập bằng AI')
  const options = container.querySelectorAll('.coach-plan-ai-options select')
  await act(async () => {
    options[0].value = 'Advanced'; options[0].dispatchEvent(new window.Event('change', { bubbles: true }))
    options[1].value = '7'; options[1].dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  const goal = container.querySelector('.coach-plan-form-grid select')
  await act(async () => { goal.value = 'MuscleGain'; goal.dispatchEvent(new window.Event('change', { bubbles: true })) })
  await change(container.querySelector('textarea'), 'Tăng sức bền và cải thiện kỹ thuật')
  await click('Tạo')
  await finishProgress()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, '/ai/workout-recommendations')
  assert.equal(requests[0].body.level, 'Advanced')
  assert.equal(requests[0].body.daysPerWeek, 7)
  for (const text of ['Tăng sức bền và cải thiện kỹ thuật', 'Mục tiêu: Tăng cơ', '2026-11-18', '2026-12-16', 'Tennis']) assert.ok(requests[0].body.goal.includes(text))
  assert.deepEqual(Object.keys(requests[0].body).sort(), ['daysPerWeek', 'goal', 'level', 'memberId'])
  assert.ok(requests[0].body.goal.length <= 1000)
  assert.ok(container.querySelector('.coach-plan-ai-result'))
  assert.match(container.querySelector('.coach-plan-ai-result').textContent, /Nâng cao/)
  assert.match(container.querySelector('.coach-plan-ai-result').textContent, /7 buổi\/tuần/)
  assert.equal(container.querySelectorAll('.coach-plan-exercises article').length, 7, 'freeform results are not capped at the former five exercises')
  assert.equal(container.querySelector('.coach-plan-exercises article select').value, '1')
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(requests[1].url, '/TrainingPlans')
  assert.equal(requests[1].body.exercises.length, 7)
  assert.equal(new Date(requests[1].body.startDate).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }), '2026-11-18')
  assert.equal(new Date(requests[1].body.endDate).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }), '2026-12-16')
  assert.equal(requests[1].body.goal, 'MuscleGain')
}))

test('reversed dates never reach AI and a failed request preserves the prompt for retry', () => screen(async container => {
  await click('Tạo bài tập bằng AI')
  const options = container.querySelectorAll('.coach-plan-ai-options select')
  await act(async () => {
    options[0].value = 'Intermediate'; options[0].dispatchEvent(new window.Event('change', { bubbles: true }))
    options[1].value = '1'; options[1].dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  await change(container.querySelector('textarea'), 'Tăng sức bền')
  const dates = container.querySelectorAll('.coach-plan-form-grid input[type=date]')
  await change(dates[0], '2026-12-16'); await change(dates[1], '2026-11-18')
  await click('Tạo')
  assert.equal(requests.length, 0)
  assert.match(container.querySelector('[role=alert]').textContent, /Ngày kết thúc/)
  await change(dates[1], '2026-12-30')
  failAi = true
  await click('Tạo'); await finishProgress()
  assert.match(container.querySelector('[role=alert]').textContent, /AI đang bận/)
  assert.equal(container.querySelector('textarea').value, 'Tăng sức bền')
  failAi = false
  await click('Tạo'); await finishProgress()
  assert.ok(container.querySelector('.coach-plan-ai-result'))
  assert.equal(requests.length, 2)
  assert.ok(requests.every(request => request.body.level === 'Intermediate' && request.body.daysPerWeek === 1))
}))

test('stopping AI aborts the request and ignores its late response', () => screen(async container => {
  holdAi = true
  await click('Tạo bài tập bằng AI')
  await change(container.querySelector('textarea'), 'Tăng sức bền')
  await click('Tạo')
  assert.ok([...container.querySelectorAll('.coach-plan-ai-options select')].every(select => select.disabled))
  await click('Dừng tạo')
  assert.equal(requests[0].signal.aborted, true)
  await act(async () => pendingAi())
  await finishProgress()
  assert.equal(container.querySelector('.coach-plan-ai-result'), null)
  assert.equal(container.querySelectorAll('.coach-plan-exercises article').length, 0)
  assert.equal(container.querySelector('textarea').value, 'Tăng sức bền')
}))
