import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearPortalPage, readPortalPage, storePortalPage } from '../src/utils/portalNavigation.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

test('portal navigation restores only a valid saved page', () => {
  const storage = memoryStorage()
  storePortalPage(storage, 'coach:active-nav', 'Học viên')
  assert.equal(readPortalPage(storage, 'coach:active-nav', ['Tổng quan', 'Học viên'], 'Tổng quan'), 'Học viên')

  storePortalPage(storage, 'coach:active-nav', 'Trang không tồn tại')
  assert.equal(readPortalPage(storage, 'coach:active-nav', ['Tổng quan', 'Học viên'], 'Tổng quan'), 'Tổng quan')
})

test('portal navigation falls back when storage is unavailable and clears on logout', () => {
  const blockedStorage = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
    removeItem: () => { throw new Error('blocked') },
  }
  assert.equal(readPortalPage(blockedStorage, 'member:active-nav', ['profile'], 'profile'), 'profile')
  assert.doesNotThrow(() => storePortalPage(blockedStorage, 'member:active-nav', 'profile'))
  assert.doesNotThrow(() => clearPortalPage(blockedStorage, 'member:active-nav'))

  const storage = memoryStorage()
  storePortalPage(storage, 'member:active-nav', 'payments')
  clearPortalPage(storage, 'member:active-nav')
  assert.equal(readPortalPage(storage, 'member:active-nav', ['profile', 'payments'], 'profile'), 'profile')
})
