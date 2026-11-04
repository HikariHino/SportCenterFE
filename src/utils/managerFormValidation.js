import { getTextLengthValidationError } from './textLengthValidation.js'

export const MANAGER_FORM_LIMITS = {
  room: { name: 100, roomType: 50, location: 100 },
  package: { packageName: 200, description: 2000 },
  sport: { name: 120, description: 2000 },
  policy: { name: 120 },
}
const labels = { name: 'Tên', roomType: 'Loại phòng', location: 'Vị trí', packageName: 'Tên gói', description: 'Mô tả' }

export function getManagerFormTextError(kind, values) {
  for (const [field, max] of Object.entries(MANAGER_FORM_LIMITS[kind])) {
    const error = getTextLengthValidationError(values[field], labels[field], max)
    if (error) return error
  }
  return ''
}
