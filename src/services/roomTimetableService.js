import api from './api'
import { roomSessionForTimetable } from '../utils/roomTimetable.js'

async function loadAllPages(url, signal) {
  const items = []
  const seenIds = new Set()
  for (let page = 1; ; page += 1) {
    const response = await api.get(url, { params: { page, pageSize: 100 }, signal })
    const body = response.data
    if (body?.success === false) throw new Error(body.message || 'Không thể tải lịch sử dụng phòng.')
    const payload = body?.data ?? body
    const batch = Array.isArray(payload) ? payload : payload?.items
    if (!Array.isArray(batch)) throw new Error('Dữ liệu lịch phòng không hợp lệ. Vui lòng thử lại.')
    const total = Number(payload?.total ?? payload?.totalCount ?? batch.length)
    if ((payload?.page != null && Number(payload.page) !== page) || (!batch.length && items.length < total)) {
      throw new Error('Chưa tải đủ lịch sử dụng phòng. Vui lòng thử lại.')
    }
    for (const item of batch) {
      if (seenIds.has(String(item.id))) throw new Error('Dữ liệu lịch phòng bị trùng trang. Vui lòng tải lại.')
      seenIds.add(String(item.id))
      items.push(item)
    }
    if (Array.isArray(payload) || items.length >= total) return items
  }
}

export async function getRoomTimetable(room, rooms, { signal } = {}) {
  const classes = await loadAllPages('/classes/manage', signal)
  const sessions = []
  // Inspect every class: sessions may have moved away from their default room.
  // Limit concurrent requests so large catalogs do not flood the API.
  for (let offset = 0; offset < classes.length; offset += 4) {
    signal?.throwIfAborted()
    const batches = await Promise.all(classes.slice(offset, offset + 4).map(async sportClass => {
      const items = await loadAllPages(`/classes/${sportClass.id}/sessions`, signal)
      return items.map(item => roomSessionForTimetable(item, sportClass, rooms, room)).filter(Boolean)
    }))
    sessions.push(...batches.flat())
  }
  return sessions
}
