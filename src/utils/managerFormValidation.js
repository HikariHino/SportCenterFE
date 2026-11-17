import { getTextLengthValidationError } from './textLengthValidation.js'
import { isIntegerInRange, isNumericInput } from './numberValidation.js'

export const PACKAGE_PRICE_MIN = 0.01
export const PACKAGE_PRICE_MAX = '90071992547409.91'

function priceInCents(value) {
  const text = String(value).trim()
  if (text.length > 32 || !/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  return BigInt(whole || '0') * 100n + BigInt(fraction.padEnd(2, '0'))
}

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
    const cents = isNumericInput(values.price) ? priceInCents(values.price) : null
    // Validate the original decimal before Number/JSON can round it. Both the
    // minor-unit calculation and the serialized amount must retain its value.
    if (cents == null || cents < 1n || cents > BigInt(Number.MAX_SAFE_INTEGER)
      || !Number.isSafeInteger(Math.round(price * 100)) || BigInt(Math.round(price * 100)) !== cents || priceInCents(String(price)) !== cents) {
      return 'Giá gói phải từ 0,01 đến 90.071.992.547.409,91, có tối đa hai chữ số thập phân và giữ nguyên giá trị khi lưu. Vui lòng nhập số tiền nhỏ hơn nếu vượt giới hạn chính xác.'
    }
    if (!isIntegerInRange(values.durationInDays, 1, 36500)) return 'Thời hạn gói phải là số nguyên từ 1 đến 36500 ngày.'
  }
  return ''
}
