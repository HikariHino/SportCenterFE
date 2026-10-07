import api from './api'

/**
 * @typedef {Object} Member
 * @property {number} memberId
 * @property {number} userId
 * @property {string} fullName
 * @property {string} email
 * @property {string} phone
 * @property {boolean} isActive
 * @property {string} dateOfBirth ISO 8601 date-time string.
 * @property {string} gender
 * @property {string} address
 * @property {string} fitnessGoal
 * @property {string} createdAt ISO 8601 date-time string.
 * @property {string} updatedAt ISO 8601 date-time string.
 */

/**
 * POST /api/members (requires authentication, returns 201 Created).
 * HTTP errors propagate with the backend body at error.response.data.
 * @param {Object} member
 * @param {string} member.email
 * @param {string} member.password
 * @param {string} member.fullName
 * @param {string} member.phone
 * @param {string} member.dateOfBirth ISO 8601 date-time string.
 * @param {string} member.gender
 * @param {string} member.address
 * @param {string} member.fitnessGoal
 * @returns {Promise<Member>}
 */
export async function createMember({ email, password, fullName, phone, dateOfBirth, gender, address, fitnessGoal }) {
  const response = await api.post('/members', {
    email,
    password,
    fullName,
    phone,
    dateOfBirth,
    gender,
    address,
    fitnessGoal,
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tạo hội viên.')
  }

  return body?.data ?? body
}

/**
 * GET /api/members (requires authentication, no parameters).
 * @returns {Promise<Array<Member>>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function getMembers() {
  const response = await api.get('/members')
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách hội viên.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

/**
 * GET /api/members/{id} (requires authentication).
 * @param {number} id Member ID (int32).
 * @returns {Promise<Member>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function getMemberById(id) {
  const response = await api.get(`/members/${id}`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải thông tin hội viên.')
  }

  return body?.data ?? body
}

/**
 * DELETE /api/members/{id} (requires authentication).
 * @param {number} id Member ID (int32).
 * Returns the complete API body; the response schema is not specified.
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function deleteMember(id) {
  const response = await api.delete(`/members/${id}`)
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể xóa hội viên.')
  }

  return body
}

/**
 * GET /api/members/me (requires authentication, no parameters).
 * @returns {Promise<Member>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function getMyMemberProfile() {
  const response = await api.get('/members/me')
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải hồ sơ hội viên của bạn.')
  }

  return body?.data ?? body
}
