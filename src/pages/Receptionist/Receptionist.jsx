import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../../components/ThemeToggle'
import {
  ArrowRight, BadgeCheck, Bell, CalendarDays, CheckCircle2, CircleDollarSign,
  Clock3, CreditCard, LayoutDashboard, LogOut, MapPin, QrCode, ReceiptText,
  Plus, ScanLine, Search, ShieldCheck, Trophy, UserCheck, Users, WalletCards, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { createMember, getMemberById, getMembers } from '../../services/memberService'
import {
  completeReceptionistSession,
  getReceptionistSessionRoster,
  registerMemberForSession,
} from '../../services/receptionistClassService'
import '../../style/Receptionist/Receptionist.css'

const navigation = [
  [LayoutDashboard, 'Tổng quan'],
  [CalendarDays, 'Buổi học'],
  [ScanLine, 'Check-in'],
  [Users, 'Hội viên'],
  [ReceiptText, 'Thanh toán'],
]

const pageMeta = {
  'Buổi học': ['VẬN HÀNH BUỔI HỌC', 'Quản lý buổi học', 'Đăng ký học viên, kiểm tra danh sách và cập nhật trạng thái buổi học.'],
  'Check-in': ['TIẾP NHẬN KHÁCH', 'Check-in tại quầy', 'Xác minh mã đặt sân hoặc tài khoản hội viên trước khi sử dụng dịch vụ.'],
  'Hội viên': ['HỖ TRỢ HỘI VIÊN', 'Tra cứu hội viên', 'Kiểm tra trạng thái tài khoản, gói dịch vụ và thông tin liên hệ.'],
  'Thanh toán': ['GIAO DỊCH TẠI QUẦY', 'Thanh toán', 'Theo dõi giao dịch và hóa đơn phát sinh tại quầy lễ tân.'],
}

const emptyPayments = []

const emptyMemberForm = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  fitnessGoal: '',
}

const requestErrorMessage = (error, fallback) => {
  const validationErrors = error.response?.data?.errors
  return error.response?.data?.message
    || (validationErrors && Object.values(validationErrors).flat()[0])
    || error.message
    || fallback
}

const memberDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const formatMemberDate = value => {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : memberDateFormatter.format(date)
}

const genderLabel = gender => ({ Male: 'Nam', Female: 'Nữ', Other: 'Khác' })[gender] || gender || 'Chưa cập nhật'

const sessionDateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function EmptyState({ icon: Icon = Search, title, text }) {
  return <div className="reception-empty"><span><Icon size={25} /></span><strong>{title}</strong><p>{text}</p></div>
}

function CompleteSessionDialog({ sessionId, onClose, onCompleted }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await completeReceptionistSession(sessionId)
      onCompleted()
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể hoàn thành buổi học.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog reception-complete-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-complete-session-title">
      <header><div><span>XÁC NHẬN TRẠNG THÁI</span><h2 id="reception-complete-session-title">Hoàn thành buổi học #{sessionId}</h2><p>Thao tác này cập nhật trạng thái chính thức trên hệ thống.</p></div><button type="button" aria-label="Đóng xác nhận" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}><div className="reception-complete-copy"><span><CheckCircle2 size={25} /></span><strong>Xác nhận buổi học đã kết thúc?</strong><p>BE sẽ kiểm tra thời gian và quyền thao tác trước khi cập nhật.</p></div>{error && <p className="reception-form-error" role="alert">{error}</p>}<footer><button type="button" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang cập nhật...' : 'Xác nhận hoàn thành'}</button></footer></form>
    </section>
  </div>
}

function Overview({ onNavigate }) {
  const metrics = [
    [CalendarDays, 'Lượt đặt hôm nay', '--', 'blue'],
    [UserCheck, 'Khách đã check-in', '--', 'green'],
    [MapPin, 'Sân đang hoạt động', '--', 'purple'],
    [CircleDollarSign, 'Doanh thu tại quầy', '--', 'amber'],
  ]

  return <>
    <section className="reception-metrics" aria-label="Thống kê lễ tân">
      {metrics.map(([Icon, label, value, tone]) => <article key={label}><span className={tone}><Icon size={21} /></span><div><small>{label}</small><strong>{value}</strong><p>Chờ dữ liệu từ API</p></div></article>)}
    </section>

    <div className="reception-overview-grid">
      <section className="reception-card reception-queue">
        <div className="reception-card-head"><div><span>HÀNG ĐỢI</span><h2>Khách chờ check-in</h2></div><button type="button" onClick={() => onNavigate('Check-in')}>Mở check-in <ArrowRight size={15} /></button></div>
        <EmptyState icon={UserCheck} title="Chưa có khách trong hàng đợi" text="Danh sách sẽ cập nhật khi API check-in được kết nối." />
      </section>
      <section className="reception-card reception-court-panel">
        <div className="reception-card-head"><div><span>TÌNH TRẠNG SÂN</span><h2>Vận hành hiện tại</h2></div></div>
        <EmptyState icon={MapPin} title="Chưa có dữ liệu sân" text="Tình trạng sử dụng sân sẽ hiển thị theo thời gian thực." />
      </section>
    </div>

    <section className="reception-card reception-shortcuts">
      <div className="reception-card-head"><div><span>TRUY CẬP NHANH</span><h2>Nghiệp vụ tại quầy</h2></div></div>
      <div className="reception-shortcut-grid">
        <button type="button" onClick={() => onNavigate('Buổi học')}><span className="blue"><CalendarDays size={21} /></span><div><strong>Quản lý buổi học</strong><small>Đăng ký và kiểm tra học viên</small></div><ArrowRight size={17} /></button>
        <button type="button" onClick={() => onNavigate('Check-in')}><span className="green"><QrCode size={21} /></span><div><strong>Quét mã check-in</strong><small>Xác minh lượt đặt tại quầy</small></div><ArrowRight size={17} /></button>
        <button type="button" onClick={() => onNavigate('Hội viên')}><span className="purple"><Users size={21} /></span><div><strong>Tra cứu hội viên</strong><small>Kiểm tra tài khoản và gói dịch vụ</small></div><ArrowRight size={17} /></button>
        <button type="button" onClick={() => onNavigate('Thanh toán')}><span className="amber"><CreditCard size={21} /></span><div><strong>Kiểm tra thanh toán</strong><small>Theo dõi giao dịch và hóa đơn</small></div><ArrowRight size={17} /></button>
      </div>
    </section>
  </>
}

function SessionsView({ showNotice }) {
  const [sessionId, setSessionId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [registration, setRegistration] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [rosterSessionId, setRosterSessionId] = useState('')
  const [roster, setRoster] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterError, setRosterError] = useState('')
  const [rosterLoaded, setRosterLoaded] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [completedSessionId, setCompletedSessionId] = useState(null)

  const submitRegistration = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await registerMemberForSession(Number(sessionId), Number(memberId))
      setRegistration(result)
      setRosterSessionId(String(result.sessionId))
      showNotice(`Đã đăng ký hội viên #${result.memberId} vào buổi học #${result.sessionId}.`)
    } catch (requestError) {
      setRegistration(null)
      setError(requestErrorMessage(requestError, 'Không thể đăng ký buổi học cho hội viên.'))
    } finally {
      setSaving(false)
    }
  }

  const loadRoster = async event => {
    event?.preventDefault()
    setRosterLoading(true)
    setRosterError('')
    setRosterLoaded(true)
    setCompletedSessionId(null)
    try {
      const result = await getReceptionistSessionRoster(Number(rosterSessionId))
      setRoster(result)
    } catch (requestError) {
      setRoster([])
      setRosterError(requestErrorMessage(requestError, 'Không thể tải danh sách học viên của buổi học.'))
    } finally {
      setRosterLoading(false)
    }
  }

  return <div className="reception-session-page">
    <div className="reception-session-layout"><section className="reception-card reception-session-register">
      <div className="reception-card-head"><div><span>ĐĂNG KÝ BUỔI HỌC</span><h2>Thêm hội viên vào buổi học</h2></div><CalendarDays size={20} /></div>
      <form onSubmit={submitRegistration}>
        <label>Mã buổi học<input type="number" min="1" value={sessionId} onChange={event => setSessionId(event.target.value)} placeholder="Ví dụ: 12" required /></label>
        <label>Mã hội viên<input type="number" min="1" value={memberId} onChange={event => setMemberId(event.target.value)} placeholder="Ví dụ: 25" required /></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={saving}><Plus size={15} />{saving ? 'Đang đăng ký...' : 'Đăng ký buổi học'}</button>
      </form>
    </section><section className="reception-card reception-registration-result">
      <div className="reception-card-head"><div><span>KẾT QUẢ ĐĂNG KÝ</span><h2>Thông tin lượt đăng ký</h2></div><UserCheck size={20} /></div>
      {registration ? <div className="reception-registration-summary"><span><CheckCircle2 size={25} /></span><h3>{registration.className}</h3><p>Hội viên #{registration.memberId} đã được thêm vào buổi học.</p><div><small>Mã đăng ký<strong>#{registration.id}</strong></small><small>Mã buổi học<strong>#{registration.sessionId}</strong></small><small>Trạng thái<strong>{registration.status}</strong></small><small>Thời gian<strong>{registration.startsAt ? sessionDateTimeFormatter.format(new Date(registration.startsAt)) : 'Chưa xác định'}</strong></small></div></div> : <EmptyState icon={CalendarDays} title="Chưa có lượt đăng ký mới" text="Nhập mã buổi học và mã hội viên để thực hiện đăng ký tại quầy." />}
    </section></div>
    <section className="reception-card reception-session-roster">
      <div className="reception-card-head"><div><span>DANH SÁCH THEO BUỔI</span><h2>Học viên đã đăng ký</h2></div><div className="reception-roster-head-actions"><strong>{rosterLoaded && !rosterLoading ? `${roster.length} học viên` : 'Roster API'}</strong><button type="button" className={completedSessionId === Number(rosterSessionId) ? 'completed' : ''} disabled={!rosterLoaded || rosterLoading || !rosterSessionId || completedSessionId === Number(rosterSessionId)} onClick={() => setShowCompleteDialog(true)}><CheckCircle2 size={14} />{completedSessionId === Number(rosterSessionId) ? 'Đã hoàn thành' : 'Hoàn thành buổi học'}</button></div></div>
      <form className="reception-roster-lookup" onSubmit={loadRoster}><label htmlFor="reception-roster-session">Mã buổi học</label><div><CalendarDays size={16} /><input id="reception-roster-session" type="number" min="1" value={rosterSessionId} onChange={event => setRosterSessionId(event.target.value)} placeholder="Nhập mã buổi học" required /><button type="submit" disabled={rosterLoading}>{rosterLoading ? 'Đang tải...' : 'Xem danh sách'}</button></div></form>
      {rosterLoading ? <EmptyState icon={Users} title="Đang tải danh sách" text="Dữ liệu học viên đang được đồng bộ từ API." /> : rosterError ? <div className="reception-inline-error"><EmptyState icon={Users} title="Không thể tải danh sách" text={rosterError} /><button type="button" onClick={loadRoster}>Thử lại</button></div> : rosterLoaded ? roster.length ? <div className="reception-roster-table"><div className="reception-roster-heading"><span>Mã đăng ký</span><span>Học viên</span><span>Mã hội viên</span><span>Đăng ký</span><span>Điểm danh</span></div>{roster.map(student => <div className="reception-roster-row" key={student.registrationId}><span>#{student.registrationId}</span><strong>{student.fullName}</strong><span>#{student.memberId}</span><span>{student.registrationStatus}</span><span><b>{student.attendanceStatus || 'Chưa điểm danh'}</b><small>{student.checkInTime ? sessionDateTimeFormatter.format(new Date(student.checkInTime)) : 'Chưa có giờ check-in'}</small></span></div>)}</div> : <EmptyState icon={Users} title="Chưa có học viên" text="Buổi học này chưa có lượt đăng ký." /> : <EmptyState icon={Users} title="Chọn một buổi học" text="Nhập mã buổi học để xem danh sách học viên đã đăng ký." />}
    </section>
    {showCompleteDialog && <CompleteSessionDialog sessionId={Number(rosterSessionId)} onClose={() => setShowCompleteDialog(false)} onCompleted={() => { setCompletedSessionId(Number(rosterSessionId)); showNotice(`Đã hoàn thành buổi học #${rosterSessionId}.`) }} />}
  </div>
}

function CheckInView({ showNotice }) {
  const [lookup, setLookup] = useState('')
  const submitLookup = event => {
    event.preventDefault()
    if (!lookup.trim()) return showNotice('Vui lòng nhập mã đặt sân, số điện thoại hoặc mã hội viên.')
    showNotice('Tra cứu check-in đang chờ kết nối API.')
  }

  return <div className="reception-checkin-layout">
    <section className="reception-card reception-checkin-search">
      <div className="reception-scan-visual"><span><ScanLine size={42} /></span><i /><strong>Quét mã QR tại quầy</strong><p>Đưa mã đặt sân vào vùng quét hoặc nhập thông tin bên dưới.</p></div>
      <form onSubmit={submitLookup}><label htmlFor="reception-checkin-code">Mã đặt sân / Số điện thoại / Mã hội viên</label><div><Search size={18} /><input id="reception-checkin-code" value={lookup} onChange={event => setLookup(event.target.value)} placeholder="Nhập thông tin tra cứu" /><button type="submit">Tra cứu</button></div></form>
    </section>
    <section className="reception-card reception-checkin-result"><div className="reception-card-head"><div><span>KẾT QUẢ XÁC MINH</span><h2>Thông tin lượt đặt</h2></div><ShieldCheck size={20} /></div><EmptyState icon={QrCode} title="Chưa có lượt đặt được chọn" text="Thông tin khách, sân và thời gian sẽ hiển thị sau khi tra cứu." /></section>
  </div>
}

function CreateMemberDialog({ onClose, onCreated }) {
  const [form, setForm] = useState(emptyMemberForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateField = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const member = await createMember({
        ...form,
        phone: form.phone.trim() || null,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender || null,
        address: form.address.trim() || null,
        fitnessGoal: form.fitnessGoal.trim() || null,
      })
      onCreated(member)
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể đăng ký hội viên tại quầy.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-create-member-title">
      <header><div><span>ĐĂNG KÝ TẠI QUẦY</span><h2 id="reception-create-member-title">Tạo tài khoản hội viên</h2><p>Thông tin đăng nhập sẽ được bàn giao trực tiếp cho hội viên.</p></div><button type="button" aria-label="Đóng biểu mẫu" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}>
        <div className="reception-member-form-grid">
          <label>Họ và tên<input name="fullName" value={form.fullName} onChange={updateField} maxLength="100" required /></label>
          <label>Email<input name="email" type="email" value={form.email} onChange={updateField} maxLength="256" required /></label>
          <label>Mật khẩu ban đầu<input name="password" type="password" value={form.password} onChange={updateField} minLength="6" autoComplete="new-password" required /></label>
          <label>Số điện thoại<input name="phone" type="tel" value={form.phone} onChange={updateField} /></label>
          <label>Ngày sinh<input name="dateOfBirth" type="date" value={form.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={updateField} /></label>
          <label>Giới tính<select name="gender" value={form.gender} onChange={updateField}><option value="">Chưa cung cấp</option><option value="Male">Nam</option><option value="Female">Nữ</option><option value="Other">Khác</option></select></label>
          <label className="wide">Địa chỉ<input name="address" value={form.address} onChange={updateField} maxLength="200" /></label>
          <label className="wide">Mục tiêu tập luyện<input name="fitnessGoal" value={form.fitnessGoal} onChange={updateField} maxLength="100" placeholder="Ví dụ: tăng sức bền, giảm cân..." /></label>
        </div>
        {error && <p className="reception-form-error" role="alert">{error}</p>}
        <footer><button type="button" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang đăng ký...' : 'Đăng ký hội viên'}</button></footer>
      </form>
    </section>
  </div>
}

function MemberDetailDialog({ memberId, onClose }) {
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadMember = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getMemberById(memberId)
        if (active) setMember(result)
      } catch (requestError) {
        if (active) {
          setMember(null)
          setError(requestErrorMessage(requestError, 'Không thể tải thông tin hội viên.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadMember()
    return () => { active = false }
  }, [memberId, requestKey])

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-member-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-member-detail-title">
      <header><div><span>HỒ SƠ HỘI VIÊN</span><h2 id="reception-member-detail-title">Chi tiết hội viên #{memberId}</h2><p>Thông tin được tải trực tiếp từ Member API.</p></div><button type="button" aria-label="Đóng hồ sơ hội viên" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-member-detail-body">
        {loading ? <div className="reception-member-detail-state"><Users size={26} /><strong>Đang tải hồ sơ</strong><span>Vui lòng chờ dữ liệu hội viên được đồng bộ.</span></div> : error ? <div className="reception-member-detail-state"><Users size={26} /><strong>Không thể tải hồ sơ</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : member && <>
          <div className="reception-member-detail-profile"><span><UserCheck size={25} /></span><div><h3>{member.fullName}</h3><p>{member.email}</p></div><b className={member.isActive ? 'active' : 'inactive'}>{member.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</b></div>
          <div className="reception-member-detail-grid">
            <div><small>Mã hội viên</small><strong>#{member.memberId}</strong></div>
            <div><small>Mã tài khoản</small><strong>#{member.userId}</strong></div>
            <div><small>Số điện thoại</small><strong>{member.phone || 'Chưa cập nhật'}</strong></div>
            <div><small>Ngày sinh</small><strong>{formatMemberDate(member.dateOfBirth)}</strong></div>
            <div><small>Giới tính</small><strong>{genderLabel(member.gender)}</strong></div>
            <div><small>Ngày đăng ký</small><strong>{formatMemberDate(member.createdAt)}</strong></div>
            <div className="wide"><small>Địa chỉ</small><strong>{member.address || 'Chưa cập nhật'}</strong></div>
            <div className="wide"><small>Mục tiêu tập luyện</small><strong>{member.fitnessGoal || 'Chưa cập nhật'}</strong></div>
          </div>
        </>}
      </div>
    </section>
  </div>
}

function MembersView({ query, showNotice }) {
  const [status, setStatus] = useState('Tất cả')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')

  useEffect(() => {
    let active = true
    const loadMembers = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getMembers()
        if (active) setMembers(result)
      } catch (requestError) {
        if (active) {
          setMembers([])
          setError(requestErrorMessage(requestError, 'Không thể tải danh sách hội viên.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadMembers()
    return () => { active = false }
  }, [requestKey])

  const filteredMembers = useMemo(() => members.filter(member => {
    const matchesStatus = status === 'Tất cả'
      || (status === 'Đang hoạt động' && member.isActive)
      || (status === 'Ngừng hoạt động' && !member.isActive)
    const matchesQuery = !normalizedQuery
      || `${member.memberId} ${member.fullName || ''} ${member.email || ''} ${member.phone || ''}`.toLocaleLowerCase('vi').includes(normalizedQuery)
    return matchesStatus && matchesQuery
  }), [members, normalizedQuery, status])

  const activeCount = members.filter(member => member.isActive).length

  const handleCreated = member => {
    showNotice(`Đã đăng ký ${member.fullName} với mã hội viên #${member.memberId}.`)
    setRequestKey(key => key + 1)
  }

  return <>
    <section className="reception-member-metrics"><article><span><Users size={20} /></span><div><small>Tổng hội viên</small><strong>{loading ? '--' : members.length}</strong><p>Dữ liệu tài khoản</p></div></article><article><span><BadgeCheck size={20} /></span><div><small>Đang hoạt động</small><strong>{loading ? '--' : activeCount}</strong><p>Có thể sử dụng dịch vụ</p></div></article><article><span><Clock3 size={20} /></span><div><small>Ngừng hoạt động</small><strong>{loading ? '--' : members.length - activeCount}</strong><p>Tài khoản đã khóa</p></div></article></section>
    <section className="reception-card reception-table-card reception-members-card">
      <div className="reception-table-tools"><div><strong>Danh sách hội viên</strong><small>{filteredMembers.length} kết quả</small></div><div>{['Tất cả', 'Đang hoạt động', 'Ngừng hoạt động'].map(item => <button type="button" className={status === item ? 'active' : ''} onClick={() => setStatus(item)} key={item}>{item}</button>)}<button className="reception-primary-button" type="button" onClick={() => setShowCreateDialog(true)}><Plus size={14} />Đăng ký hội viên</button></div></div>
      <div className="reception-table-heading"><span>Mã hội viên</span><span>Họ và tên</span><span>Email</span><span>Số điện thoại</span><span>Trạng thái</span></div>
      {loading ? <EmptyState icon={Users} title="Đang tải hội viên" text="Dữ liệu đang được đồng bộ từ Member API." /> : error ? <div className="reception-inline-error"><EmptyState icon={Users} title="Không thể tải hội viên" text={error} /><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : filteredMembers.length ? <div>{filteredMembers.map(member => <button type="button" className="reception-table-row" key={member.memberId} onClick={() => setSelectedMemberId(member.memberId)} aria-label={`Xem chi tiết ${member.fullName}`}><span>#{member.memberId}</span><span>{member.fullName}</span><span>{member.email}</span><span>{member.phone || 'Chưa cập nhật'}</span><span className={member.isActive ? 'reception-member-active' : 'reception-member-inactive'}>{member.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></button>)}</div> : <EmptyState icon={Users} title="Không có hội viên phù hợp" text={query || status !== 'Tất cả' ? 'Thử thay đổi từ khóa hoặc bộ lọc trạng thái.' : 'Hệ thống chưa có tài khoản hội viên.'} />}
    </section>
    {showCreateDialog && <CreateMemberDialog onClose={() => setShowCreateDialog(false)} onCreated={handleCreated} />}
    {selectedMemberId !== null && <MemberDetailDialog memberId={selectedMemberId} onClose={() => setSelectedMemberId(null)} />}
  </>
}

function PaymentsView({ query }) {
  const [status, setStatus] = useState('Tất cả')
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const payments = useMemo(() => emptyPayments.filter(payment => (status === 'Tất cả' || payment.status === status) && (!normalizedQuery || `${payment.code || ''} ${payment.customerName || ''}`.toLocaleLowerCase('vi').includes(normalizedQuery))), [normalizedQuery, status])

  return <>
    <section className="reception-payment-metrics"><article><span className="green"><WalletCards size={21} /></span><div><small>Đã thu hôm nay</small><strong>--</strong><p>Chờ dữ liệu API</p></div></article><article><span className="amber"><Clock3 size={21} /></span><div><small>Chờ thanh toán</small><strong>--</strong><p>Chờ dữ liệu API</p></div></article><article><span className="blue"><ReceiptText size={21} /></span><div><small>Hóa đơn đã tạo</small><strong>--</strong><p>Chờ dữ liệu API</p></div></article></section>
    <section className="reception-card reception-table-card"><div className="reception-table-tools"><div><strong>Giao dịch tại quầy</strong><small>{payments.length} kết quả</small></div><div>{['Tất cả', 'Thành công', 'Chờ thanh toán', 'Hoàn tiền'].map(item => <button type="button" className={status === item ? 'active' : ''} onClick={() => setStatus(item)} key={item}>{item}</button>)}</div></div><div className="reception-table-heading"><span>Mã giao dịch</span><span>Khách hàng</span><span>Nội dung</span><span>Số tiền</span><span>Trạng thái</span></div>{payments.length ? <div>{payments.map(payment => <button type="button" className="reception-table-row" key={payment.id}><span>{payment.code}</span><span>{payment.customerName}</span><span>{payment.description}</span><span>{payment.amount}</span><span>{payment.status}</span></button>)}</div> : <EmptyState icon={ReceiptText} title="Chưa có giao dịch" text="Giao dịch và hóa đơn sẽ xuất hiện sau khi kết nối Payment API." />}</section>
  </>
}

export default function Receptionist() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('Tổng quan')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const staffName = user?.name || user?.fullName || 'Nhân viên lễ tân'
  const initials = staffName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'LT'
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())

  const showNotice = text => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 2600)
  }

  const selectNavigation = label => {
    setActiveNav(label)
    setQuery('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const renderView = () => {
    if (activeNav === 'Buổi học') return <SessionsView showNotice={showNotice} />
    if (activeNav === 'Check-in') return <CheckInView showNotice={showNotice} />
    if (activeNav === 'Hội viên') return <MembersView query={query} showNotice={showNotice} />
    if (activeNav === 'Thanh toán') return <PaymentsView query={query} />
    return <Overview onNavigate={selectNavigation} />
  }

  const meta = pageMeta[activeNav]

  return <main className="reception-dashboard">
    <aside className="reception-sidebar">
      <Link to="/" className="reception-brand"><span><Trophy size={23} /></span><div><strong>SportPulse <em>Olympus</em></strong><small>RECEPTION PORTAL</small></div></Link>
      <nav className="reception-nav" aria-label="Điều hướng lễ tân"><p>VẬN HÀNH QUẦY LỄ TÂN</p>{navigation.map(([Icon, label]) => <button type="button" key={label} className={activeNav === label ? 'active' : ''} aria-pressed={activeNav === label} onClick={() => selectNavigation(label)}><Icon size={19} /><span>{label}</span></button>)}</nav>
      <div className="reception-source"><span><ShieldCheck size={20} /></span><p>Nguồn dữ liệu</p><strong>Reception API</strong><small>Chờ kết nối dữ liệu</small></div>
      <div className="reception-user"><span className="reception-avatar">{initials}</span><div><strong>{staffName}</strong><small>Nhân viên lễ tân</small></div><button type="button" onClick={handleLogout} aria-label="Đăng xuất"><LogOut size={18} /></button></div>
    </aside>

    <section className="reception-workspace">
      <header className="reception-topbar"><label><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã đặt sân, hội viên..." aria-label="Tìm kiếm" /></label><div><ThemeToggle /><button type="button" aria-label="Thông báo" onClick={() => showNotice('Chưa có dữ liệu thông báo từ API.')}><Bell size={20} /></button><span className="reception-avatar">{initials}</span><span><strong>{staffName}</strong><small>Nhân viên lễ tân</small></span></div></header>
      <div className="reception-main">
        {activeNav === 'Tổng quan' ? <section className="reception-welcome"><div><p>{today}</p><h1>Chào bạn, {staffName}!</h1><span>Dữ liệu vận hành quầy sẽ hiển thị khi các API được kết nối.</span></div><BadgeCheck size={42} /></section> : <section className="reception-page-heading"><p>{meta[0]}</p><h1>{meta[1]}</h1><span>{meta[2]}</span></section>}
        {notice && <div className="reception-toast" role="status"><CheckCircle2 size={18} />{notice}</div>}
        <div className="reception-view" key={activeNav}>{renderView()}</div>
      </div>
    </section>
  </main>
}
