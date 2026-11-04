import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { FULL_NAME_MESSAGE, FULL_NAME_PATTERN, getFullNameCharactersError } from '../src/utils/fullNameValidation.js'
import { getFullNameValidationError, profileValidationErrors } from '../src/utils/profileValidation.js'

const invalidNames = ['Nguyễn Văn An1', '123456', 'An１２', 'An١', 'An²', 'AnⅣ', 'Nguyễn-Văn An', "O'Connor", 'O’Connor',
  'An@', 'An#', 'An_', 'An.', 'An/Minh', 'An (Minh)', 'An&Minh', 'An+', 'An🏸', '<script>', 'An\tMinh', 'An\nMinh', 'An\n',
  'An\r', 'An\u200b', 'An\u200d', '\u0301An', 'An \u0301Minh', 'An\u00a0Minh']
const validNames = ['Nguyễn Thế Anh', 'Đỗ Thị Hồng Ánh', '  Trần  Đặng Mỹ  ', 'Anne Marie', '李', 'A', 'Nguyễn Thế Anh'.normalize('NFD')]
let server, api, auth, manager, reception, profile
const descriptors = new Map()

before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  auth = await server.ssrLoadModule('/src/services/authService.js')
  manager = await server.ssrLoadModule('/src/services/managerAccountService.js')
  reception = await server.ssrLoadModule('/src/services/receptionistEntryService.js')
  profile = await server.ssrLoadModule('/src/services/profileService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

test('full names accept letters, Vietnamese accents and ordinary spaces, including decomposed input', () => {
  const nativePattern = new RegExp(`^(?:${FULL_NAME_PATTERN})$`, 'v')
  for (const fullName of validNames) {
    assert.equal(getFullNameCharactersError(fullName), '')
    assert.equal(getFullNameValidationError(fullName), '')
    assert.equal(nativePattern.test(fullName), true)
  }
})

test('full names reject ASCII and Unicode numbers, punctuation, emoji and invisible characters', () => {
  for (const fullName of [...invalidNames, '', '   ', null, undefined, 123, {}, []]) {
    assert.equal(getFullNameCharactersError(fullName), FULL_NAME_MESSAGE)
    assert.ok(getFullNameValidationError(fullName))
    assert.ok(profileValidationErrors({ fullName }, { partial: false }).fullName)
  }
})

const details = { email: 'test@fpt.edu.vn', password: 'Password123!', phone: '0912345678', dateOfBirth: '2000-01-01', gender: 'Male', role: 'Coach' }
for (const [name, save, url] of [
  ['registration OTP', fullName => auth.sendRegisterOtp({ ...details, fullName }), '/Auth/send-register-otp'],
  ['registration', fullName => auth.register({ ...details, fullName }), '/auth/register'],
  ['Manager member creation', fullName => manager.createManagerMember({ ...details, fullName }), '/members'],
  ['Manager staff creation', fullName => manager.createManagerStaff({ ...details, fullName }), '/users/staff'],
  ['Receptionist member creation', fullName => reception.createReceptionistMember({ ...details, fullName }), '/members'],
  ['shared profile updates', fullName => profile.updateProfile({ fullName }), '/profile'],
]) {
  test(`${name} rejects digits and special characters before any API call`, async () => {
    let calls = 0
    api.defaults.adapter = async () => { calls++; throw new Error('Unexpected request') }
    for (const fullName of invalidNames) await assert.rejects(save(fullName), /Họ và tên/)
    assert.equal(calls, 0)
  })

  test(`${name} retains valid accented names in the request`, async () => {
    const calls = []
    api.defaults.adapter = async config => {
      calls.push({ url: config.url, data: JSON.parse(config.data) })
      return { config, status: 200, headers: {}, data: { success: true, data: { id: 1 } } }
    }
    for (const fullName of validNames) {
      await save(fullName)
      assert.equal(calls.at(-1).url, url)
      assert.equal(calls.at(-1).data.fullName.trim(), fullName.trim())
    }
  })
}

test('password-only profile updates still omit full name validation', async () => {
  api.defaults.adapter = async config => ({ config, status: 200, headers: {}, data: { success: true } })
  await profile.updateProfile({ currentPassword: 'OldPassword!', password: 'NewPassword!' })
})
