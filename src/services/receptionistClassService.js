import api from './api'

export async function registerMemberForSession(sessionId, memberId) {
  const response = await api.post(`/class-sessions/${sessionId}/registrations/members/${memberId}`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể đăng ký buổi học cho hội viên.')
  }

  return body?.data ?? body
}
