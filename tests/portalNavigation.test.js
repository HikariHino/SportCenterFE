import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPortalView, getPortalViewSearch } from '../src/utils/portalNavigation.js'

const managerViews = ['overview', 'users', 'classes', 'rooms', 'packages', 'cancellation', 'reports', 'frontdesk']
const memberViews = ['profile', 'subscriptions', 'payments', 'checkin', 'classes', 'training-plans', 'support', 'notifications']

test('each portal restores its selected page from the URL after a reload', () => {
  for (const [views, fallback] of [[managerViews, 'overview'], [memberViews, 'profile']]) {
    for (const view of views) {
      const search = getPortalViewSearch('', view, views).toString()
      assert.equal(getPortalView(search, views, fallback), view)
    }
  }
})

test('missing or invalid pages use the portal default and cannot open a different portal page', () => {
  for (const search of ['', 'view=', 'view=unknown', 'view=payments', 'view=https%3A%2F%2Fexample.com']) {
    assert.equal(getPortalView(search, managerViews, 'overview'), 'overview')
  }
  assert.equal(getPortalView('view=reports', memberViews, 'profile'), 'profile')
  assert.equal(getPortalViewSearch('view=rooms', 'payments', managerViews), null)
})

test('changing page preserves other query parameters without modifying the old history entry', () => {
  const original = new URLSearchParams('view=rooms&filter=active&filter=mine')
  const changed = getPortalViewSearch(original, 'packages', managerViews)
  assert.equal(original.get('view'), 'rooms')
  assert.equal(changed.get('view'), 'packages')
  assert.deepEqual(changed.getAll('filter'), ['active', 'mine'])
})

test('payment-return navigation still opens the requested page and a selected URL takes precedence on reload', () => {
  assert.equal(getPortalView('', memberViews, 'profile', 'payments'), 'payments')
  assert.equal(getPortalView('', memberViews, 'profile', 'subscriptions'), 'subscriptions')
  assert.equal(getPortalView('', memberViews, 'profile', 'reports'), 'profile')
  assert.equal(getPortalView('view=classes', memberViews, 'profile', 'payments'), 'classes')
  assert.equal(getPortalView('view=unknown', memberViews, 'profile', 'payments'), 'profile')
})
