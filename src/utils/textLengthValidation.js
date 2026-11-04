export const SUPPORT_RESOLUTION_MAX_LENGTH = 2000
export const TRAINING_PLAN_NAME_MAX_LENGTH = 150
export const EXERCISE_NOTES_MAX_LENGTH = 500

export function getTextLengthValidationError(value, label, maxLength) {
  if (value == null) return ''
  if (typeof value !== 'string') return `${label} không hợp lệ.`
  return value.length > maxLength ? `${label} không được vượt quá ${maxLength} ký tự.` : ''
}

export function getSupportResolutionValidationError({ resolutionNote } = {}) {
  return getTextLengthValidationError(resolutionNote, 'Ghi chú phản hồi', SUPPORT_RESOLUTION_MAX_LENGTH)
}
