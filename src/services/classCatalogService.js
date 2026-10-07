import api from './api'

/**
 * GET /api/sports (requires authentication, no parameters).
 * @returns {Promise<Array<{ id: number, name: string, description: string }>>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function getSports() {
  const response = await api.get('/sports')
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách môn thể thao.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}
