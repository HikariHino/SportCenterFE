import { useEffect, useRef, useState } from 'react'
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
import { getFullNameValidationError, getVietnamPhoneValidationError, PROFILE_FULL_NAME_MAX_LENGTH, PROFILE_PHONE_LENGTH } from '../../utils/profileValidation'
import { getProfilePhoneConflict, passwordChangeErrors, profileDateLimit, profileFieldErrors, profileValidationErrors } from '../../utils/profileValidation'
import '../../style/member/ProfileValidation.css'
import '../../style/member/MemberProfile.css'

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
  const profileForm = useRef(null)
  const saveLock = useRef(false)
  const passwordForm = useRef(null)
  const passwordLock = useRef(false)
  const [profile, setProfile] = useState(null)
  const [memberInfo, setMemberInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [phoneConflict, setPhoneConflict] = useState(null)
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
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({})

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

  const validationOptions = { requirePhone: Boolean(profile?.phoneNumber || memberInfo?.phone), requireDateOfBirth: Boolean(profile?.dateOfBirth), phoneConflict }
  const validateProfile = values => {
    const errors = profileValidationErrors(values, validationOptions)
    const nameError = getFullNameValidationError(values.fullName)
    const phoneError = getVietnamPhoneValidationError(values.phoneNumber, { required: validationOptions.requirePhone })
    if (nameError) errors.fullName = nameError
    if (phoneError) errors.phoneNumber = phoneError
    return errors
  }
  const hasPhoneConflict = Boolean(getProfilePhoneConflict(formData.phoneNumber, phoneConflict))
  const focusProfileError = errors => window.requestAnimationFrame(() => profileForm.current?.elements.namedItem(Object.keys(errors)[0])?.focus())
  const changeProfileField = (name, value) => {
    const next = { ...formData, [name]: value }
    setFormData(next)
    setError('')
    if (fieldErrors[name] || name === 'phoneNumber') setFieldErrors(previous => ({ ...previous, [name]: validateProfile(next)[name] }))
  }
  const profileInputProps = name => ({
    id: `member-profile-${name}`, name, disabled: saving,
    'aria-invalid': Boolean(fieldErrors[name]),
    'aria-describedby': fieldErrors[name] ? `member-profile-${name}-error` : undefined,
    onBlur: () => setFieldErrors(previous => ({ ...previous, [name]: validateProfile(formData)[name] })),
    onChange: event => changeProfileField(name, event.target.value),
  })
  const fieldError = name => fieldErrors[name] ? <p id={`member-profile-${name}-error`} className="member-profile-field-error" role="alert">{fieldErrors[name]}</p> : null

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (saveLock.current) return
    const validation = validateProfile(formData)
    setFieldErrors(validation)
    if (Object.keys(validation).length) { focusProfileError(validation); return }
    saveLock.current = true
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
      setPhoneConflict(null)
      setProfile(result)
      showNotice('Cập nhật hồ sơ cá nhân thành công!')
      await loadProfile()
    } catch (err) {
      const fields = profileFieldErrors(err)
      if (fields.phoneNumber && (Number(err.response?.status) === 409 || Number(err.response?.data?.statusCode) === 409)) {
        setPhoneConflict({ phoneNumber: formData.phoneNumber, message: fields.phoneNumber })
      }
      if (Object.keys(fields).length) { setFieldErrors(fields); focusProfileError(fields) }
      else setError(getProfileErrorMessage(err, 'Không thể lưu hồ sơ.'))
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  const passwordInputProps = name => ({
    id: `member-password-${name}`, name, disabled: passwordSaving,
    'aria-invalid': Boolean(passwordFieldErrors[name]),
    'aria-describedby': passwordFieldErrors[name] ? `member-password-${name}-error` : undefined,
    onBlur: () => setPasswordFieldErrors(previous => ({ ...previous, [name]: passwordChangeErrors(passwordData)[name] })),
    onChange: event => {
      const next = { ...passwordData, [name]: event.target.value }
      setPasswordData(next)
      setPasswordMsg({ type: '', text: '' })
      const errors = passwordChangeErrors(next)
      setPasswordFieldErrors(previous => Object.fromEntries(Object.entries(errors).filter(([field]) => next[field] || previous[field])))
    },
  })
  const passwordFieldError = name => passwordFieldErrors[name] ? <p id={`member-password-${name}-error`} className="member-profile-field-error" role="alert">{passwordFieldErrors[name]}</p> : null

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (passwordLock.current) return
    const errors = passwordChangeErrors(passwordData)
    setPasswordFieldErrors(errors)
    if (Object.keys(errors).length) {
      passwordForm.current?.elements.namedItem(Object.keys(errors)[0])?.focus()
      return
    }
    passwordLock.current = true
    setPasswordSaving(true)
    setPasswordMsg({ type: '', text: '' })
    try {
      await updateProfile({
        currentPassword: passwordData.currentPassword,
        password: passwordData.newPassword,
      })
      setPasswordMsg({ type: 'success', text: 'Đổi mật khẩu thành công!' })
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordFieldErrors({})
      showNotice('Đổi mật khẩu thành công!')
    } catch (err) {
      setPasswordMsg({ type: 'error', text: getProfileErrorMessage(err, 'Không thể đổi mật khẩu.') })
    } finally {
      passwordLock.current = false
      setPasswordSaving(false)
    }
  }

  if (loading) {
    return <div className="member-card member-api-state"><LoaderCircle className="member-spin" size={26} /><strong>Đang tải hồ sơ cá nhân...</strong></div>
  }

  const initials = (formData.fullName || user?.fullName || 'HV').split(/\s+/).slice(-2).map(p => p[0]).join('').toUpperCase()

  return (
    <div className="member-view-stack member-profile-view">
      <div className="member-section-heading member-profile-heading">
        <div>
          <p className="member-eyebrow"><ShieldCheck size={16} /> HỒ SƠ HỘI VIÊN</p>
          <h2>Tài khoản & Hồ sơ cá nhân</h2>
          <p className="member-muted">Quản lý hồ sơ định danh hội viên, thông tin liên lạc và bảo mật tài khoản.</p>
        </div>
      </div>

      {error && <div className="member-api-message member-api-message--error"><AlertCircle size={17} /><span>{error}</span></div>}

      <div className="member-profile-layout">
        {/* Thẻ định danh Hội viên */}
        <article className="member-id-card member-profile-identity-card" aria-label="Thẻ thông tin hội viên">
          <div className="member-row member-profile-id-meta">
            <span className="member-tag member-tag--gold">Thành viên Olympus</span>
            <Award size={25} />
          </div>
          <div className="member-identity">
            <span className="member-avatar member-avatar--large">{initials}</span>
            <div>
              <h1>{formData.fullName || user?.fullName}</h1>
              <p className="member-profile-id-code">#{memberInfo?.memberId ? `MEM-${memberInfo.memberId}` : `USR-${profile?.userId || user?.userId}`}</p>
              <p>{formData.email}</p>
              <div className="member-identity-status">
                <span className="member-status"><span />Đang hoạt động</span>
                <small>{profile?.roleName || 'Member'}</small>
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
        <div className="member-profile-content">
          <article className="member-card member-profile-personal" aria-labelledby="member-personal-title">
            <header className="member-profile-panel-header">
              <span className="member-profile-panel-icon"><User size={20} /></span>
              <div><h3 id="member-personal-title">Thông tin cá nhân</h3><p>Cập nhật thông tin liên lạc và mục tiêu tập luyện của bạn.</p></div>
            </header>
            <form ref={profileForm} className="member-profile-form" noValidate onSubmit={handleUpdateProfile} aria-busy={saving}>
              <div className="member-profile-fields">
                <div>
                  <label htmlFor="member-profile-fullName">Họ và tên</label>
                  <input
                    type="text"
                    required
                    maxLength={PROFILE_FULL_NAME_MAX_LENGTH}
                    autoComplete="name"
                    {...profileInputProps('fullName')}
                    value={formData.fullName}
                  />
                  {fieldError('fullName')}
                </div>
                <div>
                  <label htmlFor="member-profile-phoneNumber">Số điện thoại</label>
                  <input
                    type="tel"
                    maxLength={PROFILE_PHONE_LENGTH}
                    inputMode="numeric"
                    pattern="0[0-9]{9}"
                    title="Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0"
                    autoComplete="tel"
                    required={validationOptions.requirePhone}
                    {...profileInputProps('phoneNumber')}
                    value={formData.phoneNumber}
                    placeholder="0912345678"
                  />
                  <small className="member-profile-field-hint">Số điện thoại gồm đúng 10 chữ số và bắt đầu bằng 0.</small>
                  {fieldError('phoneNumber')}
                </div>
              </div>

              <div className="member-profile-fields">
                <div>
                  <label htmlFor="member-profile-email">Email tài khoản</label>
                  <input
                    type="email"
                    id="member-profile-email"
                    readOnly
                    value={formData.email}
                  />
                </div>
                <div>
                  <label htmlFor="member-profile-gender">Giới tính</label>
                  <select
                    {...profileInputProps('gender')}
                    value={formData.gender}
                  >
                    <option value="">Chưa cập nhật</option>
                    <option value="Male">Nam</option>
                    <option value="Female">Nữ</option>
                    <option value="Other">Khác</option>
                  </select>
                  {fieldError('gender')}
                </div>
              </div>

              <div className="member-profile-fields">
                <div>
                  <label htmlFor="member-profile-dateOfBirth">Ngày sinh</label>
                  <input
                    type="date"
                    max={profileDateLimit()}
                    required={Boolean(profile?.dateOfBirth)}
                    {...profileInputProps('dateOfBirth')}
                    value={formData.dateOfBirth}
                  />
                  {fieldError('dateOfBirth')}
                </div>
                <div>
                  <label htmlFor="member-profile-fitnessGoal">Mục tiêu tập luyện</label>
                  <input
                    type="text"
                    placeholder="Tăng cơ, giảm mỡ, rèn thể lực..."
                    maxLength={100}
                    {...profileInputProps('fitnessGoal')}
                    value={formData.fitnessGoal}
                  />
                  {fieldError('fitnessGoal')}
                </div>
              </div>

              <div className="member-profile-fields">
                <div>
                  <label htmlFor="member-profile-address">Địa chỉ thường trú</label>
                  <input
                    type="text"
                    placeholder="Số nhà, đường, quận/huyện..."
                    maxLength={500}
                    {...profileInputProps('address')}
                    value={formData.address}
                  />
                  {fieldError('address')}
                </div>

                <div>
                  <label htmlFor="member-profile-emergencyContact">Liên hệ khẩn cấp</label>
                  <input {...profileInputProps('emergencyContact')} type="text" maxLength={100} placeholder="Tên và số điện thoại người liên hệ" value={formData.emergencyContact} />
                  {fieldError('emergencyContact')}
                </div>
              </div>

              <div className="member-profile-form-footer">
                <button type="submit" disabled={saving || hasPhoneConflict} className="member-button member-button--primary">
                  {saving ? <><LoaderCircle className="member-spin" size={16} /> Đang lưu...</> : <><Save size={16} /> Lưu thay đổi hồ sơ</>}
                </button>
              </div>
            </form>
          </article>
          <section className="member-profile-security" aria-labelledby="member-security-title">
            <div className="member-profile-security-heading"><ShieldCheck size={18} /><div><h3 id="member-security-title">Bảo mật tài khoản</h3><p>Quản lý email đăng nhập và mật khẩu của bạn.</p></div></div>
            <div className="member-profile-security-grid">
              <ChangeEmailForm currentEmail={profile?.email || formData.email} disabled={saving || passwordSaving} />

              {/* Đổi mật khẩu tài khoản */}
              <article className="member-card member-profile-password" aria-labelledby="member-password-title">
                <header className="member-profile-panel-header">
                  <span className="member-profile-panel-icon"><Lock size={20} /></span>
                  <div><h3 id="member-password-title">Đổi mật khẩu</h3><p>Sử dụng mật khẩu mới từ 8 đến 72 ký tự.</p></div>
                </header>
                {passwordMsg.text && (
                  <div role={passwordMsg.type === 'error' ? 'alert' : 'status'} className={`member-api-message ${passwordMsg.type === 'error' ? 'member-api-message--error' : 'member-profile-message--success'}`}>
                    <Info size={16} /> <span>{passwordMsg.text}</span>
                  </div>
                )}
                <form ref={passwordForm} className="member-password-form" noValidate onSubmit={handleUpdatePassword} aria-busy={passwordSaving}>
                  <div>
                    <label htmlFor="member-password-currentPassword">Mật khẩu hiện tại</label>
                    <input
                      type="password"
                      required
                      {...passwordInputProps('currentPassword')}
                      autoComplete="current-password"
                      value={passwordData.currentPassword}
                    />
                    {passwordFieldError('currentPassword')}
                  </div>
                  <div>
                    <label htmlFor="member-password-newPassword">Mật khẩu mới (tối thiểu 8 ký tự)</label>
                    <input
                      type="password"
                      required
                      {...passwordInputProps('newPassword')}
                      autoComplete="new-password"
                      value={passwordData.newPassword}
                      minLength={8}
                      maxLength={72}
                    />
                    {passwordFieldError('newPassword')}
                  </div>
                  <div>
                    <label htmlFor="member-password-confirmPassword">Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      required
                      {...passwordInputProps('confirmPassword')}
                      autoComplete="new-password"
                      value={passwordData.confirmPassword}
                    />
                    {passwordFieldError('confirmPassword')}
                  </div>
                  <div className="member-profile-form-footer">
                    <button type="submit" disabled={passwordSaving || Object.keys(passwordChangeErrors(passwordData)).length > 0} className="member-button member-button--soft">
                      {passwordSaving ? <><LoaderCircle className="member-spin" size={16} /> Đang cập nhật...</> : <><Lock size={16} /> Cập nhật mật khẩu</>}
                    </button>
                  </div>
                </form>
              </article>
            </div>
          </section>
        </div>
      </div>
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
