import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, profile, Form, AuthProvider, MemoryRouter
const descriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, esbuild: { jsx: 'automatic' },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  profile = await server.ssrLoadModule('/src/services/profileService.js')
  Form = (await server.ssrLoadModule('/src/components/ChangeEmailForm.jsx')).default
  AuthProvider = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  MemoryRouter = (await server.ssrLoadModule('react-router-dom')).MemoryRouter
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function renderForm(props) {
  return renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(AuthProvider, null, createElement(Form, { currentEmail: 'current@example.com', ...props }))))
}

test('staff email inputs retain native email validation without the dot-com-only restriction', () => {
  const input = renderForm({ allowAnyEmailDomain: true }).match(/<input[^>]*type="email"[^>]*>/)[0]
  assert.doesNotMatch(input, /pattern=/)
  assert.match(input, /maxLength="254"/)
  assert.match(input, /required=""/)
  assert.match(input, /địa chỉ email hợp lệ/)
})

test('the default email form preserves the existing policy for protected account screens', () => {
  const input = renderForm({}).match(/<input[^>]*type="email"[^>]*>/)[0]
  assert.match(input, /pattern="\[\^ @\]\+@\[\^ @\]\+\[\.\]com"/)
  assert.match(input, /kết thúc bằng .com/)
})

test('education email requests and OTP verification preserve normalization and existing endpoints', async () => {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push({ url: config.url, data: JSON.parse(config.data) })
    return { config, status: 200, headers: {}, data: { success: true, data: { email: 'new@fpt.edu.vn' } } }
  }
  await profile.requestChangeEmailOtp(' New@FPT.EDU.VN ')
  await profile.verifyChangeEmailOtp(' New@FPT.EDU.VN ', ' 012345 ')
  assert.deepEqual(calls, [
    { url: '/profile/change-email/request-otp', data: { newEmail: 'new@fpt.edu.vn' } },
    { url: '/profile/change-email/verify-otp', data: { newEmail: 'new@fpt.edu.vn', otp: '012345' } },
  ])
})
