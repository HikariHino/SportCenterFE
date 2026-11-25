import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, auth, App, AuthProvider, ThemeProvider, createRoot
const descriptors = new Map()
before(async () => {
  window = new Window({ url: 'http://localhost:3000/' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    plugins: [{ name: 'test-portal-content', enforce: 'pre', transform(code, id) {
      const match = id.replaceAll('\\', '/').match(/\/src\/pages\/(Coach\/Coach|Receptionist\/Receptionist|CenterManager\/CenterManager|member\/Member|SportDashboard)\.jsx$/)
      if (match) return `export default function Portal() { return <p data-portal="${match[1]}">Portal content</p> }`
    } }],
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  auth = await server.ssrLoadModule('/src/utils/auth.js')
  AuthProvider = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  ThemeProvider = (await server.ssrLoadModule('/src/contexts/ThemeContext.jsx')).ThemeProvider
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

for (const remember of [false, true]) for (const [role, destination, portal] of [
  ['Member', '/member', 'member/Member'], ['Coach', '/coach', 'Coach/Coach'],
  ['Receptionist', '/receptionist', 'Receptionist/Receptionist'], ['CenterManager', '/manager', 'CenterManager/CenterManager'],
]) for (const path of ['/', '/login']) {
  test(`new ${role} tab at ${path} enters the existing account, remember=${remember}`, async () => {
    localStorage.clear(); sessionStorage.clear()
    auth.saveSession({ userId: 12, role, token: 'browser-token', refreshTokenKey: 'browser-refresh' }, 'browser-token', remember)
    const id = auth.getLoginSessionId()
    sessionStorage.clear() // New independent tab: shared localStorage and cookies, empty sessionStorage.
    await auth.initializeBrowserSession({ presence: { hasLiveTab: async () => true, start() {} }, navigationType: 'navigate' })
    window.history.replaceState(null, '', path)
    const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
    try {
      await act(async () => root.render(h(ThemeProvider, null, h(AuthProvider, null, h(App)))))
      for (let i = 0; i < 100 && !container.querySelector('[data-portal]'); i++) {
        await act(async () => new Promise(resolve => setTimeout(resolve, 10)))
      }
      assert.equal(window.location.pathname, destination)
      assert.equal(container.querySelector('[data-portal]')?.dataset.portal, portal)
      assert.equal(auth.getSavedUser().userId, 12)
      assert.equal(auth.getLoginSessionId(), id)
      // Another tab logs out. The mounted portal must leave immediately.
      localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem('refreshTokenKey')
      localStorage.removeItem('loginSessionId')
      localStorage.setItem(auth.ACTIVE_LOGIN_KEY, `signed-out:${id}`)
      await act(async () => window.dispatchEvent(new window.StorageEvent('storage', { key: auth.ACTIVE_LOGIN_KEY })))
      for (let i = 0; i < 100 && !container.querySelector('.login-page'); i++) {
        await act(async () => new Promise(resolve => setTimeout(resolve, 10)))
      }
      assert.equal(window.location.pathname, '/login')
      assert.equal(container.querySelector('[data-portal]'), null)
      assert.ok(container.querySelector('.login-page'))
      assert.equal(auth.getToken(), null)
    } finally { await act(async () => root.unmount()); container.remove() }
  })
}

for (const remember of [false, true]) test(`reopening the website after closing every tab respects remember=${remember} before rendering routes`, async () => {
  localStorage.clear(); sessionStorage.clear()
  auth.saveSession({ userId: 12, role: 'Member', token: 'closed-tab-token' }, 'closed-tab-token', remember)
  sessionStorage.clear()
  await auth.initializeBrowserSession({ presence: { hasLiveTab: async () => false, start() { assert.fail('No live tab') } }, navigationType: 'navigate' })
  window.history.replaceState(null, '', '/member')
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(h(ThemeProvider, null, h(AuthProvider, null, h(App)))))
    for (let i = 0; i < 100 && !container.querySelector(remember ? '[data-portal]' : '.login-page'); i++) {
      await act(async () => new Promise(resolve => setTimeout(resolve, 10)))
    }
    assert.equal(window.location.pathname, remember ? '/member' : '/login')
    assert.equal(Boolean(container.querySelector('[data-portal]')), remember)
    assert.equal(auth.getToken(), remember ? 'closed-tab-token' : null)
  } finally { await act(async () => root.unmount()); container.remove() }
})
