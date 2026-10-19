import api from './api'
import { getSessionRoom } from '../utils/roomTimetable.js'
import { assertSessionSchedule } from '../utils/sessionScheduling.js'

export async function loadSchedulingPages(url, signal) {
  const items = [], seen = new Set()
  for (let page = 1; ; page += 1) {
    const response = await api.get(url, { params: { page, pageSize: 100 }, signal })
    const body = response.data
    if (body?.success === false) throw new Error(body.message || 'Không thể tải lịch buổi học.')
    const payload = body?.data ?? body
    const batch = Array.isArray(payload) ? payload : payload?.items
    const total = Number(payload?.total ?? payload?.totalCount ?? batch?.length)
    if (!Array.isArray(batch) || !Number.isFinite(total) || total < 0 || (payload?.page != null && Number(payload.page) !== page) || (!batch.length && items.length < total)) throw new Error('Chưa tải đủ lịch buổi học để kiểm tra. Vui lòng thử lại.')
    for (const item of batch) {
      if (item.id == null || seen.has(String(item.id))) throw new Error('Dữ liệu lịch bị thiếu mã hoặc trùng trang. Vui lòng tải lại.')
      seen.add(String(item.id)); items.push(item)
    }
    if (Array.isArray(payload) || items.length >= total) return items
  }
}

export async function loadClassTimetables(signal) {
  const classes = await loadSchedulingPages('/classes/manage', signal)
  const groups = []
  for (let offset = 0; offset < classes.length; offset += 4) {
    signal?.throwIfAborted()
    groups.push(...await Promise.all(classes.slice(offset, offset + 4).map(async sportClass => ({ sportClass, items: await loadSchedulingPages(`/classes/${sportClass.id}/sessions`, signal) }))))
  }
  return groups
}

export async function loadSchedulingContext(classId, roomId, sessionId) {
  const [groups, classResponse, roomResponse] = await Promise.all([loadClassTimetables(), api.get(`/classes/${classId}`), api.get('/Rooms')])
  for (const response of [classResponse, roomResponse]) if (response.data?.success === false) throw new Error(response.data.message || 'Không thể kiểm tra thông tin phòng và lớp.')
  const sportClass = classResponse.data?.data ?? classResponse.data
  const rooms = roomResponse.data?.data ?? roomResponse.data
  if (!sportClass || String(sportClass.id) !== String(classId) || !Array.isArray(rooms)) throw new Error('Thông tin phòng hoặc lớp không hợp lệ. Vui lòng tải lại.')
  const group = groups.find(item => String(item.sportClass.id) === String(classId))
  if (!group) throw new Error('Lớp không còn trong danh sách quản lý. Vui lòng tải lại.')
  group.sportClass = sportClass
  const current = sessionId == null ? undefined : group.items.find(item => String(item.id) === String(sessionId))
  if (sessionId != null && !current) throw new Error('Không tìm thấy buổi học cần cập nhật. Vui lòng tải lại lịch.')
  const assigned = getSessionRoom(current || {}, sportClass, rooms)
  const room = rooms.find(item => roomId != null && roomId !== '' ? String(item.id) === String(roomId) : assigned?.id != null ? String(item.id) === String(assigned.id) : item.name?.trim().toLowerCase() === assigned?.name?.trim().toLowerCase())
  return { groups, sportClass, rooms, room, current }
}

export async function validateSessionWrite(classId, data, sessionId) {
  const context = await loadSchedulingContext(classId, data.roomId, sessionId)
  assertSessionSchedule({ ...context, data })
  return context
}

// Serialize session writes in this client so two submits cannot both pass the
// same preflight before either write is saved. Each queued write reads fresh data.
let pendingWrite = Promise.resolve()
export function withSessionWriteLock(write) {
  const next = pendingWrite.then(write, write)
  pendingWrite = next.catch(() => {})
  return next
}
