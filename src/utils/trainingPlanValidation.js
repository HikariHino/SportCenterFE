import { getBackendIdValidationError } from './numberValidation.js'
import { getTextLengthValidationError, TRAINING_PLAN_NAME_MAX_LENGTH } from './textLengthValidation.js'

export const TRAINING_INTEGER_MAX = 2147483647
export const TRAINING_GOALS = [
  ['WeightLoss', 'Giảm cân'], ['MuscleGain', 'Tăng cơ'], ['Endurance', 'Tăng sức bền'],
  ['Flexibility', 'Cải thiện độ dẻo'], ['GeneralFitness', 'Thể lực tổng quát'],
]

function validPlanDate(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime())
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,7})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/.test(value)) return false
  const key = value.slice(0, 10), parsed = Date.parse(key + 'T00:00:00Z')
  return Number(key.slice(0, 4)) >= 1 && Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === key && Number.isFinite(Date.parse(value))
}

export function getTrainingPlanValidationError({ planName, goal, memberId, startDate, endDate }) {
  if (typeof planName !== 'string' || !planName.trim()) return 'Vui lòng nhập tên giáo án, không chỉ gồm khoảng trắng.'
  const nameError = getTextLengthValidationError(planName, 'Tên giáo án', TRAINING_PLAN_NAME_MAX_LENGTH)
  if (nameError) return nameError
  if (!TRAINING_GOALS.some(([value]) => value === goal)) return 'Vui lòng chọn mục tiêu giáo án hợp lệ.'
  const memberError = getBackendIdValidationError(memberId, 'Mã hội viên')
  if (memberError) return memberError
  if (!validPlanDate(startDate) || !validPlanDate(endDate)) return 'Thời gian giáo án không hợp lệ.'
  if (new Date(endDate).getTime() < new Date(startDate).getTime()) return 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu giáo án.'
  return ''
}

export const isTrainingPositiveInteger = value => ['string', 'number'].includes(typeof value)
  && String(value).trim() !== '' && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= TRAINING_INTEGER_MAX

export function getTrainingExercisesValidationError(exercises) {
  if (!Array.isArray(exercises)) return 'Danh sách bài tập không hợp lệ.'
  for (let index = 0; index < exercises.length; index += 1) {
    const exercise = exercises[index]
    if (!exercise || typeof exercise !== 'object') return `Bài tập ${index + 1} không hợp lệ.`
    for (const [field, label] of [['exerciseId', 'Mã bài tập'], ['sets', 'Số hiệp'], ['reps', 'Số lần'], ['durationInMinutes', 'Thời lượng (phút)']]) {
      const value = exercise[field]
      if (field === 'durationInMinutes' && (value == null || (typeof value === 'string' && !value.trim()))) continue
      if (!isTrainingPositiveInteger(value)) return `Bài tập ${index + 1}: ${label} phải là số nguyên dương không vượt quá ${TRAINING_INTEGER_MAX}.`
    }
  }
  return ''
}
