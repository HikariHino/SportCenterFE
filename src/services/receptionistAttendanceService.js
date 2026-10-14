import api from './api'

export async function markReceptionistAttendance({ memberId, sessionId, status }) {
  const response = await api.post('/Attendances/mark', {
    memberId,
    sessionId,
    status,
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể điểm danh hội viên.')
  }

  return body?.data ?? body
}

export async function getReceptionistSessionAttendances(sessionId) {
  const response = await api.get(`/Attendances/session/${sessionId}`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách điểm danh.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}
