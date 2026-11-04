import { manualCheckIn } from './gymCheckInService'
import { getAllSupportTickets, resolveSupportTicket } from './supportTicketService'
import { getReceptionistManualCheckInValidationError } from '../utils/receptionistValidation.js'
import { getSupportResolutionValidationError } from '../utils/textLengthValidation.js'
import { canUpdateSupportTicket } from '../utils/supportTickets.js'
import { loadSchedulingPages } from './sessionSchedulingService'
import { getReceptionistSessionRoster } from './receptionistClassService'
import { markReceptionistAttendance } from './receptionistAttendanceService'
import { frontDeskCheckInReason } from '../utils/frontDeskAttendance.js'

export async function manualManagerCheckIn(form) {
  const error = getReceptionistManualCheckInValidationError(form)
  if (error) throw Object.assign(new Error(error.message), { field: error.field })
  return manualCheckIn({ ...form, memberId: typeof form.memberId === 'string' ? form.memberId.trim() : form.memberId,
    phoneNumber: form.phoneNumber?.trim() || null })
}

export async function resolveManagerSupportTicket(ticketId, form) {
  const error = getSupportResolutionValidationError(form)
  if (error) throw new Error(error)
  const ticket = (await getAllSupportTickets()).find(item => String(item.id) === String(ticketId))
  if (!ticket) throw new Error('Không tìm thấy phiếu hỗ trợ. Vui lòng tải lại danh sách.')
  if (!canUpdateSupportTicket(ticket)) throw new Error('Phiếu đã đóng và không thể cập nhật thêm.')
  return resolveSupportTicket(ticketId, form)
}

export async function markManagerAttendance({ classId, sessionId, memberId, registrationId }) {
  if (![classId, sessionId, memberId, registrationId].every(value => Number.isSafeInteger(Number(value)) && Number(value) > 0)) {
    throw new Error('Thông tin điểm danh không hợp lệ.')
  }
  const [sessions, roster] = await Promise.all([
    loadSchedulingPages(`/classes/${classId}/sessions`), getReceptionistSessionRoster(sessionId),
  ])
  const session = sessions.find(item => String(item.id) === String(sessionId))
  const student = roster.find(item => String(item.memberId) === String(memberId) && String(item.registrationId) === String(registrationId))
  if (!session || !student) throw new Error('Không tìm thấy buổi học hoặc lượt đăng ký đã chọn. Vui lòng tải lại.')
  const reason = frontDeskCheckInReason(session, student)
  if (reason) throw new Error(reason)
  return markReceptionistAttendance({ memberId, sessionId, status: 'Present' })
}
