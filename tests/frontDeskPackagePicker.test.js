import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { subscriptionPackageReason } from '../src/utils/memberSubscriptions.js'

let server, Select, Cards
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  const picker = await server.ssrLoadModule('/src/pages/CenterManager/FrontDeskPackagePicker.jsx')
  Select = picker.FrontDeskPackageSelect
  Cards = picker.FrontDeskPackageCards
})
after(async () => { await server?.close() })

const now = Date.parse('2026-10-31T03:00:00Z')
const basic = { id: 1, packageType: 'Standard', packageName: 'Basic', price: 300000, durationInDays: 30 }
const highest = { id: 2, packageType: 'Standard', packageName: 'Highest', price: 1000000, durationInDays: 180 }
const pt = { id: 3, packageType: 'PT', packageName: 'PT 1-1', price: 500000, durationInDays: 30 }
const active = { id: 10, packageId: 2, packageType: 'Standard', agreedPrice: 100000, status: 'Active', endDate: '2099-12-01' }

function renderPicker(subscriptions, packages = [basic, highest, pt], references = packages, extra = {}) {
  const props = { packages, selectedId: '1', onSelect() {}, disabled: false,
    reasonForPackage: pkg => subscriptionPackageReason(pkg, subscriptions, references, now), ...extra }
  const select = renderToStaticMarkup(createElement(Select, props))
  const cards = renderToStaticMarkup(createElement(Cards, props))
  const option = id => [...select.matchAll(/<option\b([^>]*)>/g)].find(match => match[1].includes(`value="${id}"`))?.[1]
  const card = id => [...cards.matchAll(/<button\b([^>]*)>/g)].find(match => match[1].includes(`data-package-id="${id}"`))?.[1]
  return { select, cards, option, card }
}

test('CenterManager cannot select a lower, equal or already active Standard even after a small upgrade surcharge', () => {
  const equal = { ...highest, id: 4 }
  const result = renderPicker([active], [basic, highest, equal, pt])
  for (const id of [1, 2, 4]) {
    assert.match(result.option(id), /disabled=""/)
    assert.match(result.card(id), /disabled=""/)
    assert.match(result.card(id), /aria-pressed="false"/)
  }
  assert.doesNotMatch(result.option(3), /disabled=/)
  assert.doesNotMatch(result.card(3), /disabled=/)
  assert.match(result.cards, /Không thể hạ gói/)
})

test('a discontinued current highest package still blocks a downgrade from the visible catalog', () => {
  const result = renderPicker([active], [basic, pt], [basic, pt, { ...highest, isActive: false }])
  assert.match(result.option(1), /disabled=""/)
  assert.match(result.card(1), /disabled=""/)
  assert.doesNotMatch(result.card(3), /disabled=/)
})

test('CenterManager can select a higher Standard and independent PT, while an expired Standard allows a new purchase', () => {
  const result = renderPicker([{ ...active, packageId: 1, agreedPrice: basic.price }])
  assert.match(result.card(1), /disabled=""/)
  for (const id of [2, 3]) {
    assert.doesNotMatch(result.option(id), /disabled=/)
    assert.doesNotMatch(result.card(id), /disabled=/)
  }
  const expired = renderPicker([{ ...active, status: 'Expired' }])
  assert.doesNotMatch(expired.card(1), /disabled=/)
})

test('unverified or busy member selection locks the dropdown and every package card', () => {
  const result = renderPicker([], [basic, highest, pt], [], { disabled: true, selectedId: '' })
  assert.match(result.select, /<select[^>]*disabled=""/)
  for (const id of [1, 2, 3]) assert.match(result.card(id), /disabled=""/)
})

test('an existing active PT blocks only its own card and does not unlock lower Standard packages', () => {
  const anotherPt = { ...pt, id: 5 }
  const result = renderPicker([active, { ...active, id: 11, packageId: 3, packageType: 'PT' }], [basic, highest, pt, anotherPt])
  assert.match(result.card(1), /disabled=""/)
  assert.match(result.option(3), /disabled=""/)
  assert.match(result.card(3), /disabled=""/)
  assert.doesNotMatch(result.card(5), /disabled=/)
})
