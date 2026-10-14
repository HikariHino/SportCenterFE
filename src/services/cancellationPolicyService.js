import api from './api'

/**
 * Trích xuất thông báo lỗi từ backend
 */
export function getPolicyErrorMessage(error, fallback = 'Có lỗi xảy ra khi thao tác với chính sách hủy lịch.') {
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
 * GET /api/cancellation-policies (requires authentication, no parameters).
 * @returns {Promise<Array<{ id: number, name: string, minimumHoursBeforeStart: number, isActive: boolean }>>}
 */
export async function getCancellationPolicies() {
  const response = await api.get('/cancellation-policies')
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách chính sách hủy.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

/**
 * POST /api/cancellation-policies (requires authentication).
 * @param {{ name: string, minimumHoursBeforeStart: number, isActive: boolean }} policy
 */
export async function createCancellationPolicy({ name, minimumHoursBeforeStart, isActive }) {
  const response = await api.post('/cancellation-policies', {
    name: name.trim(),
    minimumHoursBeforeStart: Number(minimumHoursBeforeStart),
    isActive: isActive !== false,
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tạo chính sách hủy.')
  }

  return body?.data ?? body
}

/**
 * PUT /api/cancellation-policies/{id} (requires authentication).
 * @param {number} id Policy ID (int32).
 * @param {{ name: string, minimumHoursBeforeStart: number, isActive: boolean }} policy
 */
export async function updateCancellationPolicy(id, { name, minimumHoursBeforeStart, isActive }) {
  const response = await api.put(`/cancellation-policies/${id}`, {
    name: name.trim(),
    minimumHoursBeforeStart: Number(minimumHoursBeforeStart),
    isActive: isActive !== false,
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể cập nhật chính sách hủy.')
  }

  return body?.data ?? body
}

export default {
  getPolicyErrorMessage,
  getCancellationPolicies,
  createCancellationPolicy,
  updateCancellationPolicy,
}
