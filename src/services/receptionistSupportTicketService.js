import { resolveSupportTicket } from './supportTicketService'
import { getSupportResolutionValidationError } from '../utils/textLengthValidation.js'

export async function resolveReceptionistSupportTicket(ticketId, form) {
  const error = getSupportResolutionValidationError(form)
  if (error) throw new Error(error)
  return resolveSupportTicket(ticketId, form)
}
