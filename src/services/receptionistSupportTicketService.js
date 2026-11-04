import { getAllSupportTickets, resolveSupportTicket } from './supportTicketService'
import { getSupportResolutionValidationError } from '../utils/textLengthValidation.js'
import { canUpdateSupportTicket } from '../utils/supportTickets.js'

export async function resolveReceptionistSupportTicket(ticketId, form) {
  const error = getSupportResolutionValidationError(form)
  if (error) throw new Error(error)
  const ticket = (await getAllSupportTickets()).find(item => String(item.id) === String(ticketId))
  if (!ticket) throw new Error('Không tìm thấy phiếu hỗ trợ. Vui lòng tải lại danh sách.')
  if (!canUpdateSupportTicket(ticket)) throw new Error('Phiếu đã đóng và không thể cập nhật thêm.')
  return resolveSupportTicket(ticketId, form)
}
