import api from './api'
import { getAllClassSessions, getSessionRoster } from './sportClassService'

const normalizedStatus = value => String(value ?? '').trim().toLowerCase().replace(/[\s_-]/g, '')
const cancelledStatus = value => ['cancelled', 'canceled'].includes(normalizedStatus(value))

// Keep report reads bounded even when a class has many sessions.
async function readReportItems(items, read) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await read(items[index])
    }
  }))
  return results
}

/**
 * Trích xuất thông báo lỗi từ backend
 */
export function getReportErrorMessage(error, fallback = 'Có lỗi xảy ra khi tải dữ liệu báo cáo.') {
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
 * Lấy tổng quan các chỉ số Dashboard: Hội viên, Lớp học, Doanh thu tổng, Doanh thu tháng này
 * GET /api/Reports/overview
 */
export async function getDashboardOverview() {
  const response = await api.get('/Reports/overview')
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải dữ liệu tổng quan báo cáo.')
  }

  return body?.data ?? body
}

/**
 * Lấy dữ liệu doanh thu 12 tháng theo năm
 * GET /api/Reports/revenue?year={year}
 * @param {number} [year]
 */
export async function getRevenueByYear(year) {
  const params = year ? { year } : {}
  const response = await api.get('/Reports/revenue', { params })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải báo cáo doanh thu.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

/**
 * Lấy báo cáo lớp học, đếm hội viên duy nhất thay vì cộng lượt đăng ký các buổi.
 * GET /api/Reports/class-status
 */
export async function getClassStatusReport({ signal } = {}) {
  const response = await api.get('/Reports/class-status', { signal })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải báo cáo tình trạng lớp học.')
  }

  const payload = body?.data ?? body
  if (!Array.isArray(payload)) throw new Error('Dữ liệu báo cáo lớp học không hợp lệ. Vui lòng thử lại.')

  const groups = await readReportItems(payload, async report => {
    const classId = Number(report?.classId)
    const capacity = Number(report?.maxCapacity)
    if (!Number.isSafeInteger(classId) || classId <= 0 || !Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new Error('Chưa xác định được lớp học hoặc sức chứa để thống kê sĩ số.')
    }
    const sessions = await getAllClassSessions(classId, { signal })
    if (sessions.some(session => !Number.isSafeInteger(Number(session.id)) || Number(session.id) <= 0
      || (session.classId != null && Number(session.classId) !== classId)
      || !normalizedStatus(session.status ?? session.Status))) {
      throw new Error('Dữ liệu buổi học không hợp lệ để thống kê sĩ số. Vui lòng thử lại.')
    }
    return {
      report,
      capacity,
      members: new Set(),
      sessions: sessions.filter(session => !cancelledStatus(session.status ?? session.Status)),
    }
  })

  const jobs = groups.flatMap(group => group.sessions.map(session => ({ group, session })))
  await readReportItems(jobs, async ({ group, session }) => {
    const roster = await getSessionRoster(session.id, { signal })
    for (const student of roster) {
      const status = normalizedStatus(student?.registrationStatus ?? student?.status)
      if (cancelledStatus(status) || status === 'pending') continue
      if (!['registered', 'confirmed', 'booked', 'attended', 'completed', 'checkedin', 'present', 'late', 'absent', 'noshow', 'excused'].includes(status)
        || !Number.isSafeInteger(Number(student?.memberId)) || Number(student.memberId) <= 0) {
        throw new Error('Chưa xác định được hội viên hoặc trạng thái đăng ký để thống kê sĩ số.')
      }
      // One member can have several registrations in one class, including
      // cancelled/rebooked entries. Registration IDs are not student IDs.
      group.members.add(String(Number(student.memberId)))
    }
  })

  return groups.map(({ report, capacity, members }) => ({
    ...report,
    totalRegistration: members.size,
    fillRatePercentage: Math.round((members.size / capacity) * 1000) / 10,
  }))
}

/**
 * Lấy danh sách giao dịch / thanh toán gần đây cho Quản lý
 * GET /api/payments
 */
export async function getPaymentsReport() {
  const response = await api.get('/payments')
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải lịch sử giao dịch.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

/**
 * Xuất file PDF hóa đơn thanh toán thông qua QuestPDF backend
 * GET /api/payments/{id}/export-pdf
 * @param {number} paymentId
 * @returns {Promise<Blob>}
 */
export async function exportInvoicePdf(paymentId) {
  const response = await api.get(`/payments/${paymentId}/export-pdf`, {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Tải file blob về máy người dùng
 * @param {Blob} blob
 * @param {string} filename
 */
export function triggerBlobDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export default {
  getReportErrorMessage,
  getDashboardOverview,
  getRevenueByYear,
  getClassStatusReport,
  getPaymentsReport,
  exportInvoicePdf,
  triggerBlobDownload,
}
