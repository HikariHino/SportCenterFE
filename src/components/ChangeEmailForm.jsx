import { useEffect, useId, useRef, useState } from 'react'
import { LoaderCircle, Mail, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getProfileErrorMessage, requestChangeEmailOtp, verifyChangeEmailOtp } from '../services/profileService'
import { changeEmailError, isChangeEmailConflict, normalizeChangeEmail } from '../utils/changeEmailValidation'
import '../style/ChangeEmailForm.css'

export default function ChangeEmailForm({ currentEmail, disabled = false }) {
  const id = useId()
  const navigate = useNavigate()
  const { endSession } = useAuth()
  const [email, setEmail] = useState('')
  const [requestedEmail, setRequestedEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [expiresAt, setExpiresAt] = useState(0)
  const [now, setNow] = useState(Date.now)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [otpError, setOtpError] = useState('')
  const [rejectedEmails, setRejectedEmails] = useState(() => new Map())
  const lock = useRef(false)
  const mounted = useRef(true)
  const otpInput = useRef(null)
  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  const resendAfter = Math.max(0, remaining - 270)
  const targetEmail = normalizeChangeEmail(requestedEmail || email)
  const emailError = changeEmailError(targetEmail, currentEmail, rejectedEmails)
  const visibleEmailError = targetEmail ? emailError : ''

  function rememberEmailConflict(err, target) {
    if (isChangeEmailConflict(err)) {
      const message = getProfileErrorMessage(err, 'Email này đã được sử dụng. Vui lòng nhập email khác.')
      setRejectedEmails(previous => new Map(previous).set(target, message))
    }
  }

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    if (!requestedEmail) return
    otpInput.current?.focus()
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [requestedEmail])

  async function sendCode(event) {
    event?.preventDefault()
    if (lock.current || disabled || resendAfter > 0) return
    const target = targetEmail
    if (emailError) {
      setError(emailError)
      return
    }
    lock.current = true
    setBusy('send')
    setError('')
    setOtpError('')
    try {
      await requestChangeEmailOtp(target)
      if (!mounted.current) return
      const sentAt = Date.now()
      setNow(sentAt)
      setExpiresAt(sentAt + 5 * 60 * 1000)
      setRequestedEmail(target)
      setOtp('')
      otpInput.current?.focus()
    } catch (err) {
      if (mounted.current) {
        rememberEmailConflict(err, target)
        setError(getProfileErrorMessage(err, 'Không thể gửi mã xác nhận. Vui lòng thử lại.'))
      }
    } finally {
      lock.current = false
      if (mounted.current) setBusy('')
    }
  }

  async function verifyCode(event) {
    event.preventDefault()
    if (lock.current || disabled || !remaining) return
    if (emailError) { setError(emailError); return }
    if (!/^\d{6}$/.test(otp)) {
      setOtpError('Mã OTP phải có 6 chữ số.')
      otpInput.current?.focus()
      return
    }
    lock.current = true
    setBusy('verify')
    setError('')
    setOtpError('')
    try {
      await verifyChangeEmailOtp(requestedEmail, otp)
      if (!mounted.current) return
      endSession()
      navigate('/login', { replace: true, state: { email: requestedEmail, message: 'Đổi email thành công. Vui lòng đăng nhập bằng email mới.' } })
    } catch (err) {
      if (mounted.current) {
        rememberEmailConflict(err, requestedEmail)
        const message = getProfileErrorMessage(err, 'Không thể xác nhận email. Vui lòng kiểm tra mã OTP.')
        const status = Number(err.response?.data?.statusCode || err.response?.status)
        if (!isChangeEmailConflict(err) && [400, 422].includes(status)) {
          setOtpError(message)
          window.requestAnimationFrame(() => { if (mounted.current) otpInput.current?.focus() })
        } else setError(message)
      }
    } finally {
      lock.current = false
      if (mounted.current) setBusy('')
    }
  }

  return <section className="account-email-change" aria-labelledby={`${id}-title`}>
    <header><Mail size={19} /><div><h3 id={`${id}-title`}>Thay đổi email</h3><p>Email hiện tại: <strong>{currentEmail}</strong></p></div></header>
    <p>Mã xác nhận sẽ được gửi đến email mới và có hiệu lực trong 5 phút. Sau khi xác nhận, bạn sẽ đăng nhập lại bằng email mới.</p>
    <form onSubmit={requestedEmail ? verifyCode : sendCode} aria-busy={Boolean(busy)}>
      <label htmlFor={`${id}-email`}>Email mới</label>
      <input id={`${id}-email`} type="email" autoComplete="email" maxLength={254} required value={requestedEmail || email} readOnly={Boolean(requestedEmail)} disabled={disabled || Boolean(busy)} aria-invalid={Boolean(visibleEmailError)} aria-describedby={visibleEmailError ? `${id}-email-error` : undefined} onChange={event => { setEmail(event.target.value); setError('') }} placeholder="Nhập email mới" />
      {visibleEmailError && <p id={`${id}-email-error`} className="account-email-error" role="alert">{visibleEmailError}</p>}
      {requestedEmail && <>
        <p className="account-email-sent" role="status"><ShieldCheck size={16} /> Đã gửi mã đến {requestedEmail}. Kiểm tra cả thư mục spam.</p>
        <label htmlFor={`${id}-otp`}>Mã xác nhận OTP</label>
        <input ref={otpInput} id={`${id}-otp`} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} minLength={6} required value={otp} disabled={disabled || Boolean(busy) || !remaining} aria-invalid={Boolean(otpError)} aria-describedby={otpError ? `${id}-otp-error` : undefined} onChange={event => { setOtp(event.target.value.replace(/\D/g, '')); setOtpError(''); setError('') }} placeholder="6 chữ số" />
        {otpError && <p id={`${id}-otp-error`} className="account-email-error" role="alert">{otpError}</p>}
        <small>{remaining ? `Mã còn hiệu lực ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : 'Mã đã hết hạn. Vui lòng gửi lại mã mới.'}</small>
      </>}
      {error && !visibleEmailError && <p className="account-email-error" role="alert">{error}</p>}
      <footer>
        {requestedEmail && <>
          <button type="button" disabled={disabled || Boolean(busy)} onClick={() => { setRequestedEmail(''); setExpiresAt(0); setOtp(''); setOtpError(''); setError('') }}>Dùng email khác</button>
          <button type="button" disabled={disabled || Boolean(busy) || Boolean(emailError) || resendAfter > 0} onClick={sendCode}>{resendAfter ? `Gửi lại sau ${resendAfter}s` : 'Gửi lại mã'}</button>
        </>}
        <button type="submit" className="account-email-primary" disabled={disabled || Boolean(busy) || Boolean(emailError) || Boolean(requestedEmail && (!remaining || otp.length !== 6))}>
          {busy && <LoaderCircle size={16} className="account-email-spin" />}
          {busy === 'send' ? 'Đang gửi mã...' : busy === 'verify' ? 'Đang xác nhận...' : requestedEmail ? 'Xác nhận đổi email' : 'Gửi mã xác nhận'}
        </button>
      </footer>
    </form>
  </section>
}
