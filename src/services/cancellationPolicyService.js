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
