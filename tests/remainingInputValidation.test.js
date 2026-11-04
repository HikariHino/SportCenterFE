import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { getTrainingExercisesValidationError } from '../src/utils/trainingPlanValidation.js'

let server, api, memberService, reception, training, auth
const descriptors = new Map()
const registration = { id: 10, memberId: 20, sessionId: 30, status: 'Registered', sessionStatus: 'Scheduled', startsAt: '2026-11-04T00:15:00+07:00', endsAt: '2026-11-04T01:00:00+07:00' }
const registrationForm = { fullName: 'Nguyễn An', email: 'test@fpt.edu.vn', password: 'Password123!', phone: '0912345678', address: 'Hà Nội', fitnessGoal: 'Thể lực' }
const exercise = { exerciseId: 1, sets: 3, reps: 10, durationInMinutes: 15, notes: 'Theo hướng dẫn' }
const plan = { planName: 'Giáo án', goal: 'GeneralFitness', memberId: 20, startDate: '2026-11-04', endDate: '2026-11-10', exercises: [exercise] }

before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  memberService = await server.ssrLoadModule('/src/services/memberClassService.js')
  reception = await server.ssrLoadModule('/src/services/receptionistEntryService.js')
  training = await server.ssrLoadModule('/src/services/trainingPlanService.js')
  auth = await server.ssrLoadModule('/src/services/authService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function mockApi({ registrations = [registration], readError, writeError } = {}) {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push({ url: config.url, method: config.method, data: config.data && JSON.parse(config.data), page: config.params?.page })
    if (config.method === 'get') {
      if (readError) throw new Error('Registration read failed')
      assert.equal(config.url, '/class-registrations/mine')
      return { config, status: 200, headers: {}, data: { items: registrations.slice(config.params.page - 1, config.params.page), total: registrations.length, page: config.params.page, pageSize: 1 } }
    }
    return { config, status: 200, headers: {}, data: writeError ? { success: false, message: 'Server rejected write' } : { success: true, data: { id: 50, memberId: 20, sessionId: 30, status: 'Present' } } }
  }
  return calls
}

test('Member cannot check in before midnight even when inside the 30-minute window', async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-11-03T23:55:00+07:00'))
  const calls = mockApi()
  await assert.rejects(memberService.checkInRegistration(10, 30), /trong ngày/)
  assert.ok(calls.every(call => call.method === 'get'))
})

test('Member rereads all registration pages and permits check-in from midnight in Vietnam', async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-11-03T17:00:00Z'))
  const calls = mockApi({ registrations: [{ ...registration, id: 9 }, registration] })
  await memberService.checkInRegistration(10, 30)
  assert.deepEqual(calls.filter(call => call.method === 'get').map(call => call.page), [1, 2])
  assert.equal(calls.at(-1).url, '/class-registrations/10/check-in')
})

test('Member cannot submit stale, cancelled, already recorded, wrong-session or unreadable registrations', async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-11-04T00:15:00+07:00'))
  for (const options of [
    { registrations: [] }, { readError: true }, { registrations: [{ ...registration, sessionId: 999 }] },
    { registrations: [{ ...registration, status: 'Cancelled' }] }, { registrations: [{ ...registration, attendanceStatus: 'Present' }] },
    { registrations: [{ ...registration, startsAt: '2026-11-06T00:15:00+07:00', endsAt: '2026-11-06T01:00:00+07:00' }] },
  ]) {
    const calls = mockApi(options)
    await assert.rejects(memberService.checkInRegistration(10, 30))
    assert.ok(calls.every(call => call.method === 'get'))
  }
})

for (const [name, create] of [
  ['manual', notes => reception.manualReceptionistCheckIn({ memberId: '20', notes })],
  ['QR', notes => reception.scanReceptionistQrCheckIn({ qrCode: 'member-qr', notes })],
]) {
  test(`Receptionist ${name} check-in blocks notes beyond 500 characters before requests`, async () => {
    const calls = mockApi()
    for (const notes of ['a'.repeat(501), 'a'.repeat(10000), {}]) await assert.rejects(create(notes), /Ghi chú check-in/)
    assert.equal(calls.length, 0)
    for (const notes of ['', undefined, 'a'.repeat(500)]) await create(notes)
    assert.equal(calls.length, 3)
    assert.equal(calls.at(-1).data.notes.length, 500)
  })
}

test('exercise counts, IDs and durations must be positive integers within backend integer range', async () => {
  const calls = mockApi()
  for (const field of ['exerciseId', 'sets', 'reps', 'durationInMinutes']) {
    for (const value of [0, -1, 1.5, 'abc', NaN, Infinity, '1e309', 2147483648, true, {}, []]) {
      assert.ok(getTrainingExercisesValidationError([{ ...exercise, [field]: value }]))
      await assert.rejects(training.createTrainingPlan({ ...plan, exercises: [{ ...exercise, [field]: value }] }), /số nguyên dương/)
    }
  }
  assert.equal(calls.length, 0)
})

test('required exercise counts reject blank values, while duration remains optional', async () => {
  let calls = mockApi()
  for (const field of ['exerciseId', 'sets', 'reps']) {
    for (const value of ['', ' ', undefined, null]) await assert.rejects(training.createTrainingPlan({ ...plan, exercises: [{ ...exercise, [field]: value }] }))
  }
  for (const exercises of [null, {}, [null]]) await assert.rejects(training.createTrainingPlan({ ...plan, exercises }))
  assert.equal(calls.length, 0)
  calls = mockApi()
  for (const durationInMinutes of ['', ' ', null, undefined]) {
    await training.createTrainingPlan({ ...plan, exercises: [{ ...exercise, durationInMinutes }] })
    assert.equal(calls.at(-1).data.exercises[0].durationInMinutes, null)
  }
})

test('valid numeric drafts normalize to numbers and preserve exercise notes', async () => {
  const calls = mockApi()
  await training.createTrainingPlan({ ...plan, exercises: [{ ...exercise, exerciseId: '1', sets: '3', reps: '10', durationInMinutes: '15' }] })
  assert.deepEqual(calls[0].data.exercises, [exercise])
  await training.createTrainingPlan({ ...plan, exercises: [] })
  assert.deepEqual(calls.at(-1).data.exercises, [])
})

for (const [name, send] of [
  ['registration OTP', form => auth.sendRegisterOtp(form)],
  ['registration', form => auth.register(form)],
]) {
  test(`${name} blocks short, overlong and over-byte-limit passwords before requests`, async () => {
    const calls = mockApi()
    for (const password of ['', '        ', '1234567', 'a'.repeat(73), 'é'.repeat(37), '🏸'.repeat(19)]) {
      await assert.rejects(send({ ...registrationForm, password }), error => error.field === 'password')
    }
    assert.equal(calls.length, 0)
  })

  test(`${name} enforces account text limits and accepts the exact boundaries`, async () => {
    const calls = mockApi()
    for (const [field, max] of [['fullName', 100], ['email', 256], ['address', 200], ['fitnessGoal', 100]]) {
      await assert.rejects(send({ ...registrationForm, [field]: 'a'.repeat(max + 1) }), error => error.field === field)
    }
    assert.equal(calls.length, 0)
    await send({ ...registrationForm, fullName: 'a'.repeat(100), address: 'a'.repeat(200), fitnessGoal: 'a'.repeat(100), password: 'a'.repeat(72) })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].data.password.length, 72)
  })
}

test('password reset blocks invalid length and mismatched confirmation before any request', async () => {
  const calls = mockApi()
  for (const newPassword of ['', '        ', '1234567', 'a'.repeat(73), 'é'.repeat(37), '🏸'.repeat(19)]) {
    await assert.rejects(auth.verifyResetPassword({ email: registrationForm.email, otp: '123456', newPassword, confirmPassword: newPassword }))
  }
  await assert.rejects(auth.verifyResetPassword({ email: registrationForm.email, otp: '123456', newPassword: 'Password123!', confirmPassword: 'Another123!' }), /chưa khớp/)
  assert.equal(calls.length, 0)
})

test('valid passwords remain byte-for-byte unchanged in registration and reset requests', async () => {
  const calls = mockApi()
  const password = ' Pass12 '
  await auth.sendRegisterOtp({ ...registrationForm, password })
  await auth.verifyResetPassword({ email: registrationForm.email, otp: '012345', newPassword: password, confirmPassword: password })
  assert.equal(calls[0].data.password, password)
  assert.equal(calls[1].data.newPassword, password)
  assert.equal(calls[1].data.confirmPassword, password)
})

test('server rejections remain visible after valid input checks', async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-11-04T00:15:00+07:00'))
  mockApi({ writeError: true })
  await assert.rejects(memberService.checkInRegistration(10, 30), /Server rejected write/)
  await assert.rejects(reception.scanReceptionistQrCheckIn({ qrCode: 'member-qr', notes: 'Ghi chú' }), /Server rejected write/)
  await assert.rejects(training.createTrainingPlan(plan), /Server rejected write/)
  await assert.rejects(auth.sendRegisterOtp(registrationForm), /Server rejected write/)
  assert.equal((await auth.verifyResetPassword({ email: registrationForm.email, otp: '123456', newPassword: 'Password123!', confirmPassword: 'Password123!' })).success, false)
})
