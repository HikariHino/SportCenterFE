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
