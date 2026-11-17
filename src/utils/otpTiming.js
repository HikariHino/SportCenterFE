export const OTP_LIFETIME_MS = 5 * 60 * 1000
export const OTP_RESEND_WAIT_MS = 30 * 1000

export function otpTimeRemaining({ expiresAt, resendAt }, now = Date.now()) {
  return { remaining: Math.max(0, Math.ceil((expiresAt - now) / 1000)), resendRemaining: Math.max(0, Math.ceil((resendAt - now) / 1000)) }
}

export const formatOtpRemaining = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
