import api from './api'

export async function registerMemberForSession(sessionId, memberId) {
  const response = await api.post(`/class-sessions/${sessionId}/registrations/members/${memberId}`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể đăng ký buổi học cho hội viên.')
  }

  return body?.data ?? body
}

export async function getReceptionistSessionRoster(sessionId) {
  const response = await api.get(`/class-sessions/${sessionId}/roster`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách học viên của buổi học.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

export async function completeReceptionistSession(sessionId) {
  const response = await api.post(`/class-sessions/${sessionId}/complete`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể hoàn thành buổi học.')
  }

  return body
}

export async function getReceptionistMemberRegistrations(memberId, { page = 1, pageSize = 20 } = {}) {
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
  const response = await api.post(`/class-registrations/${registrationId}/cancel`, { reason })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể hủy lượt đăng ký.')
  }

  return body?.data ?? body
}
