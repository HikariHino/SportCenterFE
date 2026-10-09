import api from './api'

export async function getMyCoachSessions({ from, to, page = 1, pageSize = 100 }) {
  const response = await api.get('/class-sessions/mine', {
    params: { from, to, page, pageSize },
  })

  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải lịch huấn luyện.')
  }

  const payload = body?.data ?? body
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    total: Number(payload?.total || 0),
  }
}

export async function getCoachSessionRoster(sessionId) {
  const response = await api.get(`/class-sessions/${sessionId}/roster`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải học viên của buổi huấn luyện.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

export async function getCoachSessionAttendances(sessionId) {
  const response = await api.get(`/Attendances/session/${sessionId}`)
  const body = response.data
  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

export async function markCoachAttendance({ memberId, sessionId, status }) {
  const response = await api.post('/Attendances/mark', {
    memberId,
    sessionId,
    status,
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể cập nhật trạng thái điểm danh.')
  }

  return body?.data ?? body
}

export async function completeCoachSession(sessionId) {
  const response = await api.post(`/class-sessions/${sessionId}/complete`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể hoàn thành buổi huấn luyện.')
  }

  return body?.data ?? body
}

export async function checkInCoachRegistration(registrationId) {
  const response = await api.post(`/class-registrations/${registrationId}/check-in`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể điểm danh học viên.')
  }

  return body?.data ?? body
}
