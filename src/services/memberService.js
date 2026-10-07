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
