import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h, useEffect } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, api, auth, AuthProvider, useAuth, createRoot
const descriptors = new Map()
before(async () => {
  window = new Window({ url: 'http://localhost:3000/login' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  auth = await server.ssrLoadModule('/src/utils/auth.js')
  const context = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
  AuthProvider = context.AuthProvider; useAuth = context.useAuth
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

test('an unrecoverable API 401 clears the React auth state and stops mounted portal work without waiting for navigation', async () => {
  auth.saveSession({ userId: 1, role: 'Receptionist', token: 'expired-token' }, 'expired-token', false)
  let mounts = 0, stops = 0
  function Portal() {
    useEffect(() => { mounts++; return () => { stops++ } }, [])
    return h('p', { id: 'portal' }, 'Receptionist')
  }
  function Route() { return useAuth().user ? h(Portal) : h('p', { id: 'login' }, 'Đăng nhập lại') }
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  api.defaults.adapter = async config => {
    throw Object.assign(new Error('Unauthorized'), { config, response: { status: 401 } })
  }
  try {
    await act(async () => root.render(h(AuthProvider, null, h(Route))))
    assert.ok(container.querySelector('#portal'))
    await act(async () => { await assert.rejects(api.get('/payments'), error => error.response?.status === 401) })
    assert.equal(container.querySelector('#portal'), null)
    assert.ok(container.querySelector('#login'))
    assert.equal(auth.getToken(), null)
    assert.equal(mounts, 1); assert.equal(stops, 1)
  } finally { await act(async () => root.unmount()); container.remove() }
})
