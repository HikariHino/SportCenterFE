import api from './api'

/**
 * GET /api/cancellation-policies (requires authentication, no parameters).
 * @returns {Promise<Array<{ id: number, name: string, minimumHoursBeforeStart: number, isActive: boolean }>>}
 * HTTP errors propagate with the backend body at error.response.data.
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
 * Returns the complete API body; the response schema is not specified.
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function createCancellationPolicy({ name, minimumHoursBeforeStart, isActive }) {
  const response = await api.post('/cancellation-policies', {
    name,
    minimumHoursBeforeStart,
    isActive,
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tạo chính sách hủy.')
  }

  return body
}

/**
 * PUT /api/cancellation-policies/{id} (requires authentication).
 * @param {number} id Policy ID (int32).
 * @param {{ name: string, minimumHoursBeforeStart: number, isActive: boolean }} policy
 * Returns the complete API body; the response schema is not specified.
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function updateCancellationPolicy(id, { name, minimumHoursBeforeStart, isActive }) {
  const response = await api.put(`/cancellation-policies/${id}`, {
    name,
    minimumHoursBeforeStart,
    isActive,
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể cập nhật chính sách hủy.')
  }

  return body
}
