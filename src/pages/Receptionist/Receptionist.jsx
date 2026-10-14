import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../../components/ThemeToggle'
import {
  ArrowRight, BadgeCheck, Bell, CalendarDays, CheckCircle2, CircleDollarSign,
  Clock3, CreditCard, LayoutDashboard, LogOut, MapPin, QrCode, ReceiptText,
  Ban, LogIn, Plus, ScanLine, Search, ShieldCheck, Trophy, UserCheck, Users, WalletCards, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { createMember, getMemberById, getMembers } from '../../services/memberService'
import { getMembershipPackages } from '../../services/membershipPackageService'
import { cancelReceptionistSubscription, confirmReceptionistSubscriptionPayment, createReceptionistMemberSubscription, getReceptionistMemberSubscriptions, getReceptionistSubscriptionById } from '../../services/memberSubscriptionService'
import { getPaymentById, getPayments } from '../../services/paymentService'
import { getReceptionistSessionAttendances, markReceptionistAttendance } from '../../services/receptionistAttendanceService'
import {
  cancelReceptionistRegistration,
  checkInReceptionistRegistration,
  completeReceptionistSession,
  getReceptionistMemberRegistrations,
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
const attendanceStatusLabel = status => ({ Present: 'Có mặt', Absent: 'Vắng mặt', Excused: 'Có phép' })[status] || status
const subscriptionStatusLabel = status => ({ Pending: 'Chờ thanh toán', Active: 'Đang hoạt động', Cancelled: 'Đã hủy', Expired: 'Hết hạn' })[status] || status
const paymentStatusLabel = status => ({ Pending: 'Chờ thanh toán', Completed: 'Thành công', Cancelled: 'Đã hủy', Expired: 'Hết hạn', Failed: 'Thất bại', NeedsReview: 'Cần kiểm tra', Refunded: 'Hoàn tiền' })[status] || status

const sessionDateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const formatDateTime = value => {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa có' : sessionDateTimeFormatter.format(date)
}

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
  const [form, setForm] = useState({ sessionId: '', memberId: '', status: 'Present' })
  const [attendance, setAttendance] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [listSessionId, setListSessionId] = useState('')
  const [attendances, setAttendances] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [listLoaded, setListLoaded] = useState(false)

  const updateField = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }))

  const submitAttendance = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await markReceptionistAttendance({
        sessionId: Number(form.sessionId),
        memberId: Number(form.memberId),
        status: form.status,
      })
      setAttendance(result)
      setListSessionId(String(result.sessionId))
      showNotice(`Đã cập nhật điểm danh cho hội viên #${result.memberId}.`)
    } catch (requestError) {
      setAttendance(null)
      setError(requestErrorMessage(requestError, 'Không thể điểm danh hội viên.'))
    } finally {
      setSaving(false)
    }
  }

  const loadAttendances = async event => {
    event?.preventDefault()
    setListLoading(true)
    setListError('')
    setListLoaded(true)
    try {
      const result = await getReceptionistSessionAttendances(Number(listSessionId))
      setAttendances(result)
    } catch (requestError) {
      setAttendances([])
      setListError(requestErrorMessage(requestError, 'Không thể tải danh sách điểm danh.'))
    } finally {
      setListLoading(false)
    }
  }

  return <div className="reception-attendance-page"><div className="reception-checkin-layout">
    <section className="reception-card reception-checkin-search">
      <div className="reception-scan-visual"><span><ScanLine size={42} /></span><i /><strong>Điểm danh tại quầy</strong><p>Nhập đúng mã buổi học và hội viên để ghi nhận trạng thái tham gia.</p></div>
      <form className="reception-attendance-form" onSubmit={submitAttendance}><div><label>Mã buổi học<input name="sessionId" type="number" min="1" value={form.sessionId} onChange={updateField} required /></label><label>Mã hội viên<input name="memberId" type="number" min="1" value={form.memberId} onChange={updateField} required /></label><label>Trạng thái<select name="status" value={form.status} onChange={updateField}><option value="Present">Có mặt</option><option value="Absent">Vắng mặt</option><option value="Excused">Có phép</option></select></label></div>{error && <p role="alert">{error}</p>}<button type="submit" disabled={saving}>{saving ? 'Đang cập nhật...' : 'Cập nhật điểm danh'}</button></form>
    </section>
    <section className="reception-card reception-checkin-result"><div className="reception-card-head"><div><span>KẾT QUẢ ĐIỂM DANH</span><h2>Thông tin hội viên</h2></div><ShieldCheck size={20} /></div>{attendance ? <div className="reception-attendance-result"><span><CheckCircle2 size={26} /></span><h3>{attendance.memberName || `Hội viên #${attendance.memberId}`}</h3><p>Điểm danh đã được ghi nhận trên hệ thống.</p><div><small>Mã điểm danh<strong>#{attendance.id}</strong></small><small>Mã buổi học<strong>#{attendance.sessionId}</strong></small><small>Trạng thái<strong>{attendanceStatusLabel(attendance.status)}</strong></small><small>Thời gian<strong>{sessionDateTimeFormatter.format(new Date(attendance.checkInTime))}</strong></small></div></div> : <EmptyState icon={QrCode} title="Chưa có kết quả điểm danh" text="Kết quả sẽ hiển thị sau khi cập nhật trạng thái hội viên." />}</section>
  </div><section className="reception-card reception-attendance-list-card"><div className="reception-card-head"><div><span>ĐIỂM DANH THEO BUỔI</span><h2>Danh sách đã ghi nhận</h2></div><strong>{listLoaded && !listLoading ? `${attendances.length} hội viên` : 'Attendance API'}</strong></div><form className="reception-attendance-lookup" onSubmit={loadAttendances}><label htmlFor="reception-attendance-session">Mã buổi học</label><div><CalendarDays size={16} /><input id="reception-attendance-session" type="number" min="1" value={listSessionId} onChange={event => setListSessionId(event.target.value)} placeholder="Nhập mã buổi học" required /><button type="submit" disabled={listLoading}>{listLoading ? 'Đang tải...' : 'Xem điểm danh'}</button></div></form>{listLoading ? <EmptyState icon={UserCheck} title="Đang tải điểm danh" text="Dữ liệu đang được đồng bộ từ Attendance API." /> : listError ? <div className="reception-inline-error"><EmptyState icon={UserCheck} title="Không thể tải điểm danh" text={listError} /><button type="button" onClick={loadAttendances}>Thử lại</button></div> : listLoaded ? attendances.length ? <div className="reception-attendance-table"><div className="reception-attendance-heading"><span>Mã</span><span>Hội viên</span><span>Mã hội viên</span><span>Trạng thái</span><span>Thời gian</span></div>{attendances.map(item => <div className="reception-attendance-row" key={item.id}><span>#{item.id}</span><strong>{item.memberName || 'Chưa xác định'}</strong><span>#{item.memberId}</span><b className={String(item.status || '').toLowerCase()}>{attendanceStatusLabel(item.status)}</b><span>{sessionDateTimeFormatter.format(new Date(item.checkInTime))}</span></div>)}</div> : <EmptyState icon={UserCheck} title="Chưa có điểm danh" text="Buổi học này chưa ghi nhận trạng thái hội viên." /> : <EmptyState icon={UserCheck} title="Chọn một buổi học" text="Nhập mã buổi học để xem danh sách điểm danh." />}</section></div>
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

function MemberDetailDialog({ memberId, onClose, onViewRegistrations, onRegisterSubscription, onViewSubscriptions }) {
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
          <div className="reception-member-detail-actions"><button type="button" onClick={onViewRegistrations}><CalendarDays size={15} />Lượt đăng ký</button><button type="button" onClick={onViewSubscriptions}><ReceiptText size={15} />Gói hội viên</button><button type="button" onClick={onRegisterSubscription}><CreditCard size={15} />Đăng ký gói</button></div>
        </>}
      </div>
    </section>
  </div>
}

function CreateSubscriptionDialog({ memberId, onClose, onCreated }) {
  const [packages, setPackages] = useState([])
  const [packageId, setPackageId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const loadPackages = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getMembershipPackages()
        const activePackages = result.filter(item => item.isActive !== false)
        if (active) {
          setPackages(activePackages)
          setPackageId(activePackages[0]?.id ? String(activePackages[0].id) : '')
        }
      } catch (requestError) {
        if (active) setError(requestErrorMessage(requestError, 'Không thể tải danh sách gói hội viên.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    loadPackages()
    return () => { active = false }
  }, [])

  const submit = async event => {
    event.preventDefault()
    const normalizedPackageId = Number(packageId)
    if (!Number.isInteger(normalizedPackageId) || normalizedPackageId <= 0) {
      setError('Vui lòng chọn một gói hội viên hợp lệ.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const subscription = await createReceptionistMemberSubscription(memberId, normalizedPackageId)
      onCreated(subscription)
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể đăng ký gói cho hội viên.'))
    } finally {
      setSaving(false)
    }
  }

  const selectedPackage = packages.find(item => String(item.id) === packageId)

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog reception-subscription-create-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-create-subscription-title">
      <header><div><span>ĐĂNG KÝ TẠI QUẦY</span><h2 id="reception-create-subscription-title">Đăng ký gói cho hội viên #{memberId}</h2><p>Đăng ký mới sẽ chờ xác nhận thanh toán trước khi kích hoạt.</p></div><button type="button" aria-label="Đóng biểu mẫu đăng ký gói" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}>
        {loading ? <div className="reception-subscription-loading"><CreditCard size={25} /><strong>Đang tải danh sách gói</strong></div> : packages.length ? <><label className="reception-subscription-package-field">Gói hội viên<select value={packageId} onChange={event => setPackageId(event.target.value)} disabled={saving}>{packages.map(item => <option value={item.id} key={item.id}>{item.packageName}</option>)}</select></label>{selectedPackage && <div className="reception-subscription-package-preview"><span><small>Giá gói</small><strong>{Number(selectedPackage.price || 0).toLocaleString('vi-VN')} đ</strong></span><span><small>Thời hạn</small><strong>{selectedPackage.durationInDays} ngày</strong></span><p>{selectedPackage.description || 'Gói hội viên đang hoạt động.'}</p></div>}</> : !error && <div className="reception-subscription-loading"><CreditCard size={25} /><strong>Chưa có gói đang hoạt động</strong></div>}
        {error && <p className="reception-form-error" role="alert">{error}</p>}
        <footer><button type="button" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" disabled={loading || saving || !packages.length}>{saving ? 'Đang đăng ký...' : 'Tạo đăng ký gói'}</button></footer>
      </form>
    </section>
  </div>
}

function MemberSubscriptionsDialog({ memberId, onClose, showNotice }) {
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState(null)
  const [cancelSubscription, setCancelSubscription] = useState(null)
  const [paymentSubscription, setPaymentSubscription] = useState(null)

  useEffect(() => {
    let active = true
    const loadSubscriptions = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getReceptionistMemberSubscriptions(memberId)
        if (active) setSubscriptions(result)
      } catch (requestError) {
        if (active) {
          setSubscriptions([])
          setError(requestErrorMessage(requestError, 'Không thể tải các gói của hội viên.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadSubscriptions()
    return () => { active = false }
  }, [memberId, requestKey])

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-subscriptions-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-member-subscriptions-title">
      <header><div><span>GÓI HỘI VIÊN</span><h2 id="reception-member-subscriptions-title">Các gói của hội viên #{memberId}</h2><p>{subscriptions.length} đăng ký gói được tìm thấy.</p></div><button type="button" aria-label="Đóng danh sách gói" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-subscriptions-body">
        {loading ? <div className="reception-member-detail-state"><CreditCard size={26} /><strong>Đang tải các gói hội viên</strong><span>Dữ liệu đang được đồng bộ từ Member Subscriptions API.</span></div> : error ? <div className="reception-member-detail-state"><CreditCard size={26} /><strong>Không thể tải các gói</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : subscriptions.length ? <div className="reception-subscription-list">{subscriptions.map(item => <article key={item.id}><header><div><small>Đăng ký #{item.id}</small><strong>{item.packageName}</strong></div><b className={String(item.status || '').toLowerCase()}>{subscriptionStatusLabel(item.status)}</b></header><div><span><small>Giá đăng ký</small><strong>{Number(item.agreedPrice || 0).toLocaleString('vi-VN')} đ</strong></span><span><small>Thời hạn</small><strong>{item.durationInDays} ngày</strong></span><span><small>Ngày tạo</small><strong>{formatMemberDate(item.createdAt)}</strong></span><span><small>Hiệu lực</small><strong>{item.startDate ? `${formatMemberDate(item.startDate)} – ${formatMemberDate(item.endDate)}` : 'Chờ kích hoạt'}</strong></span></div><footer className="reception-subscription-actions"><button type="button" onClick={() => setSelectedSubscriptionId(item.id)}>Xem chi tiết <ArrowRight size={14} /></button>{item.status === 'Pending' && <><button className="payment" type="button" onClick={() => setPaymentSubscription(item)}><WalletCards size={13} />Thu tiền</button><button className="cancel" type="button" onClick={() => setCancelSubscription(item)}><Ban size={13} />Hủy gói</button></>}</footer></article>)}</div> : <div className="reception-member-detail-state"><CreditCard size={26} /><strong>Chưa đăng ký gói</strong><span>Hội viên này chưa có đăng ký gói nào.</span></div>}
      </div>
      {selectedSubscriptionId !== null && <SubscriptionDetailDialog subscriptionId={selectedSubscriptionId} onClose={() => setSelectedSubscriptionId(null)} />}
      {cancelSubscription && <CancelSubscriptionDialog subscription={cancelSubscription} onClose={() => setCancelSubscription(null)} onCancelled={updated => { setSubscriptions(current => current.map(item => item.id === updated.id ? updated : item)); showNotice(`Đã hủy đăng ký gói #${updated.id}.`) }} />}
      {paymentSubscription && <ConfirmSubscriptionPaymentDialog subscription={paymentSubscription} onClose={() => setPaymentSubscription(null)} onConfirmed={receipt => { setRequestKey(key => key + 1); showNotice(`Đã xác nhận biên nhận #${receipt.id} và kích hoạt gói.`) }} />}
    </section>
  </div>
}

function ConfirmSubscriptionPaymentDialog({ subscription, onClose, onConfirmed }) {
  const [amount, setAmount] = useState(String(subscription.agreedPrice || ''))
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [paymentReceived, setPaymentReceived] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    const normalizedAmount = Number(amount)
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setError('Số tiền phải lớn hơn 0.')
      return
    }
    if (!paymentReceived) {
      setError('Vui lòng xác nhận đã thực nhận đủ tiền từ hội viên.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const receipt = await confirmReceptionistSubscriptionPayment(subscription.id, {
        amount: normalizedAmount,
        paymentMethod,
        paymentReceived: true,
      })
      onConfirmed(receipt)
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể xác nhận thanh toán đăng ký gói.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop reception-nested-dialog" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog reception-subscription-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-confirm-payment-title">
      <header><div><span>XÁC NHẬN THU TIỀN</span><h2 id="reception-confirm-payment-title">Thanh toán đăng ký #{subscription.id}</h2><p>{subscription.packageName} · {Number(subscription.agreedPrice || 0).toLocaleString('vi-VN')} đ</p></div><button type="button" aria-label="Đóng biểu mẫu thanh toán" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}><div className="reception-payment-form-grid"><label>Số tiền đã nhận<input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} disabled={saving} required /></label><label>Phương thức<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)} disabled={saving}><option value="Cash">Tiền mặt</option><option value="BankTransfer">Chuyển khoản</option><option value="CreditCard">Thẻ tín dụng</option></select></label></div><label className="reception-payment-confirm"><input type="checkbox" checked={paymentReceived} onChange={event => setPaymentReceived(event.target.checked)} disabled={saving} /><span><strong>Tôi xác nhận đã thực nhận đủ tiền</strong><small>API này ghi nhận khoản tiền đã thu và kích hoạt gói; không tự trừ tiền ngân hàng hoặc thẻ.</small></span></label>{error && <p className="reception-form-error" role="alert">{error}</p>}<footer><button type="button" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" disabled={saving || !paymentReceived}>{saving ? 'Đang xác nhận...' : 'Xác nhận và kích hoạt'}</button></footer></form>
    </section>
  </div>
}

function CancelSubscriptionDialog({ subscription, onClose, onCancelled }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await cancelReceptionistSubscription(subscription.id)
      onCancelled(result)
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể hủy đăng ký gói.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop reception-nested-dialog" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog reception-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-cancel-subscription-title">
      <header><div><span>HỦY GÓI CHỜ THANH TOÁN</span><h2 id="reception-cancel-subscription-title">Đăng ký #{subscription.id}</h2><p>{subscription.packageName}</p></div><button type="button" aria-label="Đóng xác nhận hủy gói" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}><div className="reception-cancel-subscription-copy"><span><Ban size={24} /></span><strong>Xác nhận hủy đăng ký gói?</strong><p>Chỉ gói đang chờ và chưa thanh toán mới có thể hủy.</p></div>{error && <p className="reception-form-error" role="alert">{error}</p>}<footer><button type="button" onClick={onClose} disabled={saving}>Quay lại</button><button className="danger" type="submit" disabled={saving}>{saving ? 'Đang hủy...' : 'Xác nhận hủy'}</button></footer></form>
    </section>
  </div>
}

function SubscriptionDetailDialog({ subscriptionId, onClose }) {
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadSubscription = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getReceptionistSubscriptionById(subscriptionId)
        if (active) setSubscription(result)
      } catch (requestError) {
        if (active) {
          setSubscription(null)
          setError(requestErrorMessage(requestError, 'Không thể tải chi tiết đăng ký gói.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadSubscription()
    return () => { active = false }
  }, [subscriptionId, requestKey])

  return <div className="reception-dialog-backdrop reception-nested-dialog" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-subscription-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-subscription-detail-title">
      <header><div><span>CHI TIẾT ĐĂNG KÝ</span><h2 id="reception-subscription-detail-title">Đăng ký gói #{subscriptionId}</h2><p>Dữ liệu chi tiết được tải trực tiếp từ Member Subscriptions API.</p></div><button type="button" aria-label="Đóng chi tiết đăng ký gói" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-subscription-detail-body">
        {loading ? <div className="reception-member-detail-state"><ReceiptText size={26} /><strong>Đang tải chi tiết đăng ký</strong></div> : error ? <div className="reception-member-detail-state"><ReceiptText size={26} /><strong>Không thể tải chi tiết</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : subscription && <><div className="reception-subscription-detail-title"><span><CreditCard size={22} /></span><div><small>Gói hội viên</small><h3>{subscription.packageName}</h3></div><b className={String(subscription.status || '').toLowerCase()}>{subscriptionStatusLabel(subscription.status)}</b></div><div className="reception-subscription-detail-grid"><div><small>Mã hội viên</small><strong>#{subscription.memberId}</strong></div><div><small>Mã gói</small><strong>#{subscription.packageId}</strong></div><div><small>Giá đăng ký</small><strong>{Number(subscription.agreedPrice || 0).toLocaleString('vi-VN')} đ</strong></div><div><small>Thời hạn</small><strong>{subscription.durationInDays} ngày</strong></div><div><small>Ngày tạo</small><strong>{formatMemberDate(subscription.createdAt)}</strong></div><div><small>Ngày bắt đầu</small><strong>{formatMemberDate(subscription.startDate)}</strong></div><div><small>Ngày kết thúc</small><strong>{formatMemberDate(subscription.endDate)}</strong></div><div><small>Số biên nhận</small><strong>{subscription.payments?.length || 0}</strong></div></div>{subscription.payments?.length > 0 && <div className="reception-subscription-receipts"><h4>Biên nhận thanh toán</h4>{subscription.payments.map(payment => <div key={payment.id}><span><small>Mã #{payment.id}</small><strong>{payment.paymentMethod}</strong></span><span><small>Số tiền</small><strong>{Number(payment.amount || 0).toLocaleString('vi-VN')} đ</strong></span><span><small>Trạng thái</small><strong>{payment.status}</strong></span></div>)}</div>}</>}
      </div>
    </section>
  </div>
}

function CancelRegistrationDialog({ registration, onClose, onCancelled }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    const normalizedReason = reason.trim()
    if (!normalizedReason) {
      setError('Vui lòng nhập lý do hủy đăng ký.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await cancelReceptionistRegistration(registration.id, normalizedReason)
      onCancelled(result)
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Không thể hủy lượt đăng ký.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="reception-dialog reception-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-cancel-registration-title">
      <header><div><span>HỦY LƯỢT ĐĂNG KÝ</span><h2 id="reception-cancel-registration-title">Đăng ký #{registration.id}</h2><p>{registration.className} · Buổi #{registration.sessionId}</p></div><button type="button" aria-label="Đóng biểu mẫu hủy" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      <form onSubmit={submit}><label className="reception-cancel-reason">Lý do hủy<textarea value={reason} onChange={event => setReason(event.target.value)} rows="4" maxLength="500" placeholder="Nhập lý do hủy để lưu vào lịch sử..." required /></label>{error && <p className="reception-form-error" role="alert">{error}</p>}<footer><button type="button" onClick={onClose} disabled={saving}>Quay lại</button><button type="submit" disabled={saving}>{saving ? 'Đang hủy...' : 'Xác nhận hủy'}</button></footer></form>
    </section>
  </div>
}

function MemberRegistrationsDialog({ memberId, onClose, showNotice }) {
  const [registrations, setRegistrations] = useState({ items: [], total: 0, page: 1, pageSize: 20 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [requestKey, setRequestKey] = useState(0)
  const [cancelRegistration, setCancelRegistration] = useState(null)
  const [checkingInId, setCheckingInId] = useState(null)
  const [checkIns, setCheckIns] = useState({})
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    let active = true
    const loadRegistrations = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getReceptionistMemberRegistrations(memberId, { page, pageSize: 20 })
        if (active) setRegistrations(result)
      } catch (requestError) {
        if (active) {
          setRegistrations({ items: [], total: 0, page, pageSize: 20 })
          setError(requestErrorMessage(requestError, 'Không thể tải các lượt đăng ký của hội viên.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadRegistrations()
    return () => { active = false }
  }, [memberId, page, requestKey])

  const pageCount = Math.max(1, Math.ceil(registrations.total / registrations.pageSize))

  const handleCancelled = updatedRegistration => {
    setRegistrations(current => ({
      ...current,
      items: current.items.map(item => item.id === updatedRegistration.id ? updatedRegistration : item),
    }))
    showNotice(`Đã hủy lượt đăng ký #${updatedRegistration.id}.`)
  }

  const handleCheckIn = async registration => {
    setCheckingInId(registration.id)
    setActionError(null)
    try {
      const attendance = await checkInReceptionistRegistration(registration.id)
      setCheckIns(current => ({ ...current, [registration.id]: attendance }))
      showNotice(`Đã check-in hội viên #${attendance.memberId} cho buổi học #${attendance.sessionId}.`)
    } catch (requestError) {
      setActionError({
        id: registration.id,
        message: requestErrorMessage(requestError, 'Không thể check-in hội viên.'),
      })
    } finally {
      setCheckingInId(null)
    }
  }

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-registrations-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-member-registrations-title">
      <header><div><span>LỊCH SỬ BUỔI HỌC</span><h2 id="reception-member-registrations-title">Lượt đăng ký của hội viên #{memberId}</h2><p>{registrations.total} lượt đăng ký được tìm thấy.</p></div><button type="button" aria-label="Đóng lịch sử đăng ký" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-registrations-body">
        {loading ? <div className="reception-member-detail-state"><CalendarDays size={26} /><strong>Đang tải lượt đăng ký</strong><span>Dữ liệu đang được đồng bộ từ Class Registrations API.</span></div> : error ? <div className="reception-member-detail-state"><CalendarDays size={26} /><strong>Không thể tải lượt đăng ký</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : registrations.items.length ? <div className="reception-registration-list">{registrations.items.map(item => <article key={item.id}><header><div><small>Mã đăng ký #{item.id}</small><strong>{item.className}</strong></div><div className="reception-registration-card-actions"><b className={String(item.status || '').toLowerCase()}>{item.status}</b>{item.status === 'Registered' && item.sessionId && <>{checkIns[item.id] ? <span className="reception-registration-checked"><CheckCircle2 size={12} />Đã check-in</span> : <button className="checkin" type="button" disabled={checkingInId === item.id} onClick={() => handleCheckIn(item)}><LogIn size={13} />{checkingInId === item.id ? 'Đang check-in...' : 'Check-in'}</button>}{!checkIns[item.id] && <button className="cancel" type="button" disabled={checkingInId === item.id} onClick={() => setCancelRegistration(item)}><Ban size={13} />Hủy đăng ký</button>}</>}</div></header><div><span><small>Mã buổi học</small><strong>{item.sessionId ? `#${item.sessionId}` : 'Chưa gắn buổi'}</strong></span><span><small>Thời gian bắt đầu</small><strong>{item.startsAt ? sessionDateTimeFormatter.format(new Date(item.startsAt)) : 'Chưa xác định'}</strong></span><span><small>Ngày đăng ký</small><strong>{formatMemberDate(item.registrationDate)}</strong></span></div>{actionError?.id === item.id && <p className="reception-registration-action-error" role="alert">{actionError.message}</p>}</article>)}</div> : <div className="reception-member-detail-state"><CalendarDays size={26} /><strong>Chưa có lượt đăng ký</strong><span>Hội viên này chưa đăng ký buổi học nào.</span></div>}
      </div>
      {!loading && !error && pageCount > 1 && <footer className="reception-registration-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Trang trước</button><span>{page}/{pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage(current => current + 1)}>Trang sau</button></footer>}
      {cancelRegistration && <CancelRegistrationDialog registration={cancelRegistration} onClose={() => setCancelRegistration(null)} onCancelled={handleCancelled} />}
    </section>
  </div>
}

function MembersView({ query, showNotice }) {
  const [status, setStatus] = useState('Tất cả')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [registrationsMemberId, setRegistrationsMemberId] = useState(null)
  const [subscriptionMemberId, setSubscriptionMemberId] = useState(null)
  const [subscriptionsMemberId, setSubscriptionsMemberId] = useState(null)
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

  const handleSubscriptionCreated = subscription => {
    showNotice(`Đã đăng ký gói ${subscription.packageName} cho hội viên #${subscription.memberId}.`)
  }

  return <>
    <section className="reception-member-metrics"><article><span><Users size={20} /></span><div><small>Tổng hội viên</small><strong>{loading ? '--' : members.length}</strong><p>Dữ liệu tài khoản</p></div></article><article><span><BadgeCheck size={20} /></span><div><small>Đang hoạt động</small><strong>{loading ? '--' : activeCount}</strong><p>Có thể sử dụng dịch vụ</p></div></article><article><span><Clock3 size={20} /></span><div><small>Ngừng hoạt động</small><strong>{loading ? '--' : members.length - activeCount}</strong><p>Tài khoản đã khóa</p></div></article></section>
    <section className="reception-card reception-table-card reception-members-card">
      <div className="reception-table-tools"><div><strong>Danh sách hội viên</strong><small>{filteredMembers.length} kết quả</small></div><div>{['Tất cả', 'Đang hoạt động', 'Ngừng hoạt động'].map(item => <button type="button" className={status === item ? 'active' : ''} onClick={() => setStatus(item)} key={item}>{item}</button>)}<button className="reception-primary-button" type="button" onClick={() => setShowCreateDialog(true)}><Plus size={14} />Đăng ký hội viên</button></div></div>
      <div className="reception-table-heading"><span>Mã hội viên</span><span>Họ và tên</span><span>Email</span><span>Số điện thoại</span><span>Trạng thái</span></div>
      {loading ? <EmptyState icon={Users} title="Đang tải hội viên" text="Dữ liệu đang được đồng bộ từ Member API." /> : error ? <div className="reception-inline-error"><EmptyState icon={Users} title="Không thể tải hội viên" text={error} /><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : filteredMembers.length ? <div>{filteredMembers.map(member => <button type="button" className="reception-table-row" key={member.memberId} onClick={() => setSelectedMemberId(member.memberId)} aria-label={`Xem chi tiết ${member.fullName}`}><span>#{member.memberId}</span><span>{member.fullName}</span><span>{member.email}</span><span>{member.phone || 'Chưa cập nhật'}</span><span className={member.isActive ? 'reception-member-active' : 'reception-member-inactive'}>{member.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></button>)}</div> : <EmptyState icon={Users} title="Không có hội viên phù hợp" text={query || status !== 'Tất cả' ? 'Thử thay đổi từ khóa hoặc bộ lọc trạng thái.' : 'Hệ thống chưa có tài khoản hội viên.'} />}
    </section>
    {showCreateDialog && <CreateMemberDialog onClose={() => setShowCreateDialog(false)} onCreated={handleCreated} />}
    {selectedMemberId !== null && <MemberDetailDialog memberId={selectedMemberId} onClose={() => setSelectedMemberId(null)} onViewRegistrations={() => { setRegistrationsMemberId(selectedMemberId); setSelectedMemberId(null) }} onViewSubscriptions={() => { setSubscriptionsMemberId(selectedMemberId); setSelectedMemberId(null) }} onRegisterSubscription={() => { setSubscriptionMemberId(selectedMemberId); setSelectedMemberId(null) }} />}
    {registrationsMemberId !== null && <MemberRegistrationsDialog memberId={registrationsMemberId} onClose={() => setRegistrationsMemberId(null)} showNotice={showNotice} />}
    {subscriptionMemberId !== null && <CreateSubscriptionDialog memberId={subscriptionMemberId} onClose={() => setSubscriptionMemberId(null)} onCreated={handleSubscriptionCreated} />}
    {subscriptionsMemberId !== null && <MemberSubscriptionsDialog memberId={subscriptionsMemberId} onClose={() => setSubscriptionsMemberId(null)} showNotice={showNotice} />}
  </>
}

function PaymentsView({ query }) {
  const [status, setStatus] = useState('Tất cả')
  const [paymentItems, setPaymentItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [selectedPaymentId, setSelectedPaymentId] = useState(null)
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')

  useEffect(() => {
    let active = true
    const loadPayments = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getPayments()
        if (active) setPaymentItems(result)
      } catch (requestError) {
        if (active) {
          setPaymentItems([])
          setError(requestErrorMessage(requestError, 'Không thể tải danh sách thanh toán.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadPayments()
    return () => { active = false }
  }, [requestKey])

  const payments = useMemo(() => paymentItems.filter(payment => {
    const matchesStatus = status === 'Tất cả' || paymentStatusLabel(payment.status) === status
    const matchesQuery = !normalizedQuery || `${payment.id} ${payment.memberId} ${payment.subscriptionId || ''} ${payment.transactionReference || ''} ${payment.payOSOrderCode || ''}`.toLocaleLowerCase('vi').includes(normalizedQuery)
    return matchesStatus && matchesQuery
  }), [normalizedQuery, paymentItems, status])
  const completedPayments = paymentItems.filter(payment => payment.status === 'Completed')
  const completedTotal = completedPayments.reduce((sum, payment) => sum + Number(payment.amountReceived || payment.amount || 0), 0)
  const pendingCount = paymentItems.filter(payment => payment.status === 'Pending').length

  return <>
    <section className="reception-payment-metrics"><article><span className="green"><WalletCards size={21} /></span><div><small>Tổng đã thu</small><strong>{loading ? '--' : `${completedTotal.toLocaleString('vi-VN')} đ`}</strong><p>{completedPayments.length} giao dịch thành công</p></div></article><article><span className="amber"><Clock3 size={21} /></span><div><small>Chờ thanh toán</small><strong>{loading ? '--' : pendingCount}</strong><p>Yêu cầu PayOS đang mở</p></div></article><article><span className="blue"><ReceiptText size={21} /></span><div><small>Tổng giao dịch</small><strong>{loading ? '--' : paymentItems.length}</strong><p>Dữ liệu từ Payment API</p></div></article></section>
    <section className="reception-card reception-table-card reception-payments-card"><div className="reception-table-tools"><div><strong>Giao dịch PayOS</strong><small>{payments.length} kết quả</small></div><div>{['Tất cả', 'Thành công', 'Chờ thanh toán', 'Cần kiểm tra', 'Đã hủy'].map(item => <button type="button" className={status === item ? 'active' : ''} onClick={() => setStatus(item)} key={item}>{item}</button>)}</div></div><div className="reception-table-heading"><span>Mã giao dịch</span><span>Hội viên</span><span>Đăng ký gói</span><span>Số tiền</span><span>Trạng thái</span></div>{loading ? <EmptyState icon={ReceiptText} title="Đang tải thanh toán" text="Dữ liệu đang được đồng bộ từ Payment API." /> : error ? <div className="reception-inline-error"><EmptyState icon={ReceiptText} title="Không thể tải thanh toán" text={error} /><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : payments.length ? <div>{payments.map(payment => <button type="button" className="reception-table-row" key={payment.id} onClick={() => setSelectedPaymentId(payment.id)} aria-label={`Xem thanh toán ${payment.id}`}><span>#{payment.id}</span><span>#{payment.memberId}</span><span>{payment.subscriptionId ? `#${payment.subscriptionId}` : 'Không có'}</span><span>{Number(payment.amount || 0).toLocaleString('vi-VN')} đ</span><span className={`reception-payment-status ${String(payment.status || '').toLowerCase()}`}>{paymentStatusLabel(payment.status)}</span></button>)}</div> : <EmptyState icon={ReceiptText} title="Chưa có giao dịch" text={query || status !== 'Tất cả' ? 'Không có giao dịch phù hợp bộ lọc.' : 'Payment API chưa có dữ liệu giao dịch.'} />}</section>
    {selectedPaymentId !== null && <PaymentDetailDialog paymentId={selectedPaymentId} onClose={() => setSelectedPaymentId(null)} />}
  </>
}

function PaymentDetailDialog({ paymentId, onClose }) {
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadPayment = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getPaymentById(paymentId)
        if (active) setPayment(result)
      } catch (requestError) {
        if (active) {
          setPayment(null)
          setError(requestErrorMessage(requestError, 'Không thể tải chi tiết thanh toán.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadPayment()
    return () => { active = false }
  }, [paymentId, requestKey])

  return <div className="reception-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-payment-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-payment-detail-title">
      <header><div><span>CHI TIẾT PAYOS</span><h2 id="reception-payment-detail-title">Thanh toán #{paymentId}</h2><p>Dữ liệu được tải trực tiếp từ Payment API.</p></div><button type="button" aria-label="Đóng chi tiết thanh toán" onClick={onClose}><X size={19} /></button></header>
      <div className="reception-payment-detail-body">{loading ? <div className="reception-member-detail-state"><ReceiptText size={26} /><strong>Đang tải chi tiết thanh toán</strong></div> : error ? <div className="reception-member-detail-state"><ReceiptText size={26} /><strong>Không thể tải chi tiết</strong><span>{error}</span><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></div> : payment && <><div className="reception-payment-detail-title"><span><WalletCards size={23} /></span><div><small>Mã giao dịch</small><h3>#{payment.id}</h3></div><b className={String(payment.status || '').toLowerCase()}>{paymentStatusLabel(payment.status)}</b></div><div className="reception-payment-detail-grid"><div><small>Hội viên</small><strong>#{payment.memberId}</strong></div><div><small>Đăng ký gói</small><strong>{payment.subscriptionId ? `#${payment.subscriptionId}` : 'Không có'}</strong></div><div><small>Số tiền</small><strong>{Number(payment.amount || 0).toLocaleString('vi-VN')} đ</strong></div><div><small>Đã nhận</small><strong>{Number(payment.amountReceived || 0).toLocaleString('vi-VN')} đ</strong></div><div><small>Phương thức</small><strong>{payment.paymentMethod || 'Chưa có'}</strong></div><div><small>Trạng thái PayOS</small><strong>{payment.gatewayStatus || 'Chưa đồng bộ'}</strong></div><div><small>Mã đơn PayOS</small><strong>{payment.payOSOrderCode || 'Chưa có'}</strong></div><div><small>Mã tham chiếu</small><strong>{payment.transactionReference || 'Chưa có'}</strong></div><div><small>Ngày tạo</small><strong>{formatDateTime(payment.createdAt)}</strong></div><div><small>Ngày thanh toán</small><strong>{formatDateTime(payment.paidAt)}</strong></div><div><small>Hết hạn</small><strong>{formatDateTime(payment.expiresAt)}</strong></div><div><small>Lý do kiểm tra</small><strong>{payment.reviewReason || 'Không có'}</strong></div></div>{payment.checkoutUrl && <a className="reception-payment-checkout-link" href={payment.checkoutUrl} target="_blank" rel="noreferrer">Mở trang thanh toán PayOS <ArrowRight size={14} /></a>}</>}
      </div>
    </section>
  </div>
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
