import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let server, Card
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Card = (await server.ssrLoadModule('/src/components/StaffProfileCard.jsx')).default
})
after(async () => { await server?.close() })

const profile = { userId: 3, fullName: 'Nguyễn Văn HLV', email: 'coach@example.com', status: 'Active', createdAt: '2026-10-08T18:00:00Z' }
const render = (role, props = {}) => renderToStaticMarkup(h(Card, { profile, role, ...props }))

for (const [role, badge, label] of [['Coach', 'Huấn luyện viên Olympus', 'Huấn luyện viên'], ['Receptionist', 'Lễ tân Olympus', 'Lễ tân']]) {
  test(`${role} uses its staff identity and Olympus badge without a Member QR section`, () => {
    const html = render(role)
    for (const text of [badge, label, 'Nguyễn Văn HLV', '#USR-3', 'coach@example.com', 'Đang hoạt động', 'Ngày tạo tài khoản', '09/10/2026']) assert.ok(html.includes(text), text)
    assert.doesNotMatch(html, /Thành viên Olympus|#MEM-|Thẻ hội viên điện tử|SP-OLYMPUS-|QrCode|qr-code|member-qr/)
    assert.match(html, /class="staff-profile-card-avatar" aria-hidden="true">VH</)
    assert.match(html, /staff-profile-card-status active/)
  })
}

test('inactive or locked staff accounts do not display the active badge', () => {
  for (const status of ['Inactive', 'Disabled', 'Locked']) {
    const html = render('Coach', { profile: { ...profile, status } })
    assert.match(html, /staff-profile-card-status inactive/)
    assert.doesNotMatch(html, /Đang hoạt động/)
  }
})

test('missing or invalid profile metadata remains readable without inventing a date or active state', () => {
  const html = render('Receptionist', { profile: { createdAt: 'invalid' } })
  for (const text of ['Lễ tân', 'Chưa có mã tài khoản', 'Chưa cập nhật email', 'Chưa cập nhật', 'Chưa xác định']) assert.ok(html.includes(text), text)
  assert.doesNotMatch(html, /Đang hoạt động|Invalid Date|#USR-undefined/)
})
