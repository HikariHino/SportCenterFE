import { useEffect, useRef, useState } from 'react'
import { OTP_LIFETIME_MS, OTP_RESEND_WAIT_MS, otpTimeRemaining } from '../utils/otpTiming'

export default function useOtpCountdown() {
  const [deadlines, setDeadlines] = useState({ expiresAt: 0, resendAt: 0 })
  const current = useRef(deadlines)
  const [now, setNow] = useState(Date.now)
  const active = Math.max(deadlines.expiresAt, deadlines.resendAt) > now
  useEffect(() => {
    if (!active) return
    const update = () => setNow(Date.now())
    const timer = window.setInterval(update, 1000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update) }
  }, [active, deadlines])

  const start = () => {
    const sentAt = Date.now()
    const next = { expiresAt: sentAt + OTP_LIFETIME_MS, resendAt: sentAt + OTP_RESEND_WAIT_MS }
    current.current = next
    setDeadlines(next)
    setNow(sentAt)
  }
  const clear = () => {
    // Changing details invalidates the challenge without bypassing resend wait.
    const next = { ...current.current, expiresAt: 0 }
    current.current = next
    setDeadlines(next)
    setNow(Date.now())
  }
  return { ...otpTimeRemaining(deadlines, now), start, clear,
    canVerify: () => current.current.expiresAt > Date.now(),
    canResend: () => current.current.resendAt <= Date.now(),
  }
}
