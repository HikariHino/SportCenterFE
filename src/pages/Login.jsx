import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, CreditCard, Eye, EyeOff, LockKeyhole, Mail, MessageCircle, Phone, ShieldCheck, Trophy, Users } from 'lucide-react'
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
  const selectedMembership = location.state?.membership
  const [portal, setPortal] = useState('member')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState(() => selectedMembership ? `Vui lòng đăng nhập để tiếp tục đăng ký gói ${selectedMembership}.` : '')
  const unavailable = (feature) => setMessage(`${feature} hiện chưa được kết nối. Vui lòng liên hệ hotline 1900 8899 để được hỗ trợ.`)

  function handleSubmit(event) {
    event.preventDefault()
    const identifier = new FormData(event.currentTarget).get('identifier').trim()
    if (!identifier) {
      setMessage('Vui lòng nhập email hoặc số điện thoại của bạn.')
      return
    }
    setMessage('Form đăng nhập chưa được kết nối với hệ thống xác thực. Vui lòng thử lại khi dịch vụ sẵn sàng.')
  }

  return <main className="login-page">
    <aside className="login-hero">
      <div><Brand /><div className="login-intro"><span className="login-badge"><i /> Hạ tầng thể thao Olympic thông minh</span><h1>Nâng tầm trải nghiệm vận động đỉnh cao</h1><p>Hệ thống quản lý đặt sân đa năng, kết nối hội viên và huấn luyện viên chuyên nghiệp hàng đầu tại Việt Nam.</p></div></div>
      <div className="login-features">{features.map(([Icon, title, description]) => <div className="login-feature" key={title}><span><Icon size={21} /></span><h2>{title}</h2><p>{description}</p></div>)}</div>
      <div className="login-stats"><div><strong>15.000+</strong><span>Hội viên tin dùng mỗi ngày</span></div><div><strong>25+</strong><span>Cụm sân chuẩn Olympic</span></div><div><strong>99.8%</strong><span>Độ hài lòng dịch vụ</span></div></div>
    </aside>

    <section className="login-panel" aria-labelledby="login-title">
      <div className="login-topbar"><div className="login-mobile-brand"><Brand /></div><Link to="/" className="login-back"><ArrowLeft size={16} /> Về trang chủ</Link></div>
      <div className="login-content">
        <header><h2 id="login-title">Chào mừng trở lại</h2><p>Đăng nhập vào tài khoản SportPulse của bạn để bắt đầu</p></header>
        <div className="login-portals" role="group" aria-label="Loại tài khoản">
          <button type="button" aria-pressed={portal === 'member'} onClick={() => { setPortal('member'); setMessage('') }}><Users size={19} /> Hội viên / Khách hàng</button>
          <button type="button" aria-pressed={portal === 'staff'} onClick={() => { setPortal('staff'); setMessage('') }}><BadgeCheck size={19} /> Ban quản lý / Huấn luyện viên</button>
        </div>
        {portal === 'staff' && <div className="login-notice"><ShieldCheck size={22} /><p><strong>Cổng Điều Hành Nội Bộ:</strong> Dành riêng cho HLV và Quản lý cụm sân Olympus.</p></div>}
        <div className="login-socials"><button type="button" onClick={() => unavailable('Đăng nhập Google')}><b className="login-google">G</b> Google</button><button type="button" onClick={() => unavailable('Đăng nhập Apple ID')}>Apple ID</button><button type="button" onClick={() => unavailable('Đăng nhập Zalo')}><b className="login-zalo">Z</b> Zalo / SĐT</button></div>
        <div className="login-divider"><span>Hoặc đăng nhập bằng email / số điện thoại</span></div>
        <form onSubmit={handleSubmit} className="login-form">
          <div><label htmlFor="login-identifier">Email hoặc Số điện thoại</label><div className="login-input"><Mail size={19} /><input id="login-identifier" name="identifier" type="text" autoComplete="username" placeholder="vd: athlete@sportpulse.vn hoặc 0912 345 678" required /></div></div>
          <div><div className="login-label-row"><label htmlFor="login-password">Mật khẩu</label><button className="login-text-button" type="button" onClick={() => unavailable('Khôi phục mật khẩu')}>Quên mật khẩu?</button></div><div className="login-input"><LockKeyhole size={19} /><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Nhập mật khẩu của bạn" required /><button type="button" className="login-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></div></div>
          <label className="login-remember"><input name="remember" type="checkbox" defaultChecked /> Ghi nhớ đăng nhập trên thiết bị này</label>
          <button className="login-submit" type="submit">{portal === 'staff' ? 'Đăng nhập Cổng Quản lý' : 'Đăng nhập ngay'}<ArrowRight size={19} /></button>
          <button className="login-otp" type="button" onClick={() => unavailable('Đăng nhập bằng mã OTP')}><MessageCircle size={19} /> Đăng nhập bằng mã OTP qua SMS / Zalo</button>
        </form>
        <p className="login-feedback" role="status" aria-live="polite">{message}</p>
        <div className="login-register">Chưa có tài khoản SportPulse? <Link className="login-text-button" to="/register">Đăng ký hội viên mới ngay</Link></div>
      </div>
      <div className="login-support"><span><ShieldCheck size={18} /> Đồng hành cùng bạn trên mọi sân đấu</span><a href="tel:19008899"><Phone size={16} /> Hotline: <strong>1900 8899</strong></a></div>
    </section>
  </main>
}
