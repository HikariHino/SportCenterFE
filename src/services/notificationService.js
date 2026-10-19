import api from './api'

export function getNotificationErrorMessage(error, fallback = 'Không thể xử lý thông báo. Vui lòng thử lại.') {
  const body = error?.response?.data
  return body?.message || body?.detail || error?.message || fallback
}

export async function getNotifications({ unreadOnly = false, page = 1, pageSize = 6 } = {}) {
  const response = await api.get('/notifications', {
    params: { unreadOnly, page, pageSize },
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải thông báo.')
  }

  const payload = body?.data ?? body
  if (Array.isArray(payload)) {
    const items = unreadOnly ? payload.filter(item => !item.isRead) : payload
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize }
  }
  if (!Array.isArray(payload?.items)) throw new Error('Dữ liệu thông báo không hợp lệ. Vui lòng thử lại.')
  return {
    items: payload.items,
    total: Number(payload.total ?? payload.totalCount ?? payload.items.length),
    page: Number(payload?.page || page),
    pageSize: Number(payload?.pageSize || pageSize),
  }
}

export async function markNotificationRead(notificationId) {
  const response = await api.patch(`/notifications/${notificationId}/read`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể đánh dấu thông báo đã đọc.')
  }
}
