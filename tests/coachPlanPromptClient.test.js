import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

let window, server, createRoot, Dialog, requests, failAi, holdAi, pendingAi, aiAnswer, duplicateResult, checkFailure, creationConflict
const descriptors = new Map()
const student = { memberId: 4, name: 'Nguyễn Văn An', sportName: 'Tennis', className: 'Tennis A' }
const catalog = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, exerciseName: `Exercise ${index + 1}` }))
const recommendation = { goal: 'Tăng sức bền', level: 'Beginner', daysPerWeek: 3,
  sessions: [{ day: 1, title: 'Kỹ thuật', exercises: catalog.map(item => ({ exerciseName: item.exerciseName, sets: 3, reps: 10 })) }], warnings: [] }
const completedMatch = { id: 81, planName: 'Giáo án đã hoàn thành', goal: 'GeneralFitness', startDate: '2026-10-01T00:00:00Z', endDate: '2026-10-31T00:00:00Z' }
const duplicate = { isDuplicate: true, message: 'Học viên đã hoàn thành giáo án tương tự.', matchedPlans: [completedMatch] }

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
    if (config.url === '/TrainingPlans/check-duplicate') {
      if (checkFailure) throw new Error('Không kiểm tra được lịch sử')
      return response(duplicateResult)
    }
    if (config.url === '/TrainingPlans' && creationConflict) {
      creationConflict = false
      throw Object.assign(new Error('Conflict'), { response: { status: 409, data: { code: 'DUPLICATE_COMPLETED_PLAN', message: duplicate.message, matchedPlans: duplicate.matchedPlans } } })
    }
    if (config.url === '/ai/workout-recommendations') {
      assert.ok(['Giảm cân', 'Tăng cơ', 'Tăng sức bền', 'Cải thiện độ dẻo', 'Thể lực tổng quát'].includes(body.goal.split('.')[0]), 'BE must recognize the selected preset before the Coach requirements')
      if (failAi) throw new Error('AI đang bận')
      if (holdAi) await new Promise(resolve => { pendingAi = resolve })
      return response({ ...aiAnswer, level: body.level, daysPerWeek: body.daysPerWeek })
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

async function screen(run, selectedStudent = student) {
  requests = []; failAi = false; holdAi = false; pendingAi = null; aiAnswer = recommendation
  duplicateResult = { isDuplicate: false, matchedPlans: [] }; checkFailure = false; creationConflict = false
  const container = document.body.appendChild(document.createElement('div'))
  const root = createRoot(container)
  try {
    await act(async () => root.render(h(Dialog, { student: selectedStudent, onClose() {}, onCreated() {} })))
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

test('AI generation sends the chosen inputs and places tagged exercises directly in the editable list before an explicit save', () => screen(async container => {
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
  assert.equal(requests[0].body.goal.split('.')[0], 'Tăng cơ')
  for (const text of ['Tăng sức bền và cải thiện kỹ thuật', '2026-11-18', '2026-12-16', 'Tennis']) assert.ok(requests[0].body.goal.includes(text))
  assert.deepEqual(Object.keys(requests[0].body).sort(), ['daysPerWeek', 'goal', 'level', 'memberId'])
  assert.ok(requests[0].body.goal.length <= 1000)
  assert.equal(container.querySelector('.coach-plan-ai-result'), null)
  assert.equal(container.querySelector('[aria-label="Gợi ý tập luyện từ AI"]'), null)
  assert.doesNotMatch(container.textContent, /Gợi ý từ AI|STT/)
  assert.equal(container.querySelectorAll('.coach-plan-exercises .coach-numbered-item').length, 0)
  assert.equal(container.querySelectorAll('.coach-plan-exercise-ai-tag').length, 7)
  assert.equal(container.querySelectorAll('.coach-plan-exercises article').length, 7, 'freeform results are not capped at the former five exercises')
  assert.equal(container.querySelector('.coach-plan-exercises article select').value, '1')
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(requests[1].url, '/TrainingPlans/check-duplicate')
  const saved = requests.find(request => request.url === '/TrainingPlans')
  assert.equal(saved.body.exercises.length, 7)
  assert.ok(saved.body.exercises.every(exercise => !Object.hasOwn(exercise, 'isAiSuggested')))
  assert.equal(new Date(saved.body.startDate).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }), '2026-11-18')
  assert.equal(new Date(saved.body.endDate).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }), '2026-12-16')
  assert.equal(saved.body.goal, 'MuscleGain')
}))

test('the short endurance prompt for a Yoga member is sent as requirements under the selected preset', () => screen(async container => {
  await click('Tạo bài tập bằng AI')
  await change(container.querySelector('textarea'), 'Tăng sức bền')
  await click('Tạo'); await finishProgress()
  assert.equal(requests.length, 1)
  const payload = requests[0].body
  assert.equal(payload.memberId, 7)
  assert.equal(payload.goal.split('.')[0], 'Thể lực tổng quát')
  assert.match(payload.goal, /Yêu cầu của Coach: Tăng sức bền/)
  assert.match(payload.goal, /Bộ môn: Yoga/)
  assert.equal(container.querySelector('.coach-plan-form-error'), null)
  assert.equal(container.querySelectorAll('.coach-plan-exercise-ai-tag').length, 7)
}, { ...student, memberId: 7, sportName: 'Yoga' }))

const submitPlan = () => act(async () => {
  const form = document.querySelector('.coach-plan-create-dialog form')
  for (let i = 0; i < 2; i++) form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
})

test('a duplicate shows completed plan details and creates only after an explicit repeat confirmation', () => screen(async container => {
  duplicateResult = duplicate
  await submitPlan()
  assert.equal(requests.filter(request => request.url === '/TrainingPlans/check-duplicate').length, 1)
  assert.equal(requests.filter(request => request.url === '/TrainingPlans').length, 0)
  assert.match(container.querySelector('.coach-plan-duplicate').textContent, /#81 · Giáo án đã hoàn thành/)
  await click('Xác nhận tập lại')
  const saved = requests.filter(request => request.url === '/TrainingPlans')
  assert.equal(saved.length, 1)
  assert.equal(saved[0].body.confirmRepeat, true)
  assert.equal(saved[0].body.memberId, 4)
}))

test('editing a duplicate invalidates repeat consent and rechecks the updated plan', () => screen(async container => {
  duplicateResult = duplicate
  await submitPlan()
  await change(container.querySelector('.coach-plan-form-grid input'), 'Giáo án đã thay đổi')
  assert.equal(container.querySelector('.coach-plan-duplicate'), null)
  duplicateResult = { isDuplicate: false, matchedPlans: [] }
  await submitPlan()
  const saved = requests.find(request => request.url === '/TrainingPlans')
  assert.equal(saved.body.planName, 'Giáo án đã thay đổi')
  assert.equal(saved.body.confirmRepeat, undefined)
  assert.equal(requests.filter(request => request.url === '/TrainingPlans/check-duplicate').length, 2)
}))

test('duplicate actions let the Coach edit or reopen AI without saving or discarding the draft', () => screen(async container => {
  duplicateResult = duplicate
  await submitPlan(); await click('Chỉnh sửa giáo án')
  assert.equal(container.querySelector('.coach-plan-duplicate'), null)
  assert.equal(document.activeElement, container.querySelector('.coach-plan-form-grid input'))
  await submitPlan(); await click('Tạo lại bằng AI')
  assert.ok(container.querySelector('.coach-plan-ai-demo textarea'))
  assert.equal(container.querySelector('.coach-plan-duplicate'), null)
  assert.equal(requests.filter(request => request.url === '/TrainingPlans').length, 0)
}))

test('a duplicate detected during creation opens the same review instead of silently repeating', () => screen(async container => {
  creationConflict = true
  await submitPlan()
  assert.ok(container.querySelector('.coach-plan-duplicate'))
  assert.equal(requests.find(request => request.url === '/TrainingPlans').body.confirmRepeat, undefined)
  await click('Xác nhận tập lại')
  assert.equal(requests.filter(request => request.url === '/TrainingPlans').at(-1).body.confirmRepeat, true)
}))

test('failed or malformed duplicate checks never proceed to plan creation', () => screen(async container => {
  checkFailure = true
  await submitPlan()
  assert.match(container.querySelector('[role=alert]').textContent, /Không kiểm tra được lịch sử/)
  checkFailure = false; duplicateResult = { isDuplicate: false, matchedPlans: [completedMatch] }
  await submitPlan()
  assert.match(container.querySelector('[role=alert]').textContent, /Chưa xác nhận/)
  assert.equal(requests.filter(request => request.url === '/TrainingPlans').length, 0)
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
  assert.equal(container.querySelector('.coach-plan-ai-result'), null)
  assert.equal(container.querySelectorAll('.coach-plan-exercise-ai-tag').length, 7)
  assert.equal(requests.length, 2)
  assert.ok(requests.every(request => request.body.level === 'Intermediate' && request.body.daysPerWeek === 1))
}))

test('stopping AI aborts the request and ignores its late response', () => screen(async container => {
  holdAi = true
  await click('Tạo bài tập bằng AI')
  await change(container.querySelector('textarea'), 'Tăng sức bền')
  await click('Tạo')
  assert.ok([...container.querySelectorAll('.coach-plan-ai-options select')].every(select => select.disabled))
  const progress = container.querySelector('.coach-ai-progress-dialog')
  assert.equal(progress.querySelectorAll('li').length, 5)
  assert.match(progress.textContent, /lấy dữ liệu bổ sung của hội viên/)
  assert.match(progress.querySelector('#coach-ai-progress-context').textContent, /Tuổi từ ngày sinh, giới tính/)
  assert.ok(progress.querySelector('footer .coach-ai-progress-cancel'))
  assert.equal(document.body.style.overflow, 'hidden')
  await finishProgress()
  assert.notEqual(progress.querySelector('[role=progressbar]').getAttribute('aria-valuenow'), '100')
  assert.equal(document.activeElement, progress.querySelector('.coach-ai-progress-cancel'))
  await click('Dừng tạo')
  assert.equal(requests[0].signal.aborted, true)
  await act(async () => pendingAi())
  await finishProgress()
  assert.equal(container.querySelector('.coach-plan-ai-result'), null)
  assert.equal(container.querySelectorAll('.coach-plan-exercises article').length, 0)
  assert.equal(container.querySelector('textarea').value, 'Tăng sức bền')
  assert.equal(document.body.style.overflow, '')
}))

test('AI tags survive pagination and edits while manually added exercises remain untagged', () => screen(async container => {
  aiAnswer = { ...recommendation, sessions: [{ day: 1, title: 'Toàn thân', exercises: Array.from({ length: 11 }, (_, index) => ({
    exerciseName: index === 10 ? 'Unknown exercise' : catalog[index % catalog.length].exerciseName, sets: 3, reps: 10,
  })) }] }
  await click('Tạo bài tập bằng AI')
  await change(container.querySelector('textarea'), 'Bài tập tăng sức bền')
  await click('Tạo'); await finishProgress()
  assert.equal(container.querySelectorAll('.coach-plan-exercise-ai-tag').length, 10)
  await act(async () => container.querySelector('[aria-label="Trang sau: Bài tập đang soạn"]').click())
  let aiRow = container.querySelector('.coach-plan-exercises article')
  assert.equal(aiRow.querySelector('strong').textContent, 'Bài tập 11')
  assert.ok(aiRow.querySelector('.coach-plan-exercise-ai-tag'))
  assert.ok(aiRow.querySelector('[role=alert]'))
  const picker = aiRow.querySelector('select')
  await act(async () => { picker.value = '2'; picker.dispatchEvent(new window.Event('change', { bubbles: true })) })
  assert.ok(container.querySelector('.coach-plan-exercises article .coach-plan-exercise-ai-tag'))
  await click('Thêm bài tập')
  const rows = container.querySelectorAll('.coach-plan-exercises article')
  assert.equal(rows.length, 2)
  assert.equal(rows[1].querySelector('strong').textContent, 'Bài tập 12')
  assert.equal(rows[1].querySelector('.coach-plan-exercise-ai-tag'), null)
  assert.equal(rows[1].querySelector('select').value, '')
  assert.equal(container.querySelector('.coach-plan-exercises .coach-numbered-item'), null)
  await act(async () => container.querySelector('[aria-label="Xóa bài tập 11"]').click())
  aiRow = container.querySelector('.coach-plan-exercises article')
  assert.equal(aiRow.querySelector('strong').textContent, 'Bài tập 11')
  assert.equal(aiRow.querySelector('.coach-plan-exercise-ai-tag'), null)
}))
