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

for (const signal of ['storage', 'focus', 'visibilitychange']) {
  test(`another tab login unmounts the old account on ${signal}, preserving the new login`, async () => {
    auth.saveSession({ userId: 1, role: 'Member', token: 'old-token' }, 'old-token', true)
    let stopped = 0
    function Portal() { useEffect(() => () => { stopped++ }, []); return h('p', { id: 'portal' }, 'Account 1') }
    function Route() { return useAuth().user ? h(Portal) : h('p', { id: 'login' }, 'Đăng nhập lại') }
    const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
    try {
      await act(async () => root.render(h(AuthProvider, null, h(Route))))
      // A remote tab publishes its identity after saving its own credentials.
      localStorage.setItem('user', JSON.stringify({ userId: 2, role: 'member' }))
      localStorage.setItem('token', 'new-token')
      localStorage.setItem('refreshTokenKey', 'new-refresh')
      localStorage.setItem('loginSessionId', 'remote-login')
      localStorage.setItem(auth.ACTIVE_LOGIN_KEY, 'remote-login')
      await act(async () => {
        if (signal === 'storage') window.dispatchEvent(new window.StorageEvent('storage', { key: auth.ACTIVE_LOGIN_KEY, newValue: 'remote-login' }))
        else if (signal === 'focus') window.dispatchEvent(new window.Event('focus'))
        else document.dispatchEvent(new window.Event('visibilitychange'))
      })
      assert.equal(container.querySelector('#portal'), null)
      assert.ok(container.querySelector('#login'))
      assert.equal(stopped, 1, 'account workspace and its polling are unmounted')
      assert.equal(auth.getToken(), null)
      assert.equal(localStorage.getItem('token'), 'new-token')
      api.defaults.adapter = () => assert.fail('A superseded tab must not send protected requests')
      await assert.rejects(api.get('/payments'), error => error.code === 'ERR_CANCELED')
    } finally { await act(async () => root.unmount()); container.remove() }
  })
}

for (const remember of [false, true]) {
  test(`logout in another tab unmounts this session and stops API access, remember=${remember}`, async () => {
    auth.saveSession({ userId: 1, role: 'Member', token: 'shared-token', refreshTokenKey: 'shared-refresh' }, 'shared-token', remember)
    let stopped = 0
    function Portal() { useEffect(() => () => { stopped++ }, []); return h('p', { id: 'portal' }, 'Account 1') }
    function Route() { return useAuth().user ? h(Portal) : h('p', { id: 'login' }, 'Đăng nhập lại') }
    const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
    try {
      await act(async () => root.render(h(AuthProvider, null, h(Route))))
      const original = globalThis.sessionStorage
      const values = new Map(['user', 'token', 'refreshTokenKey', 'loginSessionId'].map(key => [key, original.getItem(key)]))
      const remote = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }
      // Remote tab shares localStorage but owns a separate sessionStorage.
      Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: remote })
      try { auth.clearSession() }
      finally { Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: original }) }
      await act(async () => window.dispatchEvent(new window.StorageEvent('storage', { key: auth.ACTIVE_LOGIN_KEY, newValue: localStorage.getItem(auth.ACTIVE_LOGIN_KEY) })))
      assert.equal(container.querySelector('#portal'), null)
      assert.ok(container.querySelector('#login'))
      assert.equal(stopped, 1)
      assert.equal(auth.getToken(), null)
      assert.equal(auth.getRefreshTokenKey(), null)
      api.defaults.adapter = () => assert.fail('Logged-out tab sent a protected request')
      await assert.rejects(api.get('/payments'), error => error.code === 'ERR_CANCELED')
    } finally { await act(async () => root.unmount()); container.remove() }
  })
}

test('logout clears the local session before the server responds and its failure preserves a later login', async () => {
  auth.saveSession({ userId: 1, role: 'Member', token: 'old-token', refreshTokenKey: 'old-refresh' }, 'old-token', true)
  let controls, rejectLogout
  function Probe() { controls = useAuth(); return h('p', null, controls.user?.userId || 'logged-out') }
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  api.defaults.adapter = config => {
    assert.equal(config.url, '/Auth/logout')
    return new Promise((resolve, reject) => { rejectLogout = reject })
  }
  try {
    await act(async () => root.render(h(AuthProvider, null, h(Probe))))
    let pending
    await act(async () => { pending = controls.logout(); await Promise.resolve() })
    assert.equal(controls.user, null)
    assert.equal(auth.getToken(), null)
    assert.match(localStorage.getItem(auth.ACTIVE_LOGIN_KEY), /^signed-out:/)
    await act(async () => controls.login({ userId: 2, role: 'Member', token: 'new-token' }, 'new-token', true))
    await act(async () => { rejectLogout(new Error('offline')); await pending })
    assert.equal(controls.user.userId, 2)
    assert.equal(auth.getToken(), 'new-token')
  } finally { await act(async () => root.unmount()); container.remove() }
})
