import ThemeToggle from '../components/ThemeToggle'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, CreditCard, Eye, EyeOff, LockKeyhole, Mail, Phone, ShieldCheck, Trophy, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { login as loginApi } from '../services/authService'
import { getAuthDestination, getLoginErrorMessage } from '../utils/auth'
import '../style/Login.css'

const features = [
  [CalendarDays, 'Đặt sân 30s', 'Khóa lịch tức thì không độ trễ'],
  [Trophy, 'Lịch tập thông minh', 'Nhắc nhở tự động qua tin nhắn'],
  [CreditCard, 'Đặc quyền VIP', 'Tích điểm đổi giờ chơi miễn phí'],
  [Users, 'HLV Chuyên nghiệp', 'Cố vấn chuẩn kiện tướng quốc gia'],
]

function Brand() {
  return <Link to="/" className="login-brand"><span className="login-brand-icon"><Trophy size={26} /></span><span><strong>SportPulse</strong><small>Trung tâm Thể thao Olympus</small></span></Link>
}

export default function Login() {
  const location = useLocation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const selectedMembership = location.state?.membership
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitting = useRef(false)
  const errorRef = useRef(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(() => selectedMembership ? `Vui lòng đăng nhập để tiếp tục đăng ký gói ${selectedMembership}.` : location.state?.message || '')

  useEffect(() => {
    if (!error) return
    errorRef.current?.focus({ preventScroll: true })
    errorRef.current?.scrollIntoView({ block: 'nearest' })
  }, [error])

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting.current) return
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email').trim()
    const password = formData.get('password')
    if (!email) {
      setError('Vui lòng nhập email của bạn.')
      return
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu của bạn.')
      return
    }
    submitting.current = true
    setIsSubmitting(true)
    setMessage('')
    setError('')
    try {
      const session = await loginApi({ email, password })
      const user = login(session, session.token, formData.has('remember'))
      navigate(getAuthDestination(user.role, location.state?.from), { replace: true, state: { membership: selectedMembership } })
    } catch (error) {
      setError(getLoginErrorMessage(error))
    } finally {
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  return <main className="login-page">
    <aside className="login-hero">
      <div><Brand /><div className="login-intro"><span className="login-badge"><i /> Hạ tầng thể thao Olympic thông minh</span><h1>Nâng tầm trải nghiệm vận động đỉnh cao</h1><p>Hệ thống quản lý đặt sân đa năng, kết nối hội viên và huấn luyện viên chuyên nghiệp hàng đầu tại Việt Nam.</p></div></div>
      <div className="login-features">{features.map(([Icon, title, description]) => <div className="login-feature" key={title}><span><Icon size={21} /></span><h2>{title}</h2><p>{description}</p></div>)}</div>
      <div className="login-stats"><div><strong>15.000+</strong><span>Hội viên tin dùng mỗi ngày</span></div><div><strong>25+</strong><span>Cụm sân chuẩn Olympic</span></div><div><strong>99.8%</strong><span>Độ hài lòng dịch vụ</span></div></div>
    </aside>

    <section className="login-panel" aria-labelledby="login-title">
      <div className="login-topbar"><ThemeToggle /><div className="login-mobile-brand"><Brand /></div><Link to="/" className="login-back"><ArrowLeft size={16} /> Về trang chủ</Link></div>
      <div className="login-content">
        <header><h2 id="login-title">Chào mừng trở lại</h2><p>Đăng nhập vào tài khoản SportPulse của bạn để bắt đầu</p></header>
        <form onSubmit={handleSubmit} onChange={() => { if (error) setError('') }} className="login-form" aria-busy={isSubmitting} aria-describedby={error ? 'login-error' : undefined}>
          {error && <div id="login-error" ref={errorRef} className="login-error" role="alert" tabIndex={-1}><AlertCircle size={20} aria-hidden="true" /><div><strong>Đăng nhập không thành công</strong><p>{error}</p></div></div>}
          <div><label htmlFor="login-email">Email</label><div className="login-input"><Mail size={19} /><input id="login-email" name="email" type="email" autoComplete="username" placeholder="vd: athlete@sportpulse.vn" required /></div></div>
          <div><div className="login-label-row"><label htmlFor="login-password">Mật khẩu</label><Link className="login-text-button" to="/forgot-password">Quên mật khẩu?</Link></div><div className="login-input"><LockKeyhole size={19} /><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Nhập mật khẩu của bạn" required /><button type="button" className="login-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></div></div>
          <label className="login-remember"><input name="remember" type="checkbox" defaultChecked /> Ghi nhớ đăng nhập trên thiết bị này</label>
          <button className="login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập ngay'}<ArrowRight size={19} /></button>
        </form>
        <p className="login-feedback" role="status" aria-live="polite">{message}</p>
        <div className="login-register">Chưa có tài khoản SportPulse? <Link className="login-text-button" to="/register">Đăng ký hội viên mới ngay</Link></div>
      </div>
      <div className="login-support"><span><ShieldCheck size={18} /> Đồng hành cùng bạn trên mọi sân đấu</span><a href="tel:19008899"><Phone size={16} /> Hotline: <strong>1900 8899</strong></a></div>
    </section>
  </main>
}
