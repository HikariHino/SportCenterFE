export const OTP_LENGTH = 6
export const OTP_PATTERN = '[0-9]{6}'
export const OTP_FORMAT_MESSAGE = 'Mã OTP phải gồm đúng 6 chữ số.'

export const normalizeOtp = value => typeof value === 'string' ? value.trim() : ''

export function getOtpValidationError(value) {
  const otp = normalizeOtp(value)
  if (!otp) return 'Vui lòng nhập mã OTP.'
  return /^[0-9]{6}$/.test(otp) ? '' : OTP_FORMAT_MESSAGE
}
