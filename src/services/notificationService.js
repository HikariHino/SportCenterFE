import api from './api'
import { isSessionUpdateNotification } from '../utils/sessionNotifications.js'

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

export async function getAllUnreadNotifications() {
  const ids = new Set()
  const items = []
  for (let page = 1; ; page += 1) {
    const result = await getNotifications({ unreadOnly: true, page, pageSize: 100 })
    if (result.page !== page || !Number.isInteger(result.total) || result.total < 0
      || (result.items.length === 0 && items.length < result.total)) {
      throw new Error('Chưa tải đủ thông báo chưa đọc. Vui lòng thử lại.')
    }
    for (const item of result.items) {
      if (item.id == null || ids.has(String(item.id))) throw new Error('Danh sách thông báo đã thay đổi. Vui lòng thử lại.')
      ids.add(String(item.id))
      items.push(item)
    }
    if (items.length >= result.total) return items
  }
}

export async function markAllNotificationsRead() {
  // Collect every unread page before writing: marking a page changes the list.
  const unread = await getAllUnreadNotifications()
  const pending = unread.filter(item => !isSessionUpdateNotification(item)).map(item => String(item.id))
  const result = { total: pending.length, read: 0, failed: [], requiresReview: unread.length - pending.length }
  for (let offset = 0; offset < pending.length; offset += 4) {
    const batch = pending.slice(offset, offset + 4)
    const responses = await Promise.allSettled(batch.map(markNotificationRead))
    responses.forEach((response, index) => {
      if (response.status === 'fulfilled') result.read += 1
      else result.failed.push({ id: batch[index], message: getNotificationErrorMessage(response.reason) })
    })
  }
  return result
}
