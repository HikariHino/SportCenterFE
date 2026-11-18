import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

let window, server, createRoot, Provider, Control, AuthProvider, Router, api, writes
const descriptors = new Map(), views = {}
const key = 'sportcenter-font-size'
const user = { userId: 4, fullName: 'Nguyễn Văn An', email: 'test@example.com', role: 'coach' }

before(async () => {
  window = new Window({ url: 'http://localhost:3000/coach' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ configFile: false, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Provider = (await server.ssrLoadModule('/src/contexts/FontSizeContext.jsx')).FontSizeProvider
  Control = (await server.ssrLoadModule('/src/components/FontSizeControl.jsx')).default
  AuthProvider = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  Router = (await server.ssrLoadModule('react-router-dom')).MemoryRouter
  views.Coach = (await server.ssrLoadModule('/src/pages/Coach/ProfileView.jsx')).CoachProfileView
  views.Receptionist = (await server.ssrLoadModule('/src/pages/Receptionist/ProfileView.jsx')).ReceptionistProfileView
  views.Member = (await server.ssrLoadModule('/src/pages/member/MemberViews.jsx')).ProfileView
  views.Manager = (await server.ssrLoadModule('/src/pages/CenterManager/ProfileView.jsx')).default
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    if (config.method !== 'get') writes.push(config.url)
    const profile = { ...user, phoneNumber: '0912345678', createdAt: '2026-10-01T00:00:00Z' }
    const data = config.url === '/profile' ? profile : config.url === '/members/me' ? { ...profile, memberId: 9 } : []
    return { data: { success: true, data }, status: 200, headers: {}, config }
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

async function screen(children, run) {
  writes = []
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    const content = children.type === Control ? children : h(Router, null, h(AuthProvider, null, children))
    await act(async () => root.render(h(Provider, null, content)))
    await run(container)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
}
const choose = (container, value) => act(async () => container.querySelector(`[aria-label="Cỡ chữ ${value}"]`).click())

test('the current largest size is default, changes synchronize controls and persist after remount', async () => {
  localStorage.removeItem(key)
  await screen(h('div', null, h(Control), h(Control)), async container => {
    assert.equal(document.documentElement.dataset.fontSize, 'large')
    assert.equal(container.querySelectorAll('[aria-label="Cỡ chữ lớn"][aria-pressed=true]').length, 2)
    await choose(container, 'nhỏ')
    assert.equal(document.documentElement.dataset.fontSize, 'small')
    assert.equal(localStorage.getItem(key), 'small')
    assert.equal(container.querySelectorAll('[aria-label="Cỡ chữ nhỏ"][aria-pressed=true]').length, 2)
  })
  await screen(h(Control), async container => {
    assert.equal(document.documentElement.dataset.fontSize, 'small')
    await choose(container, 'vừa')
    assert.equal(document.documentElement.dataset.fontSize, 'medium')
    await choose(container, 'lớn')
    assert.equal(document.documentElement.dataset.fontSize, 'large')
    assert.equal(container.querySelectorAll('button').length, 3)
  })
})

test('storage changes sync tabs and unknown or cleared preferences use the largest size', async () => {
  localStorage.setItem(key, 'oversized')
  await screen(h(Control), async () => {
    assert.equal(document.documentElement.dataset.fontSize, 'large')
    await act(async () => {
      localStorage.setItem(key, 'medium')
      window.dispatchEvent(new window.StorageEvent('storage', { key }))
    })
    assert.equal(document.documentElement.dataset.fontSize, 'medium')
    await act(async () => {
      localStorage.clear()
      window.dispatchEvent(new window.StorageEvent('storage', { key: null }))
    })
    assert.equal(document.documentElement.dataset.fontSize, 'large')
  })
})

test('font choices still work when browser storage is blocked', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem() { throw new Error('Storage blocked') }, setItem() { throw new Error('Storage blocked') },
  } })
  try {
    await screen(h(Control), async container => {
      assert.equal(document.documentElement.dataset.fontSize, 'large')
      await choose(container, 'nhỏ')
      assert.equal(document.documentElement.dataset.fontSize, 'small')
    })
  } finally { Object.defineProperty(globalThis, 'localStorage', descriptor) }
})

for (const role of ['Coach', 'Receptionist', 'Member', 'Manager']) {
  test(`${role} profile exposes font settings without entering edit mode or writing profile data`, async () => {
    localStorage.setItem(key, 'large')
    await screen(h(views[role], { user, showNotice() {} }), async container => {
      assert.ok(container.querySelector('.font-size-settings'), role)
      assert.equal(container.querySelector('form'), null)
      await choose(container, 'nhỏ')
      assert.equal(document.documentElement.dataset.fontSize, 'small')
      assert.deepEqual(writes, [])
    })
  })
}

test('saved font size is applied before the React entry point loads', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  for (const saved of ['small', 'medium', 'large', null, 'oversized']) {
    const document = { documentElement: { dataset: {}, style: {} } }
    runInNewContext(bootstrap, { document, window: { matchMedia: () => ({ matches: false }) }, localStorage: { getItem: value => value === key ? saved : 'light' } })
    assert.equal(document.documentElement.dataset.fontSize, ['small', 'medium', 'large'].includes(saved) ? saved : 'large')
  }
})
