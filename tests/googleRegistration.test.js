import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, Register, GoogleSignInButton, ThemeProvider, AuthProvider, MemoryRouter
const descriptors = new Map()
before(async () => {
  for (const [key, value] of Object.entries({
    localStorage: { getItem: () => null },
    sessionStorage: { getItem: () => null },
    window: { matchMedia: () => ({ matches: false }) },
  })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, define: { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': '""' },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error',
  })
  Register = (await server.ssrLoadModule('/src/pages/Register.jsx')).default
  GoogleSignInButton = (await server.ssrLoadModule('/src/components/GoogleSignInButton.jsx')).default
  ThemeProvider = (await server.ssrLoadModule('/src/contexts/ThemeContext.jsx')).ThemeProvider
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

test('registration offers Google before the email form without requiring email OTP fields', () => {
  const html = renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(ThemeProvider, null, createElement(AuthProvider, null, createElement(Register)))))
  const formIndex = html.indexOf('<form')
  const googleIndex = html.indexOf('aria-label="Đăng ký bằng Google"')
  assert.ok(googleIndex >= 0 && googleIndex < formIndex)
  assert.match(html.slice(googleIndex, formIndex), /Đăng ký bằng Google<\/button>/)
  assert.match(html.slice(googleIndex, formIndex), /type="button" disabled=""/)
  assert.match(html.slice(googleIndex, formIndex), /Hoặc đăng ký bằng email/)
  assert.doesNotMatch(html.slice(formIndex), /login-google-host/)
  assert.match(html.match(/<input[^>]*name="otp"[^>]*>/)[0], /required=""/)
  assert.match(html.match(/<input[^>]*name="terms"[^>]*>/)[0], /required=""/)
  assert.match(html.slice(formIndex), /type="submit" class="register-submit"/)
})

test('the shared Google button keeps sign-in wording by default and uses signup fallback when requested', () => {
  const renderButton = intent => renderToStaticMarkup(createElement(ThemeProvider, null,
    createElement(GoogleSignInButton, { intent, onCredential() {} })))
  assert.match(renderButton(), />Đăng nhập bằng Google<\/button>/)
  assert.match(renderButton('signup'), />Đăng ký bằng Google<\/button>/)
  assert.doesNotMatch(renderButton('signup'), /Đăng nhập/)
})
