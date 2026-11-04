export const TRAINING_INTEGER_MAX = 2147483647

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
