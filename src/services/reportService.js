import api from './api'

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
 * Lấy báo cáo tình trạng lớp học và tỷ lệ lấp đầy
 * GET /api/Reports/class-status
 */
export async function getClassStatusReport() {
  const response = await api.get('/Reports/class-status')
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải báo cáo tình trạng lớp học.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
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
