import api from './api'

function packageTypeFields(packageType) {
  if (packageType == null) return {}
  if (!['Standard', 'PT'].includes(packageType)) throw new Error('Loại gói phải là Standard hoặc PT.')
  return { packageType }
}

/**
 * Trích xuất thông báo lỗi từ backend
 */
export function getPackageErrorMessage(error, fallback = 'Có lỗi xảy ra khi thao tác với gói hội viên.') {
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
 * @typedef {Object} MembershipPackage
 * @property {number} id
 * @property {string} packageName
 * @property {string} description
 * @property {'Standard'|'PT'} packageType
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
export async function createMembershipPackage({ packageName, description, price, durationInDays, packageType }) {
  const response = await api.post('/membership-packages', {
    packageName,
    description,
    price,
    durationInDays,
    ...packageTypeFields(packageType),
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
export async function updateMembershipPackage(id, { packageName, description, price, durationInDays, isActive, packageType }) {
  const response = await api.put(`/membership-packages/${id}`, {
    packageName,
    description,
    price,
    durationInDays,
    isActive,
    ...packageTypeFields(packageType),
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

/**
 * GET /api/membership-packages/manage/{id} (requires authentication).
 * @param {number} id Membership package ID (int32).
 * @returns {Promise<MembershipPackage>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function getMembershipPackageForManagementById(id) {
  const response = await api.get(`/membership-packages/manage/${id}`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải thông tin quản lý gói hội viên.')
  }

  return body?.data ?? body
}
