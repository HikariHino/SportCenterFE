import api from './api'
import { getAllListPages } from '../utils/listPagination.js'
import { isCancelledSession } from '../utils/sessionScheduling.js'

// Read the center-wide endpoint, including full and completed sessions and
// sessions whose parent class is no longer open for registration.
export async function getCenterTimetable({ signal } = {}) {
  const sessions = await getAllListPages(async (page, pageSize) => {
    const response = await api.get('/class-sessions', { params: { page, pageSize, onlyAvailable: false }, signal })
    const body = response.data
    if (body?.success === false || Number(body?.statusCode) >= 400) throw new Error(body.message || 'Không thể tải thời khóa biểu trung tâm.')
    const data = body?.data ?? body
    const items = Array.isArray(data) ? data : data?.items
    const total = Number(data?.total ?? data?.totalCount ?? items?.length)
    if (!Array.isArray(items) || !Number.isSafeInteger(total) || total < items.length
      || (data?.page != null && Number(data.page) !== page)
      || items.some(item => !item || !Number.isSafeInteger(Number(item.id)) || Number(item.id) <= 0
        || !Number.isFinite(Date.parse(item.startsAt)) || !Number.isFinite(Date.parse(item.endsAt)))) {
      throw new Error('Dữ liệu thời khóa biểu không hợp lệ. Vui lòng tải lại.')
    }
    return { items, total }
  })
  return sessions.filter(item => !isCancelledSession(item) && !isCancelledSession({ status: item.sessionStatus }))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
}
