import { getAuthErrorMessage } from './auth.js'

// Called only after a successful HTTP response. Registration endpoints can
// return a direct response or an ApiResponse wrapper without a success flag.
export function getRegistrationResult(body, fallback) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(fallback)
  }
  if (body.success === false || Number(body.statusCode) >= 400) {
    throw new Error(getAuthErrorMessage({ response: { data: body, status: body.statusCode } }, fallback))
  }

  return { ...body, success: true, data: body.data ?? body }
}
