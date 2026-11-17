import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot
let Reports, ManagerActivity, api
const descriptors = new Map(), roles = {}, timers = new Map()
let nextTimer = 0
before(async () => {
  window = new Window({ url: 'http://localhost:3000/' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator, HTMLElement: window.HTMLElement,
    localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  window.setInterval = (callback, delay) => { const id = ++nextTimer; timers.set(id, callback); return id }
  window.clearInterval = id => timers.delete(id)
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  for (const name of ['Member', 'Manager', 'Coach', 'Receptionist']) {
    const context = await server.ssrLoadModule(`/src/contexts/${name}WorkspaceContext.jsx`)
    roles[name] = { Provider: context[`${name}WorkspaceProvider`], useResource: context[`use${name}Resource`] }
    if (name === 'Manager') ManagerActivity = context.ManagerViewActivity
  }
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  Reports = (await server.ssrLoadModule('/src/pages/CenterManager/ReportManagement.jsx')).default
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

for (const role of ['Member', 'Manager', 'Coach', 'Receptionist']) {
  for (const status of [401, 403, 404]) {
    test(`${role} pauses failed ${status} reads on timers and focus and recovers through manual retry`, async () => {
      const { Provider, useResource } = roles[role]
      let calls = 0, denied = true
      const load = async () => {
        calls++
        if (denied) throw Object.assign(new Error('Không tải được dữ liệu'), { response: { status } })
        return [{ id: 7 }]
      }
      function View() {
        const read = useResource('records', load, { initialData: [], interval: 10000, staleTime: 10000 })
        return h('div', null, read.error && h('p', { role: 'alert' }, read.error.message),
          h('span', null, read.data.length), h('button', { onClick: () => { Promise.resolve((read.reload || read.refresh)()).catch(() => {}) } }, 'Thử lại'))
      }
      const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
      try {
        await act(async () => root.render(h(Provider, { sessionKey: 'one' }, h(View))))
        assert.equal(calls, 1)
        assert.ok(container.querySelector('[role=alert]'))
        for (let tick = 0; tick < 4; tick++) await act(async () => {
          for (const callback of timers.values()) callback()
          window.dispatchEvent(new window.Event('focus'))
          document.dispatchEvent(new window.Event('visibilitychange'))
        })
        assert.equal(calls, 1)
        // Retrying a denied read must also avoid the old invalidation-triggered second request.
        await act(async () => container.querySelector('button').click())
        assert.equal(calls, 2)
        denied = false
        await act(async () => container.querySelector('button').click())
        assert.equal(calls, 3)
        assert.equal(container.querySelector('[role=alert]'), null)
        assert.equal(container.querySelector('span').textContent, '1')
      } finally {
        await act(async () => root.unmount()); container.remove()
        assert.equal(timers.size, 0)
      }
    })
  }
}

test('detailed class reports load only when opened and pause denied roster reads until deliberate retry', async () => {
  const { Provider } = roles.Manager
  const reads = []
  let denied = true
  const aggregate = [{ classId: 3, className: 'Lớp A', coachName: 'HLV A', maxCapacity: 20, totalRegistration: 9, fillRatePercentage: 45 }]
  api.defaults.adapter = async config => {
    reads.push(config.url)
    let data = []
    if (config.url === '/Reports/overview') data = { totalRevenue: 1000, totalActiveClasses: 1, totalActiveMembers: 1 }
    if (config.url === '/Reports/class-status') data = aggregate
    if (config.url === '/classes/3/sessions') data = { items: [{ id: 30, classId: 3, status: 'Scheduled' }], total: 1 }
    if (config.url.endsWith('/roster')) {
      if (denied) throw Object.assign(new Error('Bạn không có quyền xem danh sách học viên.'), { response: { status: 403 } })
      data = [{ memberId: 7, registrationStatus: 'Registered' }, { memberId: 7, registrationStatus: 'Registered' }]
    }
    return { data: { success: true, data }, status: 200, headers: {}, config }
  }
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  const render = active => act(async () => root.render(h(Provider, { sessionKey: 'reports' }, h(ManagerActivity, { active }, h(Reports)))))
  const reportReads = () => reads.filter(url => url === '/Reports/class-status').length
  const rosterReads = () => reads.filter(url => url.endsWith('/roster')).length
  const clickText = text => act(async () => {
    const button = [...container.querySelectorAll('button')].find(node => node.textContent.includes(text))
    assert.ok(button, text); button.click()
  })
  const tick = () => act(async () => { for (const callback of timers.values()) callback(); window.dispatchEvent(new window.Event('focus')) })
  try {
    await render(false); await tick()
    assert.equal(reportReads(), 0)
    assert.equal(rosterReads(), 0)
    await render(true); await tick()
    assert.equal(reportReads(), 0, 'revenue view does not read every class roster')
    await clickText('Hoạt động lớp học')
    assert.equal(rosterReads(), 1)
    assert.match(container.querySelector('.report-empty-box[role=alert]').textContent, /không có quyền/)
    await tick(); await tick()
    assert.equal(rosterReads(), 1)
    denied = false
    await clickText('Thử lại')
    assert.equal(rosterReads(), 2)
    assert.equal(container.querySelector('.report-empty-box[role=alert]'), null)
    assert.match(container.querySelector('.report-table').textContent, /1\/20|1\s*\/\s*20/)
    const before = reportReads()
    await render(false); await tick(); await tick()
    assert.equal(reportReads(), before, 'hidden reports do not poll every roster')
  } finally {
    await act(async () => root.unmount()); container.remove()
    assert.equal(timers.size, 0)
  }
})
