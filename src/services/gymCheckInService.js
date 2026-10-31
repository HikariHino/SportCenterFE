import api from './api'
import { filterGymHistoryDates, gymHistoryParams, gymTimestamp, summarizeGymHistory } from '../utils/gymCheckInHistory.js'

function readHistoryArray(body, summary = false) {
  if (body?.success === false || Number(body?.statusCode) >= 400) throw new Error(body.message || 'Không thể tải lịch sử check-in.')
  const items = body?.data ?? body
  if (!Array.isArray(items) || items.some(item => !item || !Number.isSafeInteger(Number(summary ? item.memberId : item.id))
    || Number(summary ? item.memberId : item.id) <= 0 || !Number.isFinite(gymTimestamp(summary ? item.lastCheckInTime : item.checkInTime))
    || (summary && (!Number.isFinite(Number(item.totalCheckIns)) || Number(item.totalCheckIns) < 0
      || !Number.isFinite(Number(item.totalDurationMinutes)) || Number(item.totalDurationMinutes) < 0)))) {
    throw new Error('Dữ liệu lịch sử ra/vào không hợp lệ. Vui lòng thử lại sau.')
  }
  return items
}

async function requestGymHistory(url, params, signal) {
  try { return await api.get(url, { params, signal }) }
  catch (error) {
    if (error.response?.status !== 404) throw error
    const unavailable = new Error('Máy chủ đang kết nối chưa được cập nhật chức năng lịch sử check-in mới. Vui lòng thử lại sau khi bản BE mới được triển khai.')
    unavailable.code = 'GYM_HISTORY_UNAVAILABLE'
    throw unavailable
  }
}

/** Manager/Receptionist history, filtered by Vietnam calendar dates. */
export async function getGymCheckInHistory(filters = {}, { signal } = {}) {
  const params = gymHistoryParams(filters)
  const response = await requestGymHistory('/GymCheckIns/history', params, signal)
  return filterGymHistoryDates(readHistoryArray(response.data), filters)
}

export async function getGymCheckInSummaryByMember(filters = {}, { signal } = {}) {
  const { fromDate, toDate, search } = gymHistoryParams({ fromDate: filters.fromDate, toDate: filters.toDate, search: filters.search })
  const request = requestGymHistory('/GymCheckIns/summary-by-member', { fromDate, toDate, search }, signal)
  if (!filters.fromDate && !filters.toDate) return readHistoryArray((await request).data, true)
  // The summary endpoint also rounds to UTC days. Reconcile its range with
  // detailed records to prevent counting visits outside the selected VN dates.
  const [response, items] = await Promise.all([request, getGymCheckInHistory({ fromDate: filters.fromDate, toDate: filters.toDate, search: filters.search }, { signal })])
  readHistoryArray(response.data, true)
  return summarizeGymHistory(items)
}

/**
 * Trích xuất lỗi từ backend cho Check-in
 */
export function getCheckInErrorMessage(error, fallback = 'Có lỗi xảy ra khi thực hiện check-in.') {
  const body = error?.response?.data
  const validationErrors = body?.errors
  if (validationErrors && typeof validationErrors === 'object') {
    const firstKey = Object.keys(validationErrors)[0]
    if (firstKey && Array.isArray(validationErrors[firstKey])) {
      return validationErrors[firstKey][0]
    }
  }
  return body?.message || error?.message || fallback
}

/**
 * Quét mã QR check-in tại quầy
 * POST /api/GymCheckIns/scan-qr
 * @param {{ qrCode: string, notes?: string }} payload
 */
export async function scanQrCheckIn({ qrCode, notes }) {
  const response = await api.post('/GymCheckIns/scan-qr', {
    qrCode: qrCode.trim(),
    notes: notes || null,
  })
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể check-in bằng mã QR.')
  }
  return body?.data ?? body
}

/**
 * Check-in thủ công qua MemberId hoặc Số điện thoại
 * POST /api/GymCheckIns/check-in
 * @param {{ memberId?: number, phoneNumber?: string, notes?: string }} payload
 */
export async function manualCheckIn({ memberId, phoneNumber, notes }) {
  const response = await api.post('/GymCheckIns/check-in', {
    memberId: memberId ? Number(memberId) : null,
    phoneNumber: phoneNumber ? phoneNumber.trim() : null,
    notes: notes || null,
  })
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể thực hiện check-in.')
  }
  return body?.data ?? body
}

/**
 * Check-out khi khách ra về
 * PUT /api/GymCheckIns/{id}/check-out
 * @param {number} checkInId
 */
export async function checkOutGymMember(checkInId) {
  const response = await api.put(`/GymCheckIns/${checkInId}/check-out`)
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể check-out khách.')
  }
  return body?.data ?? body
}

/**
 * Lấy danh sách lượt check-in hôm nay
 * GET /api/GymCheckIns/today
 * @returns {Promise<Array<{ id: number, memberId: number, memberCode: string, memberName: string, phoneNumber: string, packageName: string, checkInTime: string, checkOutTime: string|null, checkedByStaffName: string|null, notes: string|null }>>}
 */
export async function getTodayCheckIns() {
  const response = await api.get('/GymCheckIns/today')
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách check-in hôm nay.')
  }
  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

/**
 * Hội viên lấy mã thẻ QR của chính mình
 * GET /api/GymCheckIns/my-qr
 * @returns {Promise<{ memberId: number, memberCode: string, qrData: string, fullName: string, phoneNumber: string, packageName?: string, packageStatus: string, expireDate?: string }>}
 */
export async function getMyQrCode({ signal } = {}) {
  const response = await api.get('/GymCheckIns/my-qr', { signal })
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Không thể lấy mã QR hội viên.')
  }
  return body?.data ?? body
}

/**
 * Hội viên xem lịch sử ra/vào phòng gym của mình
 * GET /api/GymCheckIns/my-history
 * @returns {Promise<Array<{ id: number, memberId: number, memberCode: string, memberName: string, phoneNumber: string, packageName: string, checkInTime: string, checkOutTime: string|null, checkedByStaffName: string|null, notes: string|null }>>}
 */
export async function getMyGymCheckInHistory(filters = {}, { signal } = {}) {
  const params = gymHistoryParams({ fromDate: filters.fromDate, toDate: filters.toDate })
  const response = await api.get('/GymCheckIns/my-history', { params, signal })
  return filterGymHistoryDates(readHistoryArray(response.data), filters)
}

export default {
  getCheckInErrorMessage,
  scanQrCheckIn,
  manualCheckIn,
  checkOutGymMember,
  getTodayCheckIns,
  getMyQrCode,
  getMyGymCheckInHistory,
  getGymCheckInHistory,
  getGymCheckInSummaryByMember,
}

