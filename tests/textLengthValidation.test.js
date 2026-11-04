import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { getSupportResolutionValidationError } from '../src/utils/textLengthValidation.js'

let server, api, support, training
const descriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  support = await server.ssrLoadModule('/src/services/receptionistSupportTicketService.js')
  training = await server.ssrLoadModule('/src/services/trainingPlanService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function mockApi(body = { success: true }) {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push({ url: config.url, method: config.method, data: config.data && JSON.parse(config.data) })
    return { config, status: 200, headers: {}, data: config.method === 'get' ? { data: [{ id: 10, status: 'Open' }] } : body }
  }
  return calls
}

test('support responses allow an optional note and exactly 2,000 characters', async () => {
  const calls = mockApi()
  for (const resolutionNote of [undefined, null, '', '   ', 'a'.repeat(2000)]) {
    assert.equal(getSupportResolutionValidationError({ resolutionNote }), '')
    await support.resolveReceptionistSupportTicket(10, { status: 'InProgress', resolutionNote })
    assert.equal(calls.at(-1).url, '/SupportTickets/10/resolve')
  }
  assert.equal(calls.at(-1).data.resolutionNote.length, 2000)
})

test('2,001-character, 10,000-character and non-text responses cannot reach the API', async () => {
  const calls = mockApi()
  for (const resolutionNote of ['a'.repeat(2001), 'a'.repeat(10000), ' '.repeat(10000), 123, {}]) {
    await assert.rejects(support.resolveReceptionistSupportTicket(10, { status: 'Resolved', resolutionNote }), /Ghi chú phản hồi/)
  }
  assert.equal(calls.length, 0)
})

test('valid support responses retain trimmed content and preserve backend failures', async () => {
  let calls = mockApi({ success: true, data: { id: 10, status: 'Resolved' } })
  assert.equal((await support.resolveReceptionistSupportTicket(10, { status: 'Resolved', resolutionNote: ' Đã hướng dẫn hội viên. ' })).id, 10)
  assert.deepEqual(calls.at(-1).data, { status: 'Resolved', resolutionNote: 'Đã hướng dẫn hội viên.' })
  calls = mockApi({ success: false, message: 'Ticket already closed' })
  await assert.rejects(support.resolveReceptionistSupportTicket(10, { status: 'Resolved', resolutionNote: 'Phản hồi' }), /Ticket already closed/)
  assert.equal(calls.length, 2)
})

const plan = { planName: 'Giáo án mới', goal: 'GeneralFitness', memberId: 5, startDate: '2026-11-04', endDate: '2026-11-10',
  exercises: [{ exerciseId: 1, sets: 3, reps: 10, notes: 'Theo hướng dẫn' }] }

test('Coach plan names and notes reject text beyond their input limits before any write', async () => {
  const calls = mockApi()
  await assert.rejects(training.createTrainingPlan({ ...plan, planName: 'a'.repeat(151) }), /150 ký tự/)
  await assert.rejects(training.createTrainingPlan({ ...plan, exercises: [{ ...plan.exercises[0], notes: 'a'.repeat(501) }] }), /500 ký tự/)
  await assert.rejects(training.updateTrainingPlanExerciseResult(1, 'a'.repeat(501)), /500 ký tự/)
  await assert.rejects(training.updateTrainingPlanExerciseResult(1, 'a'.repeat(10000)), /500 ký tự/)
  assert.equal(calls.length, 0)
})

test('Coach plan names and exercise notes remain accepted at their exact length boundaries', async () => {
  const calls = mockApi({ success: true, data: { id: 1 } })
  await training.createTrainingPlan({ ...plan, planName: 'a'.repeat(150), exercises: [{ ...plan.exercises[0], notes: 'a'.repeat(500) }] })
  await training.updateTrainingPlanExerciseResult(1, 'a'.repeat(500))
  assert.equal(calls[0].url, '/TrainingPlans')
  assert.equal(calls[0].data.planName.length, 150)
  assert.equal(calls[0].data.exercises[0].notes.length, 500)
  assert.equal(calls[1].url, '/TrainingPlans/exercises/1/result')
  assert.equal(calls[1].data.notes.length, 500)
})
