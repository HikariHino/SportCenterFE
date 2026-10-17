import { useEffect, useState } from 'react'
import {
  Award, BadgeCheck, Bell, CalendarCheck, CalendarDays, CheckCircle2,
  Clock3, Coins, CreditCard, Diamond, Dumbbell, ExternalLink, Flame,
  History, Info, LoaderCircle, LogIn, LogOut, MapPin, MessageSquare,
  PauseCircle, Percent, Plus, PlusCircle, QrCode, ReceiptText, RefreshCw,
  Search, ShieldCheck, Sparkles, Timer, Trophy, UserCheck, Users,
  Waves, X, ArrowDownToLine, Check, AlertCircle, FileText, Send, Phone,
  ChevronLeft, ChevronRight, Eye, User, Lock, Save, HelpCircle, Mail,
} from 'lucide-react'
import { getProfile, updateProfile, getProfileErrorMessage } from '../../services/profileService'
import { getMyMemberProfile } from '../../services/memberService'
import { getMembershipPackages } from '../../services/membershipPackageService'
import { getMySubscriptions, createMemberSubscription } from '../../services/memberSubscriptionService'
import { getMyPayments, createPayment, cancelPayment, syncPayment } from '../../services/paymentService'
import { exportInvoicePdf, triggerBlobDownload } from '../../services/reportService'
import { getMyQrCode, getMyGymCheckInHistory, getCheckInErrorMessage } from '../../services/gymCheckInService'
import {
  getAvailableSessions,
  bookSession,
  getMyRegistrations,
  cancelRegistration,
  checkInRegistration,
  getMemberClassErrorMessage,
} from '../../services/memberClassService'
import { getMemberTrainingPlans } from '../../services/trainingPlanService'
import { getMySupportTickets, createSupportTicket, getTicketErrorMessage } from '../../services/supportTicketService'
import { getNotifications, markNotificationRead } from '../../services/notificationService'

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN')
}

/* =========================================================================
   1. TÀI KHOẢN & HỒ SƠ CÁ NHÂN (AuthController, ProfileController)
   ========================================================================= */
export function ProfileView({ user, showNotice }) {
  const [profile, setProfile] = useState(null)
  const [memberInfo, setMemberInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    gender: 'Male',
    dateOfBirth: '',
    address: '',
    fitnessGoal: '',
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' })

  const loadProfile = async () => {
    setLoading(true)
    setError('')
    try {
      const [profData, memData] = await Promise.all([
        getProfile().catch(() => null),
        getMyMemberProfile().catch(() => null),
      ])
      setProfile(profData)
      setMemberInfo(memData)

      setFormData({
        fullName: profData?.fullName || memData?.fullName || user?.fullName || '',
        email: profData?.email || memData?.email || user?.email || '',
        phoneNumber: profData?.phoneNumber || memData?.phone || '',
        gender: memData?.gender || 'Male',
        dateOfBirth: memData?.dateOfBirth ? String(memData.dateOfBirth).slice(0, 10) : '',
        address: memData?.address || '',
        fitnessGoal: memData?.fitnessGoal || '',
      })
    } catch (err) {
      setError(getProfileErrorMessage(err, 'Không thể tải thông tin cá nhân.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await updateProfile({
        fullName: formData.fullName.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        email: formData.email.trim(),
      })
      showNotice('Cập nhật hồ sơ cá nhân thành công!')
      loadProfile()
    } catch (err) {
      setError(getProfileErrorMessage(err, 'Không thể lưu hồ sơ.'))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      setPasswordMsg({ type: 'error', text: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.' })
      return
    }
    if (passwordData.newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Mật khẩu mới phải có tối thiểu 8 ký tự.' })
      return
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Xác nhận mật khẩu mới không khớp.' })
      return
    }

    setPasswordSaving(true)
    setPasswordMsg({ type: '', text: '' })
    try {
      await updateProfile({
        currentPassword: passwordData.currentPassword,
        password: passwordData.newPassword,
      })
      setPasswordMsg({ type: 'success', text: 'Đổi mật khẩu thành công!' })
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      showNotice('Đổi mật khẩu thành công!')
    } catch (err) {
      setPasswordMsg({ type: 'error', text: getProfileErrorMessage(err, 'Không thể đổi mật khẩu.') })
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) {
    return <div className="member-card member-api-state"><LoaderCircle className="member-spin" size={26} /><strong>Đang tải hồ sơ cá nhân...</strong></div>
  }

  const initials = (formData.fullName || user?.fullName || 'HV').split(/\s+/).slice(-2).map(p => p[0]).join('').toUpperCase()

  return (
    <div className="member-view-stack">
      <div className="member-section-heading">
        <div>
          <p className="member-eyebrow"><ShieldCheck size={16} /> AUTH & PROFILE CONTROLLER</p>
          <h2>Tài khoản & Hồ sơ cá nhân</h2>
          <p className="member-muted">Quản lý hồ sơ định danh hội viên, thông tin liên lạc và bảo mật tài khoản.</p>
        </div>
      </div>

      {error && <div className="member-api-message member-api-message--error"><AlertCircle size={17} /><span>{error}</span></div>}

      <div className="member-overview">
        {/* Thẻ định danh Hội viên */}
        <article className="member-id-card">
          <div className="member-row">
            <span className="member-tag member-tag--gold">Thành viên Olympus</span>
            <span className="member-id-number">#{memberInfo?.memberId ? `MEM-${memberInfo.memberId}` : `USR-${profile?.userId || user?.userId}`}</span>
            <Award size={25} />
          </div>
          <div className="member-identity">
            <span className="member-avatar member-avatar--large">{initials}</span>
            <div>
              <h1>{formData.fullName || user?.fullName}</h1>
              <p>Email: {formData.email}</p>
              <div className="member-identity-status">
                <span className="member-status"><span />Đang hoạt động</span>
                <small>• Quyền: {profile?.roleName || 'Member'}</small>
              </div>
            </div>
          </div>
          <div className="member-quick-pass">
            <span className="member-qr"><QrCode size={34} /></span>
            <div>
              <strong>Thẻ hội viên điện tử</strong>
              <small>Mã số: SP-OLYMPUS-{memberInfo?.memberId || user?.userId || '001'}</small>
            </div>
          </div>
          <div className="member-wallet">
            <div>
              <small>Ngày tạo tài khoản</small>
              <strong>{formatDate(profile?.createdAt || memberInfo?.createdAt)}</strong>
            </div>
            <span className="member-tag member-tag--green">Đã xác minh</span>
          </div>
        </article>

        {/* Biểu mẫu chỉnh sửa thông tin */}
        <article className="member-card" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={18} style={{ color: 'var(--member-blue)' }} /> Thông tin cá nhân
          </h3>
          <form onSubmit={handleUpdateProfile} style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Họ và tên</label>
                <input
                  type="text"
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Số điện thoại</label>
                <input
                  type="tel"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                  value={formData.phoneNumber}
                  onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="0912..."
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Email tài khoản</label>
                <input
                  type="email"
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Giới tính</label>
                <select
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                  value={formData.gender}
                  onChange={e => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="Male">Nam</option>
                  <option value="Female">Nữ</option>
                  <option value="Other">Khác</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Ngày sinh</label>
                <input
                  type="date"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                  value={formData.dateOfBirth}
                  onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Mục tiêu tập luyện</label>
                <input
                  type="text"
                  placeholder="Tăng cơ, giảm mỡ, rèn thể lực..."
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                  value={formData.fitnessGoal}
                  onChange={e => setFormData({ ...formData, fitnessGoal: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Địa chỉ thường trú</label>
              <input
                type="text"
                placeholder="Số nhà, đường, quận/huyện..."
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" disabled={saving} className="member-button member-button--primary">
                {saving ? <><LoaderCircle className="member-spin" size={16} /> Đang lưu...</> : <><Save size={16} /> Lưu thay đổi hồ sơ</>}
              </button>
            </div>
          </form>
        </article>
      </div>

      {/* Đổi mật khẩu tài khoản */}
      <article className="member-card" style={{ padding: 24, marginTop: 24 }}>
        <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={18} style={{ color: 'var(--member-blue)' }} /> Đổi mật khẩu tài khoản
        </h3>
        {passwordMsg.text && (
          <div className={`member-api-message ${passwordMsg.type === 'error' ? 'member-api-message--error' : ''}`} style={passwordMsg.type === 'success' ? { background: '#e6faf2', color: '#079669', border: '1px solid #a7f3d0' } : {}}>
            <Info size={16} /> <span>{passwordMsg.text}</span>
          </div>
        )}
        <form onSubmit={handleUpdatePassword} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Mật khẩu hiện tại</label>
            <input
              type="password"
              required
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
              value={passwordData.currentPassword}
              onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Mật khẩu mới (tối thiểu 8 ký tự)</label>
            <input
              type="password"
              required
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
              value={passwordData.newPassword}
              onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Xác nhận mật khẩu mới</label>
            <input
              type="password"
              required
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
              value={passwordData.confirmPassword}
              onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="submit" disabled={passwordSaving} className="member-button member-button--soft">
              {passwordSaving ? <><LoaderCircle className="member-spin" size={16} /> Đang cập nhật...</> : <><Lock size={16} /> Cập nhật mật khẩu</>}
            </button>
          </div>
        </form>
      </article>
    </div>
  )
}

/* =========================================================================
   2. GÓI TẬP & THẺ HỘI VIÊN (MemberSubscriptionsController)
   ========================================================================= */
export { SubscriptionsView } from './SubscriptionsView'


/* =========================================================================
   3. THANH TOÁN TRỰC TUYẾN & HÓA ĐƠN (PaymentsController)
   ========================================================================= */
export { PaymentsView } from './PaymentsView'


/* =========================================================================
   4. RA / VÀO PHÒNG GYM (GymCheckInsController)
   ========================================================================= */
export function GymCheckInView({ showNotice }) {
  const [qrInfo, setQrInfo] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [qr, hist] = await Promise.all([
        getMyQrCode().catch(() => null),
        getMyGymCheckInHistory().catch(() => []),
      ])
      setQrInfo(qr)
      setHistory(Array.isArray(hist) ? hist : [])
    } catch (err) {
      setError(getCheckInErrorMessage(err, 'Không thể tải dữ liệu check-in.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return <div className="member-card member-api-state"><LoaderCircle className="member-spin" size={26} /><strong>Đang tải mã QR và lịch sử ra/vào phòng gym...</strong></div>
  }

  const qrImageUrl = qrInfo?.qrData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrInfo.qrData)}`
    : null

  return (
    <div className="member-view-stack">
      <div className="member-section-heading">
        <div>
          <p className="member-eyebrow"><QrCode size={16} /> GYM CHECK-INS CONTROLLER</p>
          <h2>Ra / Vào phòng gym</h2>
          <p className="member-muted">Sử dụng mã QR điện tử để quét tại cửa quay / quầy lễ tân và theo dõi lịch sử ra vào.</p>
        </div>
        <button type="button" className="member-button" onClick={loadData}><RefreshCw size={15} /> Làm mới mã</button>
      </div>

      {error && <div className="member-api-message member-api-message--error"><AlertCircle size={17} /><span>{error}</span></div>}

      <div className="member-overview">
        {/* Khung quét mã QR */}
        <article className="member-card" style={{ padding: 26, textAlign: 'center' }}>
          <h3 style={{ marginBottom: 12 }}>Mã thẻ QR điện tử</h3>
          <p className="member-muted" style={{ fontSize: 11, marginBottom: 18 }}>
            Đưa mã này lại gần đầu đọc tại cổng quay tự động hoặc cho nhân viên lễ tân quét.
          </p>

          <div style={{ display: 'inline-block', padding: 16, background: '#fff', border: '2px solid #e2e8f0', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
            {qrImageUrl ? (
              <img src={qrImageUrl} alt="Mã QR Check-in hội viên" style={{ width: 190, height: 190, display: 'block' }} />
            ) : (
              <div style={{ width: 190, height: 190, display: 'grid', placeItems: 'center', background: '#f8fafc' }}>
                <QrCode size={80} style={{ color: '#94a3b8' }} />
              </div>
            )}
          </div>

          <div style={{ marginTop: 18 }}>
            <span className={`member-status ${qrInfo?.packageStatus === 'Active' ? '' : 'member-status--pending'}`}>
              <span />{qrInfo?.packageStatus === 'Active' ? 'Thẻ hợp lệ · Sẵn sàng vào tập' : 'Chưa kích hoạt gói'}
            </span>
            <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
              Mã hội viên: <strong>{qrInfo?.memberCode || 'SP-MEM'}</strong> · {qrInfo?.fullName}
            </div>
            {qrInfo?.packageName && (
              <div style={{ fontSize: 10, color: '#004ac6', marginTop: 4, fontWeight: 600 }}>
                Gói tập: {qrInfo.packageName}
              </div>
            )}
          </div>
        </article>

        {/* Thống kê ra vào */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="member-metrics" style={{ margin: 0, gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="member-card">
              <span className="member-metric-icon"><CalendarCheck size={26} /></span>
              <div>
                <p>Tổng lượt tập đã ghi nhận</p>
                <strong>{history.length} <small>lượt</small></strong>
              </div>
            </div>
            <div className="member-card">
              <span className="member-metric-icon member-tag--green"><Timer size={26} /></span>
              <div>
                <p>Trạng thái hiện tại</p>
                <strong>{history[0] && !history[0].checkOutTime ? 'Trong phòng' : 'Đã check-out'}</strong>
              </div>
            </div>
          </div>

          <article className="member-card" style={{ padding: 20, flex: 1 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} style={{ color: 'var(--member-blue)' }} /> Quy định ra vào phòng gym
            </h4>
            <ul style={{ listStyle: 'disc', paddingLeft: 18, fontSize: 11, color: '#64748b', lineHeight: 1.8 }}>
              <li>Quét mã QR khi vào phòng tập và khi kết thúc buổi tập để hệ thống tính thời lượng.</li>
              <li>Mỗi mã QR gắn liền với định danh hội viên chính chủ, vui lòng không chia sẻ cho người khác.</li>
              <li>Hội viên cần trang bị trang phục thể thao và khăn tập cá nhân khi vào khu vực máy tập.</li>
            </ul>
          </article>
        </div>
      </div>

      {/* Lịch sử ra vào */}
      <h3 style={{ fontSize: 16, margin: '28px 0 14px' }}>Lịch sử ra / vào gần đây</h3>
      <div className="member-card member-table-card">
        <div className="member-table-scroll">
          <table>
            <thead>
              <tr>
                <th>MÃ CHECK-IN</th>
                <th>GIỜ VÀO (CHECK-IN)</th>
                <th>GIỜ RA (CHECK-OUT)</th>
                <th>GÓI ÁP DỤNG</th>
                <th>NHÂN VIÊN / CỔNG</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={6} className="member-empty">Chưa có lượt ra vào phòng gym nào.</td></tr>
              ) : (
                history.map(item => (
                  <tr key={item.id}>
                    <td><strong>#CHK-{item.id}</strong></td>
                    <td><strong>{formatDateTime(item.checkInTime)}</strong></td>
                    <td>{item.checkOutTime ? formatDateTime(item.checkOutTime) : <span style={{ color: '#059669', fontWeight: 600 }}>Đang trong phòng tập</span>}</td>
                    <td>{item.packageName || 'Gói thành viên'}</td>
                    <td>{item.checkedByStaffName || 'Cổng tự động'}</td>
                    <td>
                      <span className={`member-status ${item.checkOutTime ? '' : 'member-status--green'}`}>
                        <span />{item.checkOutTime ? 'Hoàn thành' : 'Đang tập'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   5. LỚP HỌC & ĐẶT LỊCH BUỔI HỌC (ClassSessionsController, ClassRegistrationsController)
   ========================================================================= */
export function ClassesView({ showNotice }) {
  const [tab, setTab] = useState('mine') // 'mine' | 'browse'
  const [registrations, setRegistrations] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [regData, sessData] = await Promise.all([
        getMyRegistrations({ page: 1, pageSize: 50 }).catch(() => ({ items: [] })),
        getAvailableSessions({ page: 1, pageSize: 50 }).catch(() => ({ items: [] })),
      ])
      setRegistrations(regData.items || [])
      setSessions(sessData.items || [])
    } catch (err) {
      setError(getMemberClassErrorMessage(err, 'Không thể tải thông tin lớp học.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleBook = async (sessionId) => {
    setActionId(sessionId)
    try {
      await bookSession(sessionId)
      showNotice('Đặt lịch buổi học thành công!')
      loadData()
      setTab('mine')
    } catch (err) {
      alert('Không thể đặt lịch: ' + (err.message || 'Lỗi'))
    } finally {
      setActionId(null)
    }
  }

  const handleCancel = async (registrationId) => {
    const reason = window.prompt('Nhập lý do hủy lịch:', 'Hội viên có việc bận đột xuất')
    if (!reason) return
    setActionId(registrationId)
    try {
      await cancelRegistration(registrationId, reason)
      showNotice('Đã hủy lịch buổi học thành công.')
      loadData()
    } catch (err) {
      alert('Không thể hủy lịch: ' + (err.message || 'Lỗi'))
    } finally {
      setActionId(null)
    }
  }

  const handleCheckIn = async (registrationId) => {
    setActionId(registrationId)
    try {
      await checkInRegistration(registrationId)
      showNotice('Điểm danh / Check-in buổi học thành công!')
      loadData()
    } catch (err) {
      alert('Không thể điểm danh: ' + (err.message || 'Lỗi'))
    } finally {
      setActionId(null)
    }
  }

  if (loading) {
    return <div className="member-card member-api-state"><LoaderCircle className="member-spin" size={26} /><strong>Đang tải danh sách lớp học & buổi học...</strong></div>
  }

  return (
    <div className="member-view-stack">
      <div className="member-section-heading">
        <div>
          <p className="member-eyebrow"><CalendarDays size={16} /> CLASS SESSIONS & REGISTRATIONS CONTROLLER</p>
          <h2>Lớp học & Đặt lịch buổi học</h2>
          <p className="member-muted">Quản lý lịch học cá nhân và khám phá các lớp Yoga, Gym, Boxing, Bơi lội tại Olympus.</p>
        </div>
        <div className="member-filters" role="group">
          <button type="button" aria-pressed={tab === 'mine'} onClick={() => setTab('mine')}>Lịch học của tôi ({registrations.length})</button>
          <button type="button" aria-pressed={tab === 'browse'} onClick={() => setTab('browse')}>Đặt lịch buổi học mới ({sessions.length})</button>
        </div>
      </div>

      {error && <div className="member-api-message member-api-message--error"><AlertCircle size={17} /><span>{error}</span></div>}

      {tab === 'mine' ? (
        <div className="member-card member-table-card">
          <div className="member-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>MÃ ĐĂNG KÝ</th>
                  <th>LỚP HỌC / BUỔI HỌC</th>
                  <th>GIÁO VIÊN / HLV</th>
                  <th>THỜI GIAN BUỔI HỌC</th>
                  <th>PHÒNG HỌC</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {registrations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="member-empty">
                      Bạn chưa đăng ký buổi học nào.{' '}
                      <button type="button" className="member-button member-button--primary" style={{ marginLeft: 8 }} onClick={() => setTab('browse')}>
                        Đặt lịch ngay
                      </button>
                    </td>
                  </tr>
                ) : (
                  registrations.map(reg => (
                    <tr key={reg.id}>
                      <td><strong>#REG-{reg.id}</strong></td>
                      <td>
                        <strong>{reg.className || `Buổi học #${reg.sessionId}`}</strong>
                        <small>Buổi #{reg.sessionId}</small>
                      </td>
                      <td>{reg.coachName || 'Huấn luyện viên'}</td>
                      <td>
                        <span className="member-inline"><Clock3 size={14} /> {formatDateTime(reg.startsAt || reg.sessionDate)}</span>
                      </td>
                      <td>{reg.roomName || 'Phòng đa năng'}</td>
                      <td>
                        <span className={`member-status ${String(reg.status).toLowerCase() === 'confirmed' || String(reg.status).toLowerCase() === 'attended' ? '' : 'member-status--pending'}`}>
                          <span />{reg.status}
                        </span>
                      </td>
                      <td>
                        <div className="member-actions">
                          {String(reg.status).toLowerCase() !== 'cancelled' && String(reg.status).toLowerCase() !== 'attended' && (
                            <>
                              <button
                                type="button"
                                className="member-button member-button--primary"
                                disabled={actionId === reg.id}
                                onClick={() => handleCheckIn(reg.id)}
                              >
                                <Check size={14} /> Điểm danh
                              </button>
                              <button
                                type="button"
                                className="member-button member-button--text"
                                disabled={actionId === reg.id}
                                onClick={() => handleCancel(reg.id)}
                              >
                                Hủy lịch
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
          {sessions.length === 0 ? (
            <div className="member-card member-empty" style={{ gridColumn: '1 / -1' }}>
              Hiện chưa có buổi học nào đang mở đăng ký.
            </div>
          ) : (
            sessions.map(sess => (
              <article key={sess.id} className="member-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="member-row">
                  <span className="member-tag member-tag--green">{sess.sportName || 'Thể thao'}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Buổi #{sess.id}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 16, margin: '4px 0' }}>{sess.className || 'Lớp rèn luyện chuyên sâu'}</h3>
                  <p style={{ fontSize: 11, color: '#64748b' }}>Huấn luyện viên: <strong>{sess.coachName || 'Olympus Coach'}</strong></p>
                </div>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 11, display: 'grid', gap: 6 }}>
                  <div><Clock3 size={14} style={{ verticalAlign: -2, marginRight: 5, color: '#004ac6' }} /> Bắt đầu: <strong>{formatDateTime(sess.startsAt)}</strong></div>
                  <div><Clock3 size={14} style={{ verticalAlign: -2, marginRight: 5, color: '#004ac6' }} /> Kết thúc: <strong>{formatDateTime(sess.endsAt)}</strong></div>
                  <div><MapPin size={14} style={{ verticalAlign: -2, marginRight: 5, color: '#004ac6' }} /> Phòng tập: <strong>{sess.roomName || 'Phòng thể thao'}</strong></div>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    Sĩ số: <strong>{sess.enrolledCount || 0} / {sess.capacity || 20}</strong>
                  </span>
                  <button
                    type="button"
                    disabled={actionId === sess.id || (sess.enrolledCount >= sess.capacity && sess.capacity > 0)}
                    className="member-button member-button--primary"
                    onClick={() => handleBook(sess.id)}
                  >
                    {actionId === sess.id ? <LoaderCircle className="member-spin" size={14} /> : <PlusCircle size={14} />} Đặt lịch ngay
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   6. LỘ TRÌNH TẬP LUYỆN CÁ NHÂN (TrainingPlansController)
   ========================================================================= */
export function TrainingPlansView({ user }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadPlans = async () => {
      setLoading(true)
      setError('')
      try {
        const memberProf = await getMyMemberProfile().catch(() => null)
        const memberId = memberProf?.memberId || user?.memberId || user?.userId
        if (memberId) {
          const data = await getMemberTrainingPlans(memberId)
          setPlans(Array.isArray(data) ? data : [])
        } else {
          setPlans([])
        }
      } catch (err) {
        setError(err.message || 'Không thể tải lộ trình tập luyện.')
      } finally {
        setLoading(false)
      }
    }
    loadPlans()
  }, [user])

  if (loading) {
    return <div className="member-card member-api-state"><LoaderCircle className="member-spin" size={26} /><strong>Đang tải lộ trình tập luyện cá nhân...</strong></div>
  }

  return (
    <div className="member-view-stack">
      <div className="member-section-heading">
        <div>
          <p className="member-eyebrow"><Dumbbell size={16} /> TRAINING PLANS CONTROLLER</p>
          <h2>Lộ trình tập luyện cá nhân</h2>
          <p className="member-muted">Giáo án và lộ trình vận động do Huấn luyện viên thiết kế chuyên biệt cho bạn.</p>
        </div>
      </div>

      {error && <div className="member-api-message member-api-message--error"><AlertCircle size={17} /><span>{error}</span></div>}

      {plans.length === 0 ? (
        <article className="member-card" style={{ padding: 40, textAlign: 'center' }}>
          <Dumbbell size={48} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
          <h3>Chưa có giáo án tập luyện cá nhân</h3>
          <p className="member-muted" style={{ maxWidth: 460, margin: '6px auto 16px' }}>
            Huấn luyện viên phụ trách sẽ thiết kế lộ trình rèn luyện riêng sau khi đánh giá chỉ số thể lực của bạn.
          </p>
        </article>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>
          {plans.map(plan => (
            <article key={plan.id} className="member-card" style={{ padding: 24 }}>
              <div className="member-row" style={{ marginBottom: 12 }}>
                <span className="member-tag member-tag--green">Mục tiêu: {plan.goal || 'Phát triển thể lực'}</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>HLV: <strong>{plan.coachName || 'Huấn luyện viên'}</strong></span>
              </div>
              <h3 style={{ fontSize: 18, margin: '6px 0 4px' }}>{plan.planName}</h3>
              <p className="member-muted" style={{ fontSize: 11, marginBottom: 16 }}>
                Thời gian áp dụng: {formatDate(plan.startDate)} đến {formatDate(plan.endDate)}
              </p>

              <h4 style={{ fontSize: 13, marginBottom: 10 }}>Danh sách bài tập trong giáo án:</h4>
              <div className="member-table-scroll" style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>BÀI TẬP</th>
                      <th>SETS</th>
                      <th>REPS</th>
                      <th>TRỌNG LƯỢNG</th>
                      <th>HƯỚNG DẪN KỸ THUẬT</th>
                      <th>KẾT QUẢ / GHI CHÚ HLV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.exercises?.map((ex, idx) => (
                      <tr key={idx}>
                        <td><strong>{ex.exerciseName}</strong></td>
                        <td>{ex.sets || 3} hiệp</td>
                        <td>{ex.reps || 12} lần</td>
                        <td>{ex.weight ? `${ex.weight} kg` : 'Bodyweight'}</td>
                        <td style={{ maxWidth: 260 }}>{ex.instructions || 'Thực hiện chuẩn form'}</td>
                        <td>
                          {ex.notes ? (
                            <span style={{ color: '#004ac6', fontWeight: 600 }}>{ex.notes}</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Chưa ghi nhận</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   7. HỖ TRỢ KHÁCH HÀNG (SupportTicketsController)
   ========================================================================= */
export function SupportTicketsView({ showNotice }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'Normal' })

  const loadTickets = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getMySupportTickets()
      setTickets(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(getTicketErrorMessage(err, 'Không thể tải phiếu hỗ trợ.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newTicket.title.trim() || !newTicket.description.trim()) return
    setCreating(true)
    try {
      await createSupportTicket(newTicket)
      showNotice('Gửi phiếu hỗ trợ thành công! Ban quản trị sẽ phản hồi sớm nhất.')
      setShowModal(false)
      setNewTicket({ title: '', description: '', priority: 'Normal' })
      loadTickets()
    } catch (err) {
      alert('Không thể gửi phiếu hỗ trợ: ' + (err.message || 'Lỗi'))
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <div className="member-card member-api-state"><LoaderCircle className="member-spin" size={26} /><strong>Đang tải phiếu hỗ trợ khách hàng...</strong></div>
  }

  return (
    <div className="member-view-stack">
      <div className="member-section-heading">
        <div>
          <p className="member-eyebrow"><Headset size={16} /> SUPPORT TICKETS CONTROLLER</p>
          <h2>Hỗ trợ khách hàng</h2>
          <p className="member-muted">Gửi yêu cầu trợ giúp, khiếu nại chất lượng dịch vụ và theo dõi phản hồi từ quản lý.</p>
        </div>
        <button type="button" className="member-button member-button--primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Gửi yêu cầu hỗ trợ mới
        </button>
      </div>

      {error && <div className="member-api-message member-api-message--error"><AlertCircle size={17} /><span>{error}</span></div>}

      <div className="member-card member-table-card">
        <div className="member-table-scroll">
          <table>
            <thead>
              <tr>
                <th>MÃ PHIẾU</th>
                <th>TIÊU ĐỀ</th>
                <th>MỨC ĐỘ</th>
                <th>NGÀY GỬI</th>
                <th>TRẠNG THÁI</th>
                <th>PHẢN HỒI XỬ LÝ TỪ QUẢN TRỊ</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr><td colSpan={6} className="member-empty">Bạn chưa có phiếu hỗ trợ nào.</td></tr>
              ) : (
                tickets.map(t => (
                  <tr key={t.id}>
                    <td><strong>#TICK-{t.id}</strong></td>
                    <td style={{ maxWidth: 280 }}>
                      <strong>{t.title}</strong>
                      <small>{t.description}</small>
                    </td>
                    <td>
                      <span className={`member-tag ${t.priority === 'Urgent' ? 'member-tag--gold' : ''}`}>
                        {t.priority || 'Normal'}
                      </span>
                    </td>
                    <td>{formatDateTime(t.createdAt)}</td>
                    <td>
                      <span className={`member-status ${String(t.status).toLowerCase() === 'resolved' ? '' : 'member-status--pending'}`}>
                        <span />{t.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 300 }}>
                      {t.resolutionNote ? (
                        <div>
                          <strong style={{ color: '#004ac6' }}>{t.resolutionNote}</strong>
                          <small>Người xử lý: {t.handledByUserName || 'Quản lý trung tâm'} · {formatDate(t.resolvedAt)}</small>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Đang chờ tiếp nhận & xử lý</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal gửi ticket */}
      {showModal && (
        <div className="member-dialog-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'grid', placeItems: 'center', padding: 20 }}>
          <div className="member-dialog" style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="member-dialog-heading">
              <h2>Gửi yêu cầu hỗ trợ mới</h2>
              <button type="button" className="member-icon-button" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Tiêu đề yêu cầu</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Vấn đề với thẻ phòng tập, phản ánh lớp học..."
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                  value={newTicket.title}
                  onChange={e => setNewTicket({ ...newTicket, title: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Mức độ ưu tiên</label>
                <select
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                  value={newTicket.priority}
                  onChange={e => setNewTicket({ ...newTicket, priority: e.target.value })}
                >
                  <option value="Normal">Bình thường (Normal)</option>
                  <option value="High">Cao (High)</option>
                  <option value="Urgent">Khẩn cấp (Urgent)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Nội dung chi tiết</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Mô tả cụ thể sự việc hoặc nội dung bạn cần hỗ trợ..."
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                  value={newTicket.description}
                  onChange={e => setNewTicket({ ...newTicket, description: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="member-button" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" disabled={creating} className="member-button member-button--primary" style={{ flex: 1 }}>
                  {creating ? <><LoaderCircle className="member-spin" size={15} /> Đang gửi...</> : <><Send size={15} /> Gửi yêu cầu</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   8. THÔNG BÁO HỆ THỐNG (NotificationsController)
   ========================================================================= */
export function NotificationsView({ showNotice }) {
  const [notifications, setNotifications] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [markingId, setMarkingId] = useState(null)

  const loadNotifications = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getNotifications({ page, pageSize: 10, unreadOnly })
      setNotifications(data.items || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err.message || 'Không thể tải thông báo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [page, unreadOnly])

  const handleMarkRead = async (id) => {
    setMarkingId(id)
    try {
      await markNotificationRead(id)
      setNotifications(prev => prev.map(item => item.id === id ? { ...item, isRead: true } : item))
      showNotice('Đã đánh dấu thông báo đã đọc.')
    } catch (err) {
      alert('Không thể cập nhật: ' + (err.message || 'Lỗi'))
    } finally {
      setMarkingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 10))

  return (
    <div className="member-view-stack">
      <div className="member-section-heading">
        <div>
          <p className="member-eyebrow"><Bell size={16} /> NOTIFICATIONS CONTROLLER</p>
          <h2>Thông báo hệ thống</h2>
          <p className="member-muted">Cập nhật tin tức câu lạc bộ, nhắc lịch học, kết quả thanh toán và thông báo từ trung tâm.</p>
        </div>
        <div className="member-filters" role="group">
          <button type="button" aria-pressed={!unreadOnly} onClick={() => { setUnreadOnly(false); setPage(1) }}>Tất cả</button>
          <button type="button" aria-pressed={unreadOnly} onClick={() => { setUnreadOnly(true); setPage(1) }}>Chưa đọc</button>
        </div>
      </div>

      {error && <div className="member-api-message member-api-message--error"><AlertCircle size={17} /><span>{error}</span></div>}

      {loading ? (
        <div className="member-card member-api-state"><LoaderCircle className="member-spin" size={26} /><strong>Đang tải thông báo...</strong></div>
      ) : notifications.length === 0 ? (
        <article className="member-card member-empty">
          <Bell size={36} style={{ color: '#94a3b8', margin: '0 auto 8px' }} />
          <strong>Không có thông báo nào.</strong>
        </article>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {notifications.map(item => (
            <article
              key={item.id}
              className="member-card"
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                background: item.isRead ? '#fff' : '#f0f5ff',
                borderColor: item.isRead ? '#dfe3ee' : '#bfd2f8',
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: item.isRead ? '#f1f5f9' : '#dbeafe', color: 'var(--member-blue)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Bell size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: item.isRead ? 600 : 700 }}>{item.title}</h4>
                  <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>{formatDateTime(item.sentAt)}</span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: item.isRead ? '#475569' : '#1e293b', lineHeight: 1.6 }}>{item.content}</p>
              </div>
              {!item.isRead && (
                <button
                  type="button"
                  disabled={markingId === item.id}
                  className="member-button member-button--soft"
                  style={{ fontSize: 10, padding: '6px 10px', flexShrink: 0 }}
                  onClick={() => handleMarkRead(item.id)}
                >
                  <CheckCircle2 size={13} /> {markingId === item.id ? 'Đang lưu...' : 'Đã đọc'}
                </button>
              )}
            </article>
          ))}

          {/* Phân trang */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <button
                type="button"
                className="member-button"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> Trang trước
              </button>
              <span style={{ fontSize: 11, color: '#64748b' }}>Trang {page} / {totalPages}</span>
              <button
                type="button"
                className="member-button"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Trang sau <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
