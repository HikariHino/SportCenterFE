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

/**
 * PUT /api/membership-packages/{id} (requires authentication).
 * @param {number} id Membership package ID (int32).
 * @param {{ packageName: string, description: string, price: number, durationInDays: number, isActive: boolean }} membershipPackage
 * @returns {Promise<MembershipPackage>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function updateMembershipPackage(id, { packageName, description, price, durationInDays, isActive }) {
  const response = await api.put(`/membership-packages/${id}`, {
    packageName,
    description,
    price,
    durationInDays,
    isActive,
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể cập nhật gói hội viên.')
  }

  return body?.data ?? body
}

/**
 * DELETE /api/membership-packages/{id} (requires authentication).
 * @param {number} id Membership package ID (int32).
 * Returns the complete API body; the response schema is not specified.
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function deleteMembershipPackage(id) {
  const response = await api.delete(`/membership-packages/${id}`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể xóa gói hội viên.')
  }

  return body
}

/**
 * GET /api/membership-packages/manage (requires authentication, no parameters).
 * @returns {Promise<Array<MembershipPackage>>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function getMembershipPackagesForManagement() {
  const response = await api.get('/membership-packages/manage')
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách quản lý gói hội viên.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}
