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

/**
 * POST /api/membership-packages (requires authentication).
 * @param {{ packageName: string, description: string, price: number, durationInDays: number }} membershipPackage
 * @returns {Promise<MembershipPackage>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function createMembershipPackage({ packageName, description, price, durationInDays }) {
  const response = await api.post('/membership-packages', {
    packageName,
    description,
    price,
    durationInDays,
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tạo gói hội viên.')
  }

  return body?.data ?? body
}

/**
 * GET /api/membership-packages/{id} (requires authentication).
 * @param {number} id Membership package ID (int32).
 * @returns {Promise<MembershipPackage>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function getMembershipPackageById(id) {
  const response = await api.get(`/membership-packages/${id}`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải thông tin gói hội viên.')
  }

  return body?.data ?? body
}
