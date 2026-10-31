import api from './api'

export async function markReceptionistAttendance({ memberId, sessionId, status }) {
  if (![memberId, sessionId].every(value => Number.isSafeInteger(Number(value)) && Number(value) > 0)
    || !['Present', 'Absent', 'Late', 'Excused'].includes(status)) throw new Error('Thông tin điểm danh không hợp lệ.')
  const response = await api.post('/Attendances/mark', {
    memberId: Number(memberId),
    sessionId: Number(sessionId),
    status,
  })
  const body = response.data

  if (body?.success === false || Number(body?.statusCode) >= 400) {
    throw new Error(body.message || 'Không thể điểm danh hội viên.')
  }

  const attendance = body?.data ?? body
  if (String(attendance?.memberId) !== String(memberId) || String(attendance?.sessionId) !== String(sessionId) || attendance?.status !== status) {
    throw new Error('Chưa xác nhận được đúng học viên và buổi học đã điểm danh. Vui lòng tải lại danh sách.')
  }
  return attendance
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
