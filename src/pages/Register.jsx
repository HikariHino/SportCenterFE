import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bell, Building2, CalendarCheck, Check, CreditCard, Eye, EyeOff, Gift, LockKeyhole, Mail, MapPin, Phone, Trophy, UserRound } from 'lucide-react'
import '../style/Register.css'

const sports = ['Pickleball', 'Tennis', 'Cầu lông', 'Bóng đá Futsal', 'Gym & Bơi lội']
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
  const [accountType, setAccountType] = useState('individual')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const strength = password ? [password.length >= 8, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^\w\s]/.test(password)].filter(Boolean).length : 0

  function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    for (const name of ['fullname', ...(accountType === 'corporate' ? ['organization'] : [])]) {
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
    setMessage('Chức năng đăng ký chưa được kết nối với hệ thống xác thực. Tài khoản chưa được tạo. Vui lòng liên hệ 1900 8899 để được hỗ trợ.')
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
      <div className="register-topbar"><Link to="/"><ArrowLeft size={16} /> Trở về trang chủ</Link><span><MapPin size={15} /> Cơ sở 1 - Cầu Giấy, Hà Nội <b>06:00 - 22:00</b></span></div>
      <div className="register-content">
        <header><h2 id="register-title">Đăng ký tài khoản Hội viên</h2><p>Tạo tài khoản nhanh chóng chỉ trong 1 phút để bắt đầu đặt sân và nhận trọn vẹn đặc quyền thể thao.</p></header>
        <div className="register-tabs" role="group" aria-label="Loại tài khoản"><button type="button" aria-pressed={accountType === 'individual'} onClick={() => setAccountType('individual')}><UserRound size={18} /> Hội viên cá nhân</button><button type="button" aria-pressed={accountType === 'corporate'} onClick={() => setAccountType('corporate')}><Building2 size={18} /> CLB / Đội nhóm / Doanh nghiệp</button></div>
        <form className="register-form" onSubmit={handleSubmit} onChange={() => setMessage('')}>
          <input type="hidden" name="accountType" value={accountType} />
          {accountType === 'corporate' && <Field id="organization" label="Tên CLB / Đội nhóm / Doanh nghiệp" icon={Building2} autoComplete="organization" placeholder="Tên tổ chức của bạn" />}
          <Field id="fullname" label={accountType === 'corporate' ? 'Họ và tên người đại diện' : 'Họ và tên đầy đủ'} icon={UserRound} autoComplete="name" placeholder="Ví dụ: Nguyễn Văn Hùng" />
          <div className="register-row"><Field id="phone" label="Số điện thoại (Nhận OTP)" icon={Phone} type="tel" autoComplete="tel" placeholder="0912 345 678" /><Field id="email" label="Địa chỉ Email" icon={Mail} type="email" autoComplete="email" placeholder="name@olympus.vn" /></div>
          <fieldset className="register-sports"><legend>Môn thể thao quan tâm <span>(chọn một hoặc nhiều môn)</span></legend><div>{sports.map((sport, index) => <label key={sport}><input type="checkbox" name="sport" value={sport} defaultChecked={index < 2} /><span>{sport}<Check size={14} /></span></label>)}</div></fieldset>
          <div className="register-row"><PasswordField id="password" label="Mật khẩu khởi tạo" placeholder="Tối thiểu 8 ký tự" value={password} onChange={event => setPassword(event.target.value)} aria-describedby="register-strength" /><PasswordField id="confirm-password" label="Xác nhận mật khẩu" placeholder="Nhập lại mật khẩu" /></div>
          <div className="register-strength" id="register-strength"><div><span>Độ mạnh mật khẩu:</span><strong>{['Chưa nhập', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'][strength]}</strong></div><meter min="0" max="4" value={strength} aria-label="Độ mạnh mật khẩu" /><p>Sử dụng ít nhất 8 ký tự, kết hợp chữ hoa, chữ thường, chữ số và ký tự đặc biệt.</p></div>
          <label className="register-consent"><input type="checkbox" name="terms" required /><span>Tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của Trung tâm Thể thao SportPulse Olympus.</span></label>
          <label className="register-consent"><input type="checkbox" name="marketing" /><span>Nhận thông báo ưu đãi giờ vàng giảm giá 30%, giải đấu giao lưu và lịch thi đấu qua Zalo/Email.</span></label>
          <button type="submit" className="register-submit">Hoàn tất Đăng ký & Nhận ưu đãi 20% <ArrowRight size={19} /></button>
          <p className="register-feedback" role="status" aria-live="polite">{message}</p>
        </form>
        <p className="register-login">Đã có tài khoản SportPulse? <Link to="/login">Đăng nhập ngay <ArrowRight size={15} /></Link></p>
      </div>
      <div className="register-support"><span>SportPulse Olympus • Cùng bạn chinh phục mọi sân đấu</span><a href="tel:19008899"><Phone size={15} /> Hỗ trợ: <strong>1900 8899</strong></a></div>
    </section>
  </main>
}
