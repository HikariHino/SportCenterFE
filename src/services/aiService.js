import api from './api'
import { buildWorkoutRecommendationPayload, extractWorkoutRecommendation } from '../utils/aiWorkoutRecommendation'

export const AI_WORKOUT_TIMEOUT_MS = 35000

/** POST /api/ai/workout-recommendations — gợi ý lịch tập cho học viên bằng AI. */
export async function getWorkoutRecommendation(input, { signal } = {}) {
  const payload = buildWorkoutRecommendationPayload(input)
  const response = await api.post('/ai/workout-recommendations', payload, {
    signal,
    timeout: AI_WORKOUT_TIMEOUT_MS,
  })
  return extractWorkoutRecommendation(response.data)
}

export function getWorkoutRecommendationError(error) {
  if (error?.code === 'ERR_CANCELED') return 'Đã dừng tạo giáo án bằng AI.'
  if (error?.code === 'ECONNABORTED') return 'AI phản hồi quá 35 giây. Vui lòng thử lại.'
  const body = error?.response?.data
  const validationMessage = body?.errors && Object.values(body.errors).flat().find(Boolean)
  return validationMessage || body?.message || body?.detail || error?.message || 'Không thể nhận gợi ý từ AI. Vui lòng thử lại.'
}
