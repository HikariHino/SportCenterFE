import api from './api'

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

export default {
  getCheckInErrorMessage,
  scanQrCheckIn,
  manualCheckIn,
  checkOutGymMember,
  getTodayCheckIns,
}
