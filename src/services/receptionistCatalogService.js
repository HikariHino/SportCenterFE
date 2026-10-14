import api from './api'

function unwrap(body, fallback) {
  if (body?.success === false) throw new Error(body.message || fallback)
  return body?.data ?? body
}

function pageResult(payload, page, pageSize) {
  if (Array.isArray(payload)) return { items: payload, total: payload.length, page, pageSize }
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    total: Number(payload?.total || 0),
    page: Number(payload?.page || page),
    pageSize: Number(payload?.pageSize || pageSize),
  }
}

/** GET /api/class-sessions */
export async function getReceptionistClassSessions({ search, sportId, coachId, from, to, onlyAvailable = false, page = 1, pageSize = 20 } = {}) {
  const response = await api.get('/class-sessions', {
    params: { search: search || undefined, sportId, coachId, from, to, onlyAvailable, page, pageSize },
  })
  return pageResult(unwrap(response.data, 'Không thể tải danh sách buổi học.'), page, pageSize)
}

/** GET /api/class-sessions/{id}/reviews */
export async function getReceptionistSessionReviews(sessionId, { page = 1, pageSize = 8 } = {}) {
  const response = await api.get(`/class-sessions/${sessionId}/reviews`, { params: { page, pageSize } })
  return pageResult(unwrap(response.data, 'Không thể tải đánh giá của buổi học.'), page, pageSize)
}
