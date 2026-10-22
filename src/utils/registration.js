import { getAuthErrorMessage } from './auth.js'

export function getRegistrationError(error, fallback) {
  const body = error?.response?.data
  const details = body?.errors
  const messages = [
    body?.message, body?.detail, typeof body === 'string' ? body : null, error?.message,
    ...(Array.isArray(details) ? details : details && typeof details === 'object' ? Object.values(details).flat() : [details]),
  ].filter(value => typeof value === 'string')
  const duplicateEmail = /^(?:(?:SportsCenterAPI\.Helpers\.)?BusinessException:\s*)?Email (?:is )?already (?:registered|exists)\.?\s*$/im
  if (error?.field === 'email' || messages.some(value => duplicateEmail.test(value.trim()))) {
    return { field: 'email', message: 'Email này đã được đăng ký. Vui lòng dùng email khác hoặc đăng nhập.' }
  }
  const status = Number(error?.response?.status || body?.statusCode)
  return {
    field: null,
    message: status >= 500 ? 'Máy chủ gặp sự cố. Vui lòng thử lại sau.' : getAuthErrorMessage(error ?? {}, fallback),
  }
}

// Called only after a successful HTTP response. Registration endpoints can
// return a direct response or an ApiResponse wrapper without a success flag.
export function getRegistrationResult(body, fallback) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(fallback)
  }
  if (body.success === false || Number(body.statusCode) >= 400) {
    const { field, message } = getRegistrationError({ response: { data: body, status: body.statusCode } }, fallback)
    throw Object.assign(new Error(message), { field })
  }

  return { ...body, success: true, data: body.data ?? body }
}
