import ThemeToggle from '../components/ThemeToggle'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bell, Building2, CalendarCheck, CreditCard, Eye, EyeOff, Gift, LockKeyhole, Mail, MapPin, MessageCircle, Phone, Trophy, UserRound } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { sendRegisterOtp, verifyRegisterOtp } from '../services/authService'
import { getAuthDestination, getAuthErrorMessage } from '../utils/auth'
import '../style/Register.css'

const benefits = [
  [Gift, 'Tích điểm thưởng', 'quy đổi giờ chơi miễn phí và voucher phụ kiện'],
  [CalendarCheck, 'Giữ chỗ sân giờ vàng', 'ưu tiên đặt trước đến 14 ngày'],
  [Trophy, 'Tham gia giải đấu giao lưu', 'nội bộ cọ xát định kỳ hàng tháng'],
  [Bell, 'Nhận nhắc nhở lịch tập', 'thông minh đa kênh qua Zalo/SMS'],
]

function Field({ id, label, icon: Icon, ...props }) {
  return <div className="register-field"><label htmlFor={id}>{label} <span>*</span></label><div className="register-input"><Icon size={18} /><input id={id} name={id} required {...props} /></div></div>
}

function PasswordField({ id, label, ...props }) {
  const [visible, setVisible] = useState(false)
  return <div className="register-field"><label htmlFor={id}>{label} <span>*</span></label><div className="register-input"><LockKeyhole size={18} /><input id={id} name={id} type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} {...props} /><button type="button" onClick={() => setVisible(!visible)} aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
}

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const submitting = useRef(false)
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [message, setMessage] = useState('')
  const [pendingRegistration, setPendingRegistration] = useState(null)
  const strength = password ? [password.length >= 8, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^\w\s]/.test(password)].filter(Boolean).length : 0

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting.current) return
    const form = event.currentTarget
    if (!pendingRegistration) {
      setMessage('Vui lòng nhấn Gửi OTP để nhận mã xác minh trước khi đăng ký.')
      form.elements.namedItem('send-otp')?.focus()
      return
    }
    if (!form.reportValidity()) return
    if (!otp.trim()) {
      form.elements.namedItem('otp')?.focus()
      setMessage('Vui lòng nhập mã OTP đã được gửi đến email của bạn.')
      return
    }
    submitting.current = true
    setIsSubmitting(true)
    setMessage('')
    try {
      const result = await verifyRegisterOtp({ email: pendingRegistration.email, otp: otp.trim() })
      if (!result?.success) throw new Error(getAuthErrorMessage({ response: { data: result } }, 'Mã OTP không hợp lệ.'))
      if (result.data?.token || result.data?.accessToken) {
        const user = login(result.data, result.data?.token || result.data?.accessToken)
        navigate(getAuthDestination(user.role), { replace: true })
      } else {
        navigate('/login', { replace: true, state: { message: 'Đăng ký thành công. Vui lòng đăng nhập để tiếp tục.' } })
      }
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Xác minh OTP không thành công. Vui lòng kiểm tra mã và thử lại.'))
    } finally {
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  async function handleSendOtp(event) {
    if (submitting.current) return
    const form = event.currentTarget.form
    // Sending a code needs the registration details, but not the code itself.
    for (const field of Array.from(form.elements)) {
      if (field.name && !['otp', 'terms'].includes(field.name) && !field.reportValidity()) return
    }
    const data = new FormData(form)
    for (const name of ['fullname', 'email', 'address', 'fitnessGoal']) {
      if (!data.get(name).trim()) {
        form.elements.namedItem(name).focus()
        setMessage('Vui lòng điền đầy đủ thông tin, không chỉ nhập khoảng trắng.')
        return
      }
    }
    if (!/^(?:0|\+84)[0-9]{9}$/.test(data.get('phone').replace(/[\s.-]/g, ''))) {
      form.elements.namedItem('phone').focus()
      setMessage('Vui lòng nhập số điện thoại hợp lệ, ví dụ 0912 345 678 hoặc +84 912 345 678.')
      return
    }
    if (data.get('password') !== data.get('confirm-password')) {
      form.elements.namedItem('confirm-password').focus()
      setMessage('Mật khẩu xác nhận chưa khớp. Vui lòng nhập lại.')
      return
    }
    const dateOfBirth = new Date(`${data.get('dateOfBirth')}T00:00:00.000Z`)
    if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth > new Date()) {
      form.elements.namedItem('dateOfBirth').focus()
      setMessage('Vui lòng nhập ngày sinh hợp lệ, không ở tương lai.')
      return
    }
    submitting.current = true
    setIsSendingOtp(true)
    setMessage('')
    const registration = {
      email: data.get('email').trim(),
      password: data.get('password'),
      fullName: data.get('fullname').trim(),
      phone: data.get('phone').replace(/[\s.-]/g, ''),
      dateOfBirth: dateOfBirth.toISOString(),
      gender: data.get('gender'),
      address: data.get('address').trim(),
      fitnessGoal: data.get('fitnessGoal').trim(),
    }
    try {
      const result = await sendRegisterOtp(registration)
      if (!result?.success) throw new Error(getAuthErrorMessage({ response: { data: result } }, 'Không thể gửi mã OTP.'))
      setPendingRegistration({ email: registration.email })
      setOtp('')
      setMessage(result.message || `Mã OTP đã được gửi đến ${registration.email}.`)
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Không thể gửi mã OTP đăng ký. Vui lòng thử lại.'))
    } finally {
      submitting.current = false
      setIsSendingOtp(false)
    }
  }

  return <main className="register-page">
    <aside className="register-hero">
      <div>
        <Link to="/" className="register-brand"><span className="register-brand-icon"><Trophy size={27} /></span><span><strong>SportPulse <em>OLYMPUS</em></strong><small>Trung tâm Thể thao Đa năng Cao cấp</small></span></Link>
        <div className="register-intro"><span className="register-badge"><i /> Hệ sinh thái thể thao 4.0</span><h1>Gia nhập cộng đồng thể thao đỉnh cao SportPulse Olympus</h1><p>Nền tảng vận hành và trải nghiệm thể thao khép kín: Đặt sân thần tốc, kết nối đối tác tập luyện cùng các huấn luyện viên chuyên nghiệp hàng đầu.</p></div>
        <div className="register-promotion"><span><CreditCard size={23} /></span><div><small>ƯU ĐÃI THÀNH VIÊN MỚI</small><h2>Giảm 20% lần đặt sân đầu tiên & Tặng 1 buổi test thể lực với HLV</h2><p>Áp dụng ngay sau khi đăng ký thành công cho mọi cụm sân Tennis, Pickleball, Cầu lông.</p></div></div>
        <div className="register-benefits"><h2>4 Đặc quyền độc quyền cho thành viên Olympus:</h2>{benefits.map(([Icon, title, description]) => <div key={title}><span><Icon size={17} /></span><p><strong>{title}</strong> {description}</p></div>)}</div>
      </div>
      <div className="register-hero-bottom"><div className="register-stats"><div><strong>15.000+</strong><span>Hội viên năng động</span></div><div><strong>25+</strong><span>Cụm sân thi đấu</span></div><div><strong>99.8%</strong><span>Đánh giá hài lòng</span></div></div><p>© {new Date().getFullYear()} SportPulse Olympus Center</p></div>
    </aside>
    <section className="register-panel" aria-labelledby="register-title">
      <div className="register-topbar"><ThemeToggle /><Link to="/"><ArrowLeft size={16} /> Trở về trang chủ</Link><span><MapPin size={15} /> Cơ sở 1 - Cầu Giấy, Hà Nội <b>06:00 - 22:00</b></span></div>
      <div className="register-content">
        <header><h2 id="register-title">Đăng ký tài khoản Hội viên</h2><p>Tạo tài khoản nhanh chóng chỉ trong 1 phút để bắt đầu đặt sân và nhận trọn vẹn đặc quyền thể thao.</p></header>
        <div className="register-tabs" role="group" aria-label="Loại tài khoản"><button type="button" aria-pressed="true"><UserRound size={18} /> Hội viên cá nhân</button><button type="button" aria-pressed="false" disabled title="Chưa hỗ trợ đăng ký tổ chức"><Building2 size={18} /> CLB / Đội nhóm / Doanh nghiệp (Chưa hỗ trợ)</button></div>
        <form className="register-form" noValidate onSubmit={handleSubmit} onChange={(event) => {
          setMessage('')
          if (pendingRegistration && !['otp', 'terms'].includes(event.target.name)) {
            setPendingRegistration(null)
            setOtp('')
            setMessage('Thông tin đăng ký đã thay đổi. Vui lòng gửi lại mã OTP.')
          }
        }} aria-busy={isSubmitting || isSendingOtp}>
          <fieldset className="register-fields" disabled={isSubmitting || isSendingOtp}>
          <Field id="fullname" label="Họ và tên đầy đủ" icon={UserRound} autoComplete="name" placeholder="Ví dụ: Nguyễn Văn Hùng" />
          <div className="register-row"><Field id="phone" label="Số điện thoại" icon={Phone} type="tel" autoComplete="tel" placeholder="0912 345 678" /><Field id="email" label="Địa chỉ Email" icon={Mail} type="email" autoComplete="email" placeholder="name@olympus.vn" /></div>
          <div className="register-row">
            <Field id="dateOfBirth" label="Ngày sinh" icon={CalendarCheck} type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} />
            <div className="register-field"><label htmlFor="gender">Giới tính <span>*</span></label><div className="register-input"><UserRound size={18} /><select id="gender" name="gender" autoComplete="sex" required defaultValue=""><option value="" disabled>Chọn giới tính</option><option value="Male">Nam</option><option value="Female">Nữ</option><option value="Other">Khác</option></select></div></div>
          </div>
          <Field id="address" label="Địa chỉ" icon={MapPin} autoComplete="street-address" placeholder="Địa chỉ của bạn" />
          <Field id="fitnessGoal" label="Mục tiêu tập luyện" icon={Trophy} placeholder="Ví dụ: Tăng sức bền, giảm cân, tập Tennis" />
          <div className="register-row"><PasswordField id="password" label="Mật khẩu khởi tạo" placeholder="Tối thiểu 8 ký tự" value={password} onChange={event => setPassword(event.target.value)} aria-describedby="register-strength" /><PasswordField id="confirm-password" label="Xác nhận mật khẩu" placeholder="Nhập lại mật khẩu" /></div>
          <div className="register-strength" id="register-strength"><div><span>Độ mạnh mật khẩu:</span><strong>{['Chưa nhập', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'][strength]}</strong></div><meter min="0" max="4" value={strength} aria-label="Độ mạnh mật khẩu" /><p>Sử dụng ít nhất 8 ký tự, kết hợp chữ hoa, chữ thường, chữ số và ký tự đặc biệt.</p></div>
          <label className="register-consent"><input type="checkbox" name="terms" required /><span>Tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của Trung tâm Thể thao SportPulse Olympus.</span></label>
          <div className="register-field">
            <label htmlFor="otp">Mã OTP <span>*</span></label>
            <div className="register-otp-row">
              <div className="register-input"><MessageCircle size={18} /><input id="otp" name="otp" autoComplete="one-time-code" inputMode="numeric" placeholder="Nhập mã OTP" required value={otp} onChange={event => setOtp(event.target.value)} aria-describedby="register-otp-hint" /></div>
              <button type="button" name="send-otp" className="register-send-otp" onClick={handleSendOtp} disabled={isSubmitting || isSendingOtp}>{isSendingOtp ? 'Đang gửi...' : pendingRegistration ? 'Gửi lại OTP' : 'Gửi OTP'}</button>
            </div>
            <p className="register-otp-hint" id="register-otp-hint">{pendingRegistration ? `Mã OTP đã gửi đến ${pendingRegistration.email}.` : 'Nhấn Gửi OTP để nhận mã xác minh qua email.'}</p>
          </div>
          <button type="submit" className="register-submit" disabled={isSubmitting || isSendingOtp}>{isSubmitting ? 'Đang đăng ký...' : 'Đăng ký'} <ArrowRight size={19} /></button>
          </fieldset>
          <p className="register-feedback" role="status" aria-live="polite">{message}</p>
        </form>
        <p className="register-login">Đã có tài khoản SportPulse? <Link to="/login">Đăng nhập ngay <ArrowRight size={15} /></Link></p>
      </div>
      <div className="register-support"><span>SportPulse Olympus • Cùng bạn chinh phục mọi sân đấu</span><a href="tel:19008899"><Phone size={15} /> Hỗ trợ: <strong>1900 8899</strong></a></div>
    </section>
  </main>
}
