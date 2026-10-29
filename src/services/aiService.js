import api from './api'
import { buildWorkoutRecommendationPayload, extractWorkoutRecommendation } from '../utils/aiWorkoutRecommendation'

/** POST /api/ai/workout-recommendations — gợi ý lịch tập cho học viên bằng AI. */
export async function getWorkoutRecommendation(input) {
  const payload = buildWorkoutRecommendationPayload(input)
  const response = await api.post('/ai/workout-recommendations', payload)
  return extractWorkoutRecommendation(response.data)
}

export function getWorkoutRecommendationError(error) {
  const body = error?.response?.data
  const validationMessage = body?.errors && Object.values(body.errors).flat().find(Boolean)
  return validationMessage || body?.message || body?.detail || error?.message || 'Không thể nhận gợi ý từ AI. Vui lòng thử lại.'
}
