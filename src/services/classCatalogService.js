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

/**
 * POST /api/sports (requires authentication).
 * @param {{ name: string, description: string, isActive: boolean }} sport
 * @returns {Promise<{ id: number, name: string, description: string, isActive: boolean }>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function createSport({ name, description, isActive }) {
  const response = await api.post('/sports', {
    name,
    description,
    isActive,
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tạo môn thể thao.')
  }

  return body?.data ?? body
}

/**
 * PUT /api/sports/{id} (requires authentication).
 * @param {number} id Sport ID (int32).
 * @param {{ name: string, description: string, isActive: boolean }} sport
 * @returns {Promise<{ id: number, name: string, description: string, isActive: boolean }>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function updateSport(id, { name, description, isActive }) {
  const response = await api.put(`/sports/${id}`, {
    name,
    description,
    isActive,
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể cập nhật môn thể thao.')
  }

  return body?.data ?? body
}

/**
 * GET /api/coaches (requires authentication, no parameters).
 * @returns {Promise<Array<{ id: number, fullName: string, specialization: string, bio: string, yearsOfExperience: number }>>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function getCoaches() {
  const response = await api.get('/coaches')
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể tải danh sách huấn luyện viên.')
  }

  const payload = body?.data ?? body
  return Array.isArray(payload) ? payload : []
}

/**
 * PUT /api/coaches/{id}/profile (requires authentication).
 * @param {number} id Coach ID (int32).
 * @param {{ specialization: string, bio: string, yearsOfExperience: number }} profile
 * @returns {Promise<{ id: number, specialization: string, bio: string, yearsOfExperience: number }>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function updateCoachProfile(id, { specialization, bio, yearsOfExperience }) {
  const response = await api.put(`/coaches/${id}/profile`, {
    specialization,
    bio,
    yearsOfExperience,
  })
  const body = response.data

  if (body?.success === false) {
    throw new Error(body.message || 'Không thể cập nhật hồ sơ huấn luyện viên.')
  }

  return body?.data ?? body
}
