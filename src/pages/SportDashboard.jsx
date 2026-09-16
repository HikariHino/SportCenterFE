import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowRight, CalendarDays, Check, ChevronDown, CirclePlay, Clock3, Dumbbell, Globe2, MapPin, Menu, MessageCircle, Phone, Search, Trophy, Users, Waves, X, Zap } from 'lucide-react'
import '../style/SportDashboard.css'

const sports = [
  ['🏓', 'Pickleball Arena', '6 sân điều hòa chuẩn USA', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80'],
  ['🎾', 'Tennis Pro Courts', '4 sân tiêu chuẩn Grand Slam', 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=900&q=80'],
  ['🏸', 'Cầu lông Yonex', '8 sân thảm cao cấp giảm chấn', 'https://images.unsplash.com/photo-1613918431703-aa50889e3be3?auto=format&fit=crop&w=900&q=80'],
  ['⚽', 'Sân bóng đá mini', 'Cỏ nhân tạo chuẩn FIFA Quality', 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80'],
]
const coaches = [['Nguyễn Hoàng Nam', 'HLV Pickleball cấp quốc tế', 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=700&q=80'], ['Trần Minh Quân', 'Cựu tuyển thủ quốc gia', 'https://images.unsplash.com/photo-1566751942272-7bdc0d5ada1d?auto=format&fit=crop&w=700&q=80'], ['Lê Thu Hà', 'Huấn luyện viên cầu lông Yonex', 'https://images.unsplash.com/photo-1622250800494-0c6b98d7d722?auto=format&fit=crop&w=700&q=80']]
const navItems = [
  ['top', 'Về Olympus'],
  ['sports', 'Bộ môn thi đấu'],
  ['booking', 'Lịch sân & Giá'],
  ['memberships', 'Gói hội viên'],
  ['amenities', 'Tiện ích'],
  ['coaches', 'HLV Pro'],
]

export default function SportDashboard() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [activeSection, setActiveSection] = useState('top')
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false })
  const navLinksRef = useRef(null)
  const scrollLockRef = useRef(false)
  const scrollLockTimerRef = useRef()
  const moveIndicator = useCallback((sectionId) => {
    const navLinks = navLinksRef.current
    const link = navLinks?.querySelector(`[data-section="${sectionId}"]`)
    if (!navLinks || !link) return
    const navRect = navLinks.getBoundingClientRect()
    const linkRect = link.getBoundingClientRect()
    setIndicator({ left: linkRect.left - navRect.left, width: linkRect.width, visible: true })
  }, [])

  useEffect(() => {
    let frameId
    const updateActiveSection = () => {
      frameId = window.requestAnimationFrame(() => {
        if (scrollLockRef.current) return
        const marker = window.scrollY + 180
        const sections = navItems
          .map(([id]) => ({ id, top: document.getElementById(id)?.getBoundingClientRect().top + window.scrollY }))
          .filter(({ top }) => Number.isFinite(top))
          .sort((a, b) => a.top - b.top)
        const current = sections.reduce((selected, section) => section.top <= marker ? section.id : selected, 'top')
        setActiveSection(current)
      })
    }
    updateActiveSection()
    window.addEventListener('scroll', updateActiveSection, { passive: true })
    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', updateActiveSection)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let secondFrameId
    const updateIndicator = () => moveIndicator(activeSection)
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(updateIndicator)
    })
    const resizeObserver = new ResizeObserver(updateIndicator)
    if (navLinksRef.current) resizeObserver.observe(navLinksRef.current)
    document.fonts?.ready.then(() => mounted && updateIndicator())
    window.addEventListener('resize', updateIndicator)
    return () => {
      mounted = false
      window.cancelAnimationFrame(firstFrameId)
      window.cancelAnimationFrame(secondFrameId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateIndicator)
    }
  }, [activeSection, moveIndicator])

  useEffect(() => () => window.clearTimeout(scrollLockTimerRef.current), [])

  const selectNavItem = (sectionId) => {
    scrollLockRef.current = true
    window.clearTimeout(scrollLockTimerRef.current)
    scrollLockTimerRef.current = window.setTimeout(() => { scrollLockRef.current = false }, 800)
    setActiveSection(sectionId)
    setMenuOpen(false)
  }
  const checkAvailability = () => { setStatus('Đang kiểm tra lịch trống...'); window.setTimeout(() => setStatus('Còn 12 khung giờ đẹp!'), 700) }
  return <main className="sport-page">
    <div className="utility-bar"><div className="container utility-content"><div><i className="open-dot" /> Cơ sở 1 - Cầu Giấy, Hà Nội <span className="utility-hours">| &nbsp; Đang mở cửa: 06:00 - 22:00</span></div><div className="utility-links"><a href="#booking"><Search size={14} /> Tra cứu lịch trống</a><a href="tel:19008899"><Phone size={14} /> Hotline: 1900 8899</a></div></div></div>
    <nav className="main-nav"><div className="container nav-content"><a className="brand" href="#top" onClick={() => selectNavItem('top')}><i className="brand-icon"><Trophy size={24} /></i><span><b>SportPulse <em>Olympus</em></b><small>TỔ HỢP THỂ THAO ĐỈNH CAO</small></span></a><div ref={navLinksRef} className={menuOpen ? 'nav-links is-open' : 'nav-links'}><i className="nav-indicator" style={{ left: indicator.left, width: indicator.width, opacity: indicator.visible ? 1 : 0 }} aria-hidden="true" />{navItems.map(([id, label]) => <a key={id} data-section={id} className={activeSection === id ? 'active' : ''} href={`#${id}`} onClick={() => selectNavItem(id)} aria-current={activeSection === id ? 'page' : undefined}>{label}{id === 'sports' && <ChevronDown size={15} />}</a>)}</div><div className="nav-actions"><Link className="login" to="/login">Đăng nhập</Link><Link className="dashboard-register" to="/register">Đăng ký</Link><a className="book-now" href="#booking"><CalendarDays size={17} /> Đặt sân ngay</a><button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Mở menu">{menuOpen ? <X /> : <Menu />}</button></div></div></nav>
    <section className="hero" id="top"><i className="hero-orb orb-one" /><i className="hero-orb orb-two" /><div className="container hero-content"><div className="live-badge"><i className="pulse" /> Tổ hợp thể thao tiêu chuẩn quốc tế số 1 Hà Nội <b>• Mở cửa 06:00 - 22:00</b></div><h1>Nâng Tầm Trải Nghiệm<br /><span>Vận Động Đỉnh Cao</span> Cùng Olympus</h1><p>Hệ sinh thái thể thao đa năng với 25+ cụm sân thi đấu, huấn luyện viên chuyên nghiệp và hệ thống đặt sân trực tuyến siêu tốc chỉ trong 30 giây.</p><div className="stats"><div><strong>25+</strong><small>Sân thi đấu Olympic</small></div><div><strong>15.000+</strong><small>Hội viên gắn kết</small></div><div><strong className="green">99.4%</strong><small>Đánh giá 5 sao</small></div><div><strong>1.000 Lux</strong><small>Đèn chống lóa TV</small></div></div><div className="booking-card" id="booking"><div className="booking-head"><div className="booking-title"><i><Zap size={21} /></i><div><h2>Đặt Sân Giữ Chỗ Nhanh</h2><p>Xác nhận lịch ngay lập tức - Không cần cọc đối với Hội viên</p></div></div><b className="speed"><Zap size={14} /> 30 Giây Hoàn Tất</b></div><div className="booking-fields"><label><span><MapPin size={15} /> Chọn cơ sở</span><select><option>Cơ sở 1: Cầu Giấy, Hà Nội</option><option>Cơ sở 2: Mỹ Đình, Hà Nội</option></select></label><label><span><Activity size={15} /> Bộ môn</span><select><option>Pickleball Arena</option><option>Tennis Pro Courts</option><option>Cầu lông Yonex</option></select></label><label><span><CalendarDays size={15} /> Ngày thi đấu</span><input type="date" defaultValue="2026-09-10" /></label><label><span><Clock3 size={15} /> Khung giờ</span><select><option>18:00 - 19:30</option><option>19:30 - 21:00</option></select></label><button onClick={checkAvailability} className={status.includes('Còn') ? 'search-court success' : 'search-court'}>{status.includes('Còn') ? <Check size={19} /> : <Search size={19} />}{status || 'Tìm sân & Báo giá'}</button></div></div></div></section>
    <section className="section sports-section" id="sports"><div className="container"><Header eyebrow="HỆ THỐNG SÂN THI ĐẤU" title="Chọn Bộ Môn Của Bạn" text="Hạ tầng đẳng cấp, sẵn sàng cho mọi trận đấu và khoảnh khắc bứt phá." /><div className="sport-grid">{sports.map(([icon,title,detail,image]) => <article className="sport-card" key={title}><img src={image} alt={title} /><i className="image-shade" /><span className="sport-tag">PHỔ BIẾN</span><div><span className="sport-emoji">{icon}</span><h3>{title}</h3><p>{detail}</p><a href="#booking">Đặt sân ngay <ArrowRight size={17} /></a></div></article>)}</div></div></section>
    <section className="section amenities" id="amenities"><div className="container amenity-layout"><div><span className="eyebrow">TRẢI NGHIỆM TOÀN DIỆN</span><h2>Không Chỉ Là<br />Một Trận Đấu</h2><p>Từ phòng thay đồ chuẩn khách sạn, khu phục hồi Ice Bath đến Sport Bar sôi động — mọi trải nghiệm đều được chăm chút.</p><a className="text-link" href="#booking">Khám phá tiện ích <ArrowRight size={17} /></a></div><div className="amenity-grid"><div className="amenity-card large"><Waves /><h3>Bể bơi bốn mùa</h3><p>Nước điện phân chuẩn quốc tế</p></div><div className="amenity-card"><Dumbbell /><h3>Gym hiện đại</h3><p>Thiết bị Technogym</p></div><div className="amenity-card"><Users /><h3>Sport Bar</h3><p>Nạp năng lượng sau trận</p></div></div></div></section>
    <section className="section memberships" id="memberships"><div className="container"><Header eyebrow="THÀNH VIÊN OLYMPUS" title="Gói Hội Viên Phù Hợp Với Bạn" /><div className="membership-grid"><Membership name="Flex Pass" price="499.000" items={['Giá sân ưu đãi 10%','Đặt sân trước 3 ngày','2 lượt khách/tháng']} /><Membership featured name="Performance" price="999.000" items={['Giá sân ưu đãi 20%','Đặt sân trước 7 ngày','4 buổi Gym & Ice Bath']} /><Membership name="Elite Gold" price="1.990.000" items={['Giá sân ưu đãi 30%','Ưu tiên mọi khung giờ','HLV tư vấn hàng tháng']} /></div></div></section>
    <section className="section coaches" id="coaches"><div className="container"><Header eyebrow="ĐỘI NGŨ CHUYÊN GIA" title="Huấn Luyện Viên Pro" text="Đồng hành cùng bạn trên hành trình tiến bộ mỗi ngày." /><div className="coach-grid">{coaches.map(([name,role,image]) => <article className="coach-card" key={name}><img src={image} alt={name} /><div><span>PICKLEBALL & THỂ LỰC</span><h3>{name}</h3><p>{role}</p><button>Đặt lịch học <ArrowRight size={15} /></button></div></article>)}</div></div></section>
    <section className="container cta"><div><span><Trophy size={16} /> ƯU ĐÃI DÀNH RIÊNG CHO KHÁCH MỚI</span><h2>Sẵn Sàng Cho Trận Đấu Hôm Nay?</h2><p>Đặt sân trực tuyến ngay hôm nay để nhận ưu đãi giảm 20% cho lần đầu trải nghiệm.</p></div><a href="#booking">Đặt Sân Giữ Slot Ngay <ArrowRight /></a></section>
    <footer><div className="container footer-grid"><div><a className="brand footer-brand" href="#top"><i className="brand-icon"><Trophy size={24} /></i><span><b>SportPulse <em>Olympus</em></b><small>TỔ HỢP THỂ THAO ĐỈNH CAO</small></span></a><p>Trung tâm Thể thao Đa năng Olympus — chuẩn mực thi đấu quốc tế, dành cho cộng đồng yêu vận động.</p><div className="socials"><a href="#facebook"><Globe2 /></a><a href="#chat"><MessageCircle /></a><a href="#video"><CirclePlay /></a></div></div><div><h4>Cụm sân thi đấu</h4><a href="#sports">Pickleball Arena</a><a href="#sports">Tennis Pro Courts</a><a href="#sports">Cầu lông Yonex</a><a href="#sports">Bóng đá Mini FIFA</a></div><div><h4>Địa chỉ & Hotline</h4><p>188 Đường Cầu Giấy, Phường Dịch Vọng, Hà Nội</p><p>Tổng đài: 1900 8899</p><p>booking@sportpulse.vn</p></div></div><div className="container copyright">© 2026 SportPulse Olympus Sports Center. Bản quyền thuộc về SportPulse Olympus.</div></footer>
  </main>
}
function Header({ eyebrow, title, text }) { return <div className="section-heading"><span>{eyebrow}</span><h2>{title}</h2>{text && <p>{text}</p>}</div> }
function Membership({ name, price, items, featured }) { return <article className={featured ? 'featured' : ''}>{featured && <span className="popular">LỰA CHỌN PHỔ BIẾN</span>}<h3>{name}</h3><p>{featured ? 'Tối ưu cho người tập đều đặn' : 'Dành cho trải nghiệm linh hoạt'}</p><strong>{price}<small>đ / tháng</small></strong><ul>{items.map(item => <li key={item}><Check />{item}</li>)}</ul><button>{featured ? 'Đăng ký Performance' : 'Chọn gói này'}</button></article> }
