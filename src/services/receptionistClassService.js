import api from './api'
import { getBackendIdValidationError } from '../utils/numberValidation.js'
import { CANCELLATION_REASON_MAX_LENGTH, getTextLengthValidationError } from '../utils/textLengthValidation.js'

export async function registerMemberForSession(sessionId, memberId) {
  const error = getBackendIdValidationError(sessionId, 'Mã buổi học') || getBackendIdValidationError(memberId, 'Mã hội viên')
  if (error) throw new Error(error)
  const response = await api.post(`/class-sessions/${sessionId}/registrations/members/${memberId}`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể đăng ký buổi học cho hội viên.')
  }

  return body?.data ?? body
}

export async function getReceptionistSessionRoster(sessionId, signal) {
  const error = getBackendIdValidationError(sessionId, 'Mã buổi học')
  if (error) throw new Error(error)
  const response = await api.get(`/class-sessions/${sessionId}/roster`, { signal })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách học viên của buổi học.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

export async function completeReceptionistSession(sessionId) {
  const error = getBackendIdValidationError(sessionId, 'Mã buổi học')
  if (error) throw new Error(error)
  const response = await api.post(`/class-sessions/${sessionId}/complete`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể hoàn thành buổi học.')
  }

  return body
}

export async function getReceptionistMemberRegistrations(memberId, { page = 1, pageSize = 20 } = {}) {
  const error = getBackendIdValidationError(memberId, 'Mã hội viên')
  if (error) throw new Error(error)
  const response = await api.get(`/class-registrations/members/${memberId}`, {
    params: { page, pageSize },
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải các lượt đăng ký của hội viên.')
  }

  const payload = body?.data ?? body
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    total: Number(payload?.total || 0),
    page: Number(payload?.page || page),
    pageSize: Number(payload?.pageSize || pageSize),
  }
}

export async function cancelReceptionistRegistration(registrationId, reason) {
  const error = getBackendIdValidationError(registrationId, 'Mã đăng ký')
    || getTextLengthValidationError(reason, 'Lý do hủy', CANCELLATION_REASON_MAX_LENGTH)
  if (error) throw new Error(error)
  if (typeof reason !== 'string' || !reason.trim()) throw new Error('Vui lòng nhập lý do hủy.')
  const response = await api.post(`/class-registrations/${registrationId}/cancel`, { reason })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể hủy lượt đăng ký.')
  }

  return body?.data ?? body
}

export async function checkInReceptionistRegistration(registrationId) {
  const error = getBackendIdValidationError(registrationId, 'Mã đăng ký')
  if (error) throw new Error(error)
  const response = await api.post(`/class-registrations/${registrationId}/check-in`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể check-in hội viên.')
  }

  return body?.data ?? body
}
