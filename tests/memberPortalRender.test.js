import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { createServer, resolveConfig } from 'vite'

let server, Member, AuthProvider, ThemeProvider, MemoryRouter, navSections
const descriptors = new Map()
const storage = () => {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }
}

before(async () => {
  const tabStorage = storage()
  tabStorage.setItem('token', 'member-render-test')
  tabStorage.setItem('user', JSON.stringify({ id: 9, fullName: 'Nguyễn Văn An', role: 'member', email: 'member@example.com' }))
  tabStorage.setItem('loginSessionId', 'member-render-session')
  for (const [key, value] of Object.entries({
    localStorage: storage(), sessionStorage: tabStorage,
    window: { location: { search: '', pathname: '/member' }, matchMedia: () => ({ matches: false }) },
  })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' },
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  const memberModule = await server.ssrLoadModule('/src/pages/member/Member.jsx')
  Member = memberModule.default
  navSections = memberModule.memberNavSections
  AuthProvider = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  ThemeProvider = (await server.ssrLoadModule('/src/contexts/ThemeContext.jsx')).ThemeProvider
  MemoryRouter = (await server.ssrLoadModule('react-router-dom')).MemoryRouter
})

after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const renderPortal = path => renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] },
  h(ThemeProvider, null, h(AuthProvider, null, h(Member)))))

test('browser dependencies stay isolated from middleware render-test caches', async () => {
  const browserConfig = await resolveConfig({ root: fileURLToPath(new URL('../', import.meta.url)), logLevel: 'silent' }, 'serve')
  assert.notEqual(browserConfig.cacheDir, server.config.cacheDir)
})

test('the default Member route renders its navigation and profile instead of crashing', () => {
  const html = renderPortal('/member')
  assert.match(html, /Điều hướng hội viên/)
  assert.match(html, /Nguyễn Văn An/)
  assert.match(html, /member-main-content/)
})

test('the AI workout entry and shortcut are hidden, and its old URL opens the profile', () => {
  const chat = renderPortal('/member?view=ai-chat')
  assert.match(chat, /Trợ lý AI/)
  assert.doesNotMatch(chat, /Gợi ý bài tập AI/)
  const oldWorkoutUrl = renderPortal('/member?view=ai-workout')
  assert.doesNotMatch(oldWorkoutUrl, /Gợi ý bài tập AI/)
  assert.match(oldWorkoutUrl, /class="member-sidebar-item active"[^>]+>.*?Tài khoản &amp; Hồ sơ cá nhân/)
})

test('every Member navigation destination renders with one active sidebar button', () => {
  for (const item of navSections.flatMap(group => group.items)) {
    const html = renderPortal('/member?view=' + item.id)
    assert.match(html, /member-main-content/, item.id)
    const sidebar = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'))
    assert.equal((sidebar.match(/aria-current="page"/g) || []).length, 1, item.id)
    assert.ok(sidebar.includes(item.label.replaceAll('&', '&amp;')), item.id)
  }
})
