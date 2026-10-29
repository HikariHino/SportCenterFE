export function supportTicketStatus(ticket) {
  return String(ticket?.status || '').trim().toLowerCase()
}

export function canUpdateSupportTicket(ticket) {
  return supportTicketStatus(ticket) !== 'closed'
}
