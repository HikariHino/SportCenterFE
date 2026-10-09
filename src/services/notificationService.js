import api from './api'

export async function getNotifications({ unreadOnly = false, page = 1, pageSize = 6 } = {}) {
  const response = await api.get('/notifications', {
    params: { unreadOnly, page, pageSize },
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải thông báo.')
  }

  const payload = body?.data ?? body
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    total: Number(payload?.total || 0),
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
