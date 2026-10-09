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
