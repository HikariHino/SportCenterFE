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
import ChangeEmailForm from '../../components/ChangeEmailForm'

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
    emergencyContact: '',
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
        getProfile(),
        getMyMemberProfile().catch(() => null),
      ])
      setProfile(profData)
      setMemberInfo(memData)

      setFormData({
        fullName: profData?.fullName || memData?.fullName || user?.fullName || '',
        email: profData?.email || memData?.email || user?.email || '',
        phoneNumber: profData?.phoneNumber || memData?.phone || '',
        gender: profData.gender ?? '',
        dateOfBirth: profData.dateOfBirth ? String(profData.dateOfBirth).slice(0, 10) : '',
        address: profData.address ?? '',
        fitnessGoal: profData.fitnessGoal ?? '',
        emergencyContact: profData.emergencyContact ?? '',
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
      const result = await updateProfile({
        fullName: formData.fullName.trim(),
        phoneNumber: formData.phoneNumber.trim() || null,
        dateOfBirth: formData.dateOfBirth ? `${formData.dateOfBirth}T00:00:00.000Z` : undefined,
        gender: formData.gender,
        address: formData.address.trim(),
        fitnessGoal: formData.fitnessGoal.trim(),
        emergencyContact: formData.emergencyContact.trim(),
      })
      setProfile(result)
      showNotice('Cập nhật hồ sơ cá nhân thành công!')
      await loadProfile()
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
                  maxLength={200}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Số điện thoại</label>
                <input
                  type="tel"
                  maxLength={30}
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
                  readOnly
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                  value={formData.email}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Giới tính</label>
                <select
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                  value={formData.gender}
                  onChange={e => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="">Chưa cập nhật</option>
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
                  max={new Date().toISOString().slice(0, 10)}
                  required={Boolean(profile?.dateOfBirth)}
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
                  maxLength={100}
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
                maxLength={500}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }}
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="member-emergency-contact" style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Liên hệ khẩn cấp</label>
              <input id="member-emergency-contact" type="text" maxLength={100} placeholder="Tên và số điện thoại người liên hệ" style={{ width: '100%', padding: '9px 12px', border: '1px solid #cdd3e1', borderRadius: 7 }} value={formData.emergencyContact} onChange={e => setFormData({ ...formData, emergencyContact: e.target.value })} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" disabled={saving} className="member-button member-button--primary">
                {saving ? <><LoaderCircle className="member-spin" size={16} /> Đang lưu...</> : <><Save size={16} /> Lưu thay đổi hồ sơ</>}
              </button>
            </div>
          </form>
        </article>
      </div>

      <ChangeEmailForm currentEmail={profile?.email || formData.email} disabled={saving || passwordSaving} />

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
              minLength={8}
              maxLength={72}
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
export { GymCheckInView } from './GymCheckInView'

/* =========================================================================
   5. LỚP HỌC & ĐẶT LỊCH BUỔI HỌC (ClassSessionsController, ClassRegistrationsController)
   ========================================================================= */
export { ClassesView } from './ClassesView'

/* =========================================================================
   6. LỘ TRÌNH TẬP LUYỆN CÁ NHÂN (TrainingPlansController)
   ========================================================================= */
export { TrainingPlansView } from './TrainingPlansView'

/* =========================================================================
   7. HỖ TRỢ KHÁCH HÀNG (SupportTicketsController)
   ========================================================================= */
export { SupportTicketsView } from './SupportTicketsView'

/* =========================================================================
   8. THÔNG BÁO HỆ THỐNG (NotificationsController)
   ========================================================================= */
export { NotificationsView } from './NotificationsView'
