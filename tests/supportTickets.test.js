import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canUpdateSupportTicket, supportTicketStatus } from '../src/utils/supportTickets.js'

test('closed support tickets are read-only regardless of status casing or whitespace', () => {
  for (const status of ['Closed', 'closed', ' CLOSED ']) {
    assert.equal(supportTicketStatus({ status }), 'closed')
    assert.equal(canUpdateSupportTicket({ status }), false)
  }
})

test('active and resolved support tickets can still be updated', () => {
  for (const status of ['Open', 'InProgress', 'Resolved']) {
    assert.equal(canUpdateSupportTicket({ status }), true)
  }
})
