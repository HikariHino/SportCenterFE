import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server, api, service, Field
const descriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: { port: 0 } }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/membershipPackageService.js')
  Field = (await server.ssrLoadModule('/src/pages/CenterManager/PackageManagement.jsx')).PackageTypeField
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

test('create and edit send the selected packageType even when names or benefits suggest another type', async () => {
  for (const packageType of ['Standard', 'PT']) {
    const posts = []
    api.defaults.adapter = async config => {
      const body = JSON.parse(config.data)
      posts.push({ method: config.method, url: config.url, body })
      return { data: { success: true, data: { id: 7, ...body } }, status: 200, headers: {}, config }
    }
    const pkg = { packageName: packageType === 'PT' ? 'Gói Basic' : 'Gói tặng 2 buổi PT', description: 'Huấn luyện viên 1-1', price: 600000, durationInDays: 30, packageType }
    assert.equal((await service.createMembershipPackage(pkg)).packageType, packageType)
    assert.equal((await service.updateMembershipPackage(7, { ...pkg, isActive: true })).packageType, packageType)
    assert.deepEqual(posts, [
      { method: 'post', url: '/membership-packages', body: pkg },
      { method: 'put', url: '/membership-packages/7', body: { ...pkg, isActive: true } },
    ])
  }
})

test('invalid package types never reach the API and omitted types preserve legacy BE detection', async () => {
  const calls = []
  api.defaults.adapter = async config => { calls.push(JSON.parse(config.data)); return { data: {}, status: 200, headers: {}, config } }
  const pkg = { packageName: 'Basic', price: 600000, durationInDays: 30 }
  for (const packageType of ['', 'Yoga', 'standard']) {
    await assert.rejects(service.createMembershipPackage({ ...pkg, packageType }), /Loại gói/)
    await assert.rejects(service.updateMembershipPackage(7, { ...pkg, packageType }), /Loại gói/)
  }
  assert.equal(calls.length, 0)
  await service.createMembershipPackage(pkg)
  assert.equal(Object.hasOwn(calls[0], 'packageType'), false)
})

test('the required select renders both types and preserves the selected value for create and edit', () => {
  for (const value of ['Standard', 'PT']) {
    const html = renderToStaticMarkup(createElement(Field, { id: 'package-type', value, onChange: () => {}, disabled: false }))
    assert.match(html, /<label for="package-type">Loại gói/)
    assert.match(html, /name="packageType"[^>]*required=""/)
    assert.match(html, new RegExp('<option value="' + value + '" selected=""'))
    assert.match(html, /Gói tập chung \/ cơ bản/)
    assert.match(html, /Gói tập kèm HLV 1-1/)
  }
})
