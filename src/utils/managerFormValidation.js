import { getTextLengthValidationError } from './textLengthValidation.js'
import { isIntegerInRange, isNumericInput } from './numberValidation.js'

export const PACKAGE_PRICE_MIN = 0.01
export const PACKAGE_PRICE_MAX = '9999999999999999.99'

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

export function getManagerFormValidationError(kind, values) {
  const textError = getManagerFormTextError(kind, values)
  if (textError) return textError
  const name = kind === 'package' ? values.packageName : values.name
  if (typeof name !== 'string' || !name.trim()) return 'Vui lòng nhập tên, không chỉ gồm khoảng trắng.'
  if (kind === 'room' && !isIntegerInRange(values.capacity, 1, 500)) return 'Sức chứa phòng phải là số nguyên từ 1 đến 500.'
  if (kind === 'policy' && !isIntegerInRange(values.minimumHoursBeforeStart, 2, 720)) return 'Thời gian hủy tối thiểu phải là số nguyên từ 2 đến 720 giờ.'
  if (kind === 'package') {
    const price = Number(values.price)
    // The decimal maximum rounds up to 10^16 as a JS number, outside BE's range.
    if (!isNumericInput(values.price) || price < PACKAGE_PRICE_MIN || price >= Number(PACKAGE_PRICE_MAX)
      || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) return 'Giá gói phải từ 0,01 đến 9.999.999.999.999.999,99 và có tối đa hai chữ số thập phân.'
    if (!isIntegerInRange(values.durationInDays, 1, 36500)) return 'Thời hạn gói phải là số nguyên từ 1 đến 36500 ngày.'
  }
  return ''
}
