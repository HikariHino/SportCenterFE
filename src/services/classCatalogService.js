import api from './api'
import { getManagerFormTextError } from '../utils/managerFormValidation.js'
import { getCoachReviews } from './coachReviewService'

/**
 * GET /api/sports returns the public list of active sports.
 * @returns {Promise<Array<{ id: number, name: string, description: string|null, imageUrl: string|null }>>}
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
 * @returns {Promise<{ id: number, name: string, description: string|null, imageUrl: string|null, isActive: boolean }>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function createSport({ name, description, isActive }) {
  const error = getManagerFormTextError('sport', { name, description })
  if (error) throw new Error(error)
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
 * @returns {Promise<{ id: number, name: string, description: string|null, imageUrl: string|null, isActive: boolean }>}
 * HTTP errors propagate with the backend body at error.response.data.
 */
export async function updateSport(id, { name, description, isActive }) {
  const error = getManagerFormTextError('sport', { name, description })
  if (error) throw new Error(error)
  const response = await api.put(`/sports/${id}`, {
    name,
    description,
    isActive,
  })
  const body = response.data

  if (body?.success === false || Number(body?.statusCode) >= 400) {
    throw new Error(body.message || 'Không thể cập nhật môn thể thao.')
  }

  const sport = body?.data ?? body
  if (String(sport?.id) !== String(id) || typeof sport.name !== 'string' || !sport.name.trim() || typeof sport.isActive !== 'boolean') {
    throw new Error('Không xác nhận được thay đổi. Hãy tải lại danh mục bộ môn để kiểm tra.')
  }
  return sport
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

/** Read the server's CoachReviews summary, including ratings outside the visible page. */
export async function getCoachRatingSummary(coachId, { signal } = {}) {
  const data = await getCoachReviews(coachId, { pageSize: 1, signal })
  return { averageRating: data.reviewCount ? data.averageRating : null, reviewCount: data.reviewCount }
}

/** PUT /api/coaches/{id}/profile */
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
