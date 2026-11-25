import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h, StrictMode } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

let window, server, Provider, Toggle, createRoot, changes, media
const descriptors = new Map()
before(async () => {
  window = new Window({ url: 'http://localhost:3000/' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  window.matchMedia = query => {
    if (!media.has(query)) {
      const listeners = new Set()
      media.set(query, { matches: false, addEventListener: (_, listener) => listeners.add(listener), removeEventListener: (_, listener) => listeners.delete(listener),
        change(value) { this.matches = value; listeners.forEach(listener => listener({ matches: value })) },
      })
    }
    return media.get(query)
  }
  server = await createServer({ configFile: false, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Provider = (await server.ssrLoadModule('/src/contexts/ThemeContext.jsx')).ThemeProvider
  Toggle = (await server.ssrLoadModule('/src/components/ThemeToggle.jsx')).default
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

async function screen(run, { saved = 'light', reduced = false, native = true } = {}) {
  media = new Map(); changes = []
  localStorage.clear()
  if (saved) localStorage.setItem('sportcenter-theme', saved)
  document.documentElement.dataset.theme = saved || 'light'
  window.matchMedia('(prefers-reduced-motion: reduce)').matches = reduced
  document.startViewTransition = native ? callback => {
    changes.push(document.documentElement.dataset.theme)
    const ready = Promise.resolve().then(callback)
    return { ready, finished: ready, skipTransition() {} }
  } : undefined
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  try {
    await act(async () => root.render(h(StrictMode, null, h(Provider, null, h(Toggle),
      h('input', { defaultValue: 'Draft' }), h('div', { className: 'scroll-position' }, 'Content')))))
    await run(container)
  } finally { await act(async () => root.unmount()); container.remove() }
}

test('StrictMode starts without a flash and toggles both palettes, icons, labels and saved preference', () => screen(async container => {
  const button = container.querySelector('button')
  const draft = container.querySelector('input'), scroll = container.querySelector('.scroll-position')
  draft.value = 'Unsaved profile changes'
  scroll.scrollTop = 120
  button.focus()
  assert.equal(changes.length, 0)
  assert.equal(document.documentElement.dataset.theme, 'light')
  assert.equal(button.title, 'Chuyển sang chế độ tối')
  await act(async () => button.click())
  assert.equal(document.documentElement.dataset.theme, 'dark')
  assert.equal(button.title, 'Chuyển sang chế độ sáng')
  assert.equal(container.querySelector('.theme-toggle-icon').dataset.theme, 'dark')
  assert.equal(localStorage.getItem('sportcenter-theme'), 'dark')
  await act(async () => button.click())
  assert.deepEqual(changes, ['light', 'dark'])
  assert.equal(document.documentElement.dataset.theme, 'light')
  assert.equal(document.documentElement.classList.contains('theme-transitioning'), false)
  assert.equal(localStorage.getItem('sportcenter-theme'), 'light')
  assert.equal(container.querySelector('input'), draft)
  assert.equal(draft.value, 'Unsaved profile changes')
  assert.equal(scroll.scrollTop, 120)
  assert.equal(document.activeElement, button)
}))

test('rapid clicks in the same render use the latest preference rather than a stale theme', () => screen(async container => {
  const button = container.querySelector('button')
  await act(async () => { button.click(); button.click() })
  assert.equal(document.documentElement.dataset.theme, 'light')
  assert.equal(changes.length, 0)
  await act(async () => { button.click(); button.click(); button.click() })
  assert.equal(document.documentElement.dataset.theme, 'dark')
  assert.equal(localStorage.getItem('sportcenter-theme'), 'dark')
}))

test('system and cross-tab theme changes stay synchronized with the displayed palette', () => screen(async () => {
  await act(async () => window.matchMedia('(prefers-color-scheme: dark)').change(true))
  assert.equal(document.documentElement.dataset.theme, 'dark')
  await act(async () => {
    localStorage.setItem('sportcenter-theme', 'light')
    window.dispatchEvent(new window.StorageEvent('storage', { key: 'sportcenter-theme', newValue: 'light' }))
  })
  assert.equal(document.documentElement.dataset.theme, 'light')
  await act(async () => window.matchMedia('(prefers-color-scheme: dark)').change(true))
  assert.equal(document.documentElement.dataset.theme, 'light')
}, { saved: null }))

for (const options of [{ reduced: true }, { native: false }]) {
  test(`theme switching works without animation: ${JSON.stringify(options)}`, () => screen(async container => {
    await act(async () => container.querySelector('button').click())
    assert.equal(document.documentElement.dataset.theme, 'dark')
    assert.equal(changes.length, 0)
    assert.equal(document.documentElement.classList.contains('theme-transitioning'), false)
  }, options))
}
