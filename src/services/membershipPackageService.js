import api from './api'

/**
 * @typedef {Object} MembershipPackage
 * @property {number} id
 * @property {string} packageName
 * @property {string} description
 * @property {number} price
 * @property {number} durationInDays
 * @property {boolean} isActive
 */

/**
 * GET /api/membership-packages (requires authentication, no parameters).
 * @returns {Promise<Array<MembershipPackage>>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function getMembershipPackages() {
  const response = await api.get('/membership-packages')
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách gói hội viên.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}
