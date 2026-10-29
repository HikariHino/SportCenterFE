import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canUseCoachDemo, getCoachPlanDemoStudent, isCoachDemoLocation } from '../src/utils/coachDemoAccess.js'

test('Coach demo access is restricted to the explicit development URL', () => {
  assert.equal(canUseCoachDemo('?demo=coach', true), true)
  assert.equal(canUseCoachDemo('?demo=coach', false), false)
  assert.equal(canUseCoachDemo('?demo=member', true), false)
  assert.equal(canUseCoachDemo('', true), false)
})

test('only the Coach demo location can suppress development auth redirects', () => {
  assert.equal(isCoachDemoLocation({ pathname: '/coach', search: '?demo=coach' }, true), true)
  assert.equal(isCoachDemoLocation({ pathname: '/coach', search: '?demo=coach' }, false), false)
  assert.equal(isCoachDemoLocation({ pathname: '/member', search: '?demo=coach' }, true), false)
})

test('AI plan preview creates a demo student only for the explicit development URL', () => {
  assert.deepEqual(getCoachPlanDemoStudent('?demo=coach&planDemo=ai', true), {
    memberId: 'DEMO', name: 'Học viên Demo', isDemo: true,
  })
  assert.equal(getCoachPlanDemoStudent('?demo=coach&planDemo=ai', false), null)
  assert.equal(getCoachPlanDemoStudent('?demo=coach', true), null)
})
