import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Mail, MessageCircle, ShieldCheck, Trophy } from 'lucide-react'

import ThemeToggle from '../components/ThemeToggle'
import { requestResetPassword, verifyResetPassword } from '../services/authService'
import { getAuthErrorMessage } from '../utils/auth'
import '../style/Login.css'

function Brand() {
  return <Link to="/" className="login-brand"><span className="login-brand-icon"><Trophy size={26} /></span><span><strong>SportPulse</strong><small>Trung tâm Thể thao Olympus</small></span></Link>
}

export default function ForgotPassword() {
  const navigate = useNavigate()
  const submitting = useRef(false)
  const [email, setEmail] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  async function sendOtp(targetEmail) {
    const result = await requestResetPassword({ email: targetEmail })
    if (!result?.success) throw new Error(getAuthErrorMessage({ response: { data: result } }, 'Không thể gửi mã OTP.'))
    setEmail(targetEmail)
    setOtpRequested(true)
    setMessage(result.message || `Mã OTP đã được gửi đến ${targetEmail}.`)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting.current) return
    const form = event.currentTarget
    const data = new FormData(form)
    const targetEmail = (data.get('email') || email).trim()

    if (otpRequested && data.get('newPassword') !== data.get('confirmPassword')) {
      form.elements.namedItem('confirmPassword')?.focus()
      setMessage('Mật khẩu xác nhận chưa khớp. Vui lòng nhập lại.')
      return
    }

    submitting.current = true
    setIsSubmitting(true)
    setMessage('')
    try {
      if (!otpRequested) {
        await sendOtp(targetEmail)
        return
      }

      const result = await verifyResetPassword({
        email,
        otp: data.get('otp').trim(),
        newPassword: data.get('newPassword'),
        confirmPassword: data.get('confirmPassword'),
      })
      if (!result?.success) throw new Error(getAuthErrorMessage({ response: { data: result } }, 'Không thể đặt lại mật khẩu.'))
      navigate('/login', { replace: true, state: { message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' } })
    } catch (error) {
      setMessage(getAuthErrorMessage(error, otpRequested ? 'Không thể đặt lại mật khẩu. Vui lòng kiểm tra mã OTP.' : 'Không thể gửi mã OTP. Vui lòng thử lại.'))
    } finally {
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  async function handleResend() {
    if (submitting.current) return
    submitting.current = true
    setIsSubmitting(true)
    setMessage('')
    try {
      await sendOtp(email)
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Không thể gửi lại mã OTP. Vui lòng thử lại.'))
    } finally {
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  return <main className="login-page">
    <aside className="login-hero">
      <div><Brand /><div className="login-intro"><span className="login-badge"><i /> Khôi phục tài khoản an toàn</span><h1>Lấy lại quyền truy cập chỉ trong vài phút</h1><p>SportPulse xác minh email bằng mã OTP trước khi cho phép thiết lập mật khẩu mới, giúp bảo vệ tài khoản của bạn.</p></div></div>
      <div className="login-features">
        <div className="login-feature"><span><Mail size={21} /></span><h2>Nhận OTP qua email</h2><p>Mã xác minh được gửi đến địa chỉ đã đăng ký</p></div>
        <div className="login-feature"><span><ShieldCheck size={21} /></span><h2>Xác minh bảo mật</h2><p>Chỉ chủ tài khoản mới có thể đổi mật khẩu</p></div>
        <div className="login-feature"><span><KeyRound size={21} /></span><h2>Mật khẩu mới</h2><p>Khôi phục quyền truy cập ngay sau khi xác minh</p></div>
      </div>
    </aside>

    <section className="login-panel" aria-labelledby="reset-title">
      <div className="login-topbar"><ThemeToggle /><div className="login-mobile-brand"><Brand /></div><Link to="/login" className="login-back"><ArrowLeft size={16} /> Về trang đăng nhập</Link></div>
      <div className="login-content login-reset-content">
        <header><h2 id="reset-title">{otpRequested ? 'Xác minh và đặt mật khẩu mới' : 'Quên mật khẩu?'}</h2><p>{otpRequested ? <>Mã OTP đã được gửi đến <strong>{email}</strong>.</> : 'Nhập email tài khoản để nhận mã OTP khôi phục mật khẩu.'}</p></header>
        <form onSubmit={handleSubmit} className="login-form" aria-busy={isSubmitting} onChange={() => setMessage('')}>
          {!otpRequested && <div><label htmlFor="reset-email">Email</label><div className="login-input"><Mail size={19} /><input id="reset-email" name="email" type="email" autoComplete="email" placeholder="name@olympus.vn" required /></div></div>}
          {otpRequested && <>
            <div><label htmlFor="reset-otp">Mã OTP</label><div className="login-input"><MessageCircle size={19} /><input id="reset-otp" name="otp" inputMode="numeric" autoComplete="one-time-code" placeholder="Nhập mã OTP" required /></div></div>
            <div><label htmlFor="reset-password">Mật khẩu mới</label><div className="login-input"><LockKeyhole size={19} /><input id="reset-password" name="newPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} placeholder="Tối thiểu 8 ký tự" required /><button type="button" className="login-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></div></div>
            <div><label htmlFor="reset-confirm-password">Xác nhận mật khẩu mới</label><div className="login-input"><LockKeyhole size={19} /><input id="reset-confirm-password" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} placeholder="Nhập lại mật khẩu mới" required /></div></div>
          </>}
          <button className="login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang xử lý...' : otpRequested ? 'Đặt lại mật khẩu' : 'Gửi mã OTP'} <ArrowRight size={19} /></button>
          {otpRequested && <div className="reset-actions"><button type="button" className="login-text-button" onClick={handleResend} disabled={isSubmitting}>Gửi lại mã OTP</button><button type="button" className="login-text-button" onClick={() => { setOtpRequested(false); setMessage('') }}>Dùng email khác</button></div>}
        </form>
        <p className="login-feedback" role="status" aria-live="polite">{message}</p>
        <div className="login-register">Đã nhớ mật khẩu? <Link className="login-text-button" to="/login">Đăng nhập ngay</Link></div>
      </div>
      <div className="login-support"><span><ShieldCheck size={18} /> Mã OTP không nên được chia sẻ với bất kỳ ai</span><a href="tel:19008899">Hotline: <strong>1900 8899</strong></a></div>
    </section>
  </main>
}
