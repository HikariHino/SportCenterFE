import { useEffect, useId, useRef, useState } from 'react'
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
import { getFullNameValidationError, getProfilePhoneValidationError, PROFILE_FULL_NAME_MAX_LENGTH, PROFILE_PHONE_MAX_LENGTH, PROFILE_PHONE_MESSAGE } from '../../utils/profileValidation'
import { getProfilePhoneConflict, passwordChangeErrors, profileBirthDateLimit, PROFILE_BIRTH_DATE_MIN, PROFILE_EMERGENCY_CONTACT_MAX_LENGTH, profileFieldErrors, profileValidationErrors } from '../../utils/profileValidation'
import '../../style/member/ProfileValidation.css'
import '../../style/member/MemberProfile.css'
import { FULL_NAME_PATTERN, FULL_NAME_MESSAGE } from '../../utils/fullNameValidation'
import { useMemberCache, useMemberResource, useMemberViewActive } from '../../contexts/MemberWorkspaceContext'
import useProfileMorph from '../../hooks/useProfileMorph'
import FontSizeControl from '../../components/FontSizeControl'

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
function memberProfileValues(profile, member, user) {
  return {
    fullName: profile?.fullName || member?.fullName || user?.fullName || '',
    email: profile?.email || member?.email || user?.email || '',
    phoneNumber: profile?.phoneNumber || member?.phone || '',
    gender: profile?.gender ?? '',
    dateOfBirth: profile?.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : '',
    address: profile?.address ?? '',
    fitnessGoal: profile?.fitnessGoal ?? '',
    emergencyContact: profile?.emergencyContact ?? '',
  }
}

export function ProfileView({ user, showNotice }) {
  const profileFormId = useId()
  const cache = useMemberCache()
  const profileForm = useRef(null)
  const saveLock = useRef(false)
  const passwordForm = useRef(null)
  const passwordLock = useRef(false)
  const [profile, setProfile] = useState(null)
  const [memberInfo, setMemberInfo] = useState(null)
  const [saving, setSaving] = useState(false)
  const [localError, setError] = useState('')
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
  const [editing, setEditing] = useState(false)
  const viewActive = useMemberViewActive()
  const morph = useProfileMorph(editing, viewActive)
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' })
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({})
  const profileDirty = useRef(false)
  const memberRead = useMemberResource('member-profile', getMyMemberProfile)
  const profileRead = useMemberResource('profile', async () => {
    const [profile, member] = await Promise.all([getProfile(), cache.load('member-profile', getMyMemberProfile).catch(() => null)])
    return { profile, member }
  }, { paused: saving || passwordSaving })
  const loading = profileRead.loading
  const error = localError || (profileRead.error ? getProfileErrorMessage(profileRead.error, 'Không thể tải thông tin cá nhân.') : '')

  const loadProfile = () => {
    setError('')
    return profileRead.reload()
  }
  useEffect(() => {
    if (profileRead.data) {
      const { profile: profData, member } = profileRead.data
      const memData = memberRead.hasData ? memberRead.data : member
      setProfile(profData)
      setMemberInfo(memData)
      if (profileDirty.current) return
      setFormData(memberProfileValues(profData, memData, user))
    }
  }, [profileRead.data, memberRead.data, user])

  const resetDrafts = () => {
    profileDirty.current = false
    setFormData(memberProfileValues(profile, memberInfo, user))
    setFieldErrors({})
    setPhoneConflict(null)
    setError('')
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPasswordFieldErrors({})
    setPasswordMsg({ type: '', text: '' })
  }
  const startEditing = () => { resetDrafts(); morph.transition(() => setEditing(true)) }
  const cancelEditing = () => { resetDrafts(); morph.transition(() => setEditing(false)) }

  const validationOptions = { requirePhone: Boolean(profile?.phoneNumber || memberInfo?.phone), requireDateOfBirth: Boolean(profile?.dateOfBirth), phoneConflict }
  const validateProfile = values => {
    const errors = profileValidationErrors(values, validationOptions)
    const nameError = getFullNameValidationError(values.fullName)
    const phoneError = getProfilePhoneValidationError(values.phoneNumber, { required: validationOptions.requirePhone })
    if (nameError) errors.fullName = nameError
    if (phoneError) errors.phoneNumber = phoneError
    return errors
  }
  const hasPhoneConflict = Boolean(getProfilePhoneConflict(formData.phoneNumber, phoneConflict))
  const focusProfileError = errors => window.requestAnimationFrame(() => profileForm.current?.elements.namedItem(Object.keys(errors)[0])?.focus())
  const changeProfileField = (name, value) => {
    profileDirty.current = true
    const next = { ...formData, [name]: value }
    setFormData(next)
    setError('')
    if (fieldErrors[name] || name === 'phoneNumber') setFieldErrors(previous => ({ ...previous, [name]: validateProfile(next)[name] }))
  }
  const profileInputProps = name => ({
    id: `member-profile-${name}`, name, disabled: saving || passwordSaving,
    'aria-invalid': Boolean(fieldErrors[name]),
    'aria-describedby': fieldErrors[name] ? `member-profile-${name}-error` : undefined,
    onBlur: () => setFieldErrors(previous => ({ ...previous, [name]: validateProfile(formData)[name] })),
    onChange: event => changeProfileField(name, event.target.value),
  })
  const fieldError = name => fieldErrors[name] ? <p id={`member-profile-${name}-error`} className="member-profile-field-error" role="alert">{fieldErrors[name]}</p> : null

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (!editing || saveLock.current || passwordLock.current) return
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
      profileDirty.current = false
      profileRead.setData(current => ({ ...current, profile: result }))
      morph.transition(() => setEditing(false))
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordFieldErrors({})
      setPasswordMsg({ type: '', text: '' })
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
    id: `member-password-${name}`, name, disabled: passwordSaving || saving,
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
    if (!editing || passwordLock.current || saveLock.current) return
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

  const initials = (profile?.fullName || memberInfo?.fullName || user?.fullName || 'HV').split(/\s+/).slice(-2).map(p => p[0]).join('').toUpperCase()

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
              <h1>{profile?.fullName || memberInfo?.fullName || user?.fullName}</h1>
              <p className="member-profile-id-code">#{memberInfo?.memberId ? `MEM-${memberInfo.memberId}` : `USR-${profile?.userId || user?.userId}`}</p>
              <p>{profile?.email || memberInfo?.email || user?.email}</p>
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

        <section ref={morph.panel} className="member-card member-profile-editor" data-editing={editing} aria-labelledby="member-personal-title">
          <header className="member-profile-panel-header member-profile-editor-heading">
            <span className="member-profile-panel-icon"><User size={20} /></span>
            <div><h3 id="member-personal-title">{editing ? 'Cập nhật thông tin' : 'Thông tin tài khoản'}</h3><p>Thông tin cá nhân và bảo mật tài khoản của bạn.</p></div>
            <button type="button" className="member-button" aria-expanded={editing} disabled={saving || passwordSaving} onClick={editing ? cancelEditing : startEditing}>{editing ? <><X size={16} /> Hủy</> : <><User size={16} /> Chỉnh sửa</>}</button>
          </header>
          {editing ? <>
            <div className="member-profile-edit-columns">
              <section className="member-profile-personal" aria-label="Chỉnh sửa thông tin cá nhân">
            <form id={profileFormId} ref={profileForm} className="member-profile-form" noValidate onSubmit={handleUpdateProfile} aria-busy={saving}>
              <div className="member-profile-fields">
                <div>
                  <label htmlFor="member-profile-fullName">Họ và tên</label>
                  <input
                    type="text"
                    required
                    pattern={FULL_NAME_PATTERN}
                    title={FULL_NAME_MESSAGE}
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
                    maxLength={PROFILE_PHONE_MAX_LENGTH}
                    inputMode="tel"
                    title={PROFILE_PHONE_MESSAGE}
                    autoComplete="tel"
                    required={validationOptions.requirePhone}
                    {...profileInputProps('phoneNumber')}
                    value={formData.phoneNumber}
                    placeholder="0912345678"
                  />
                  <small className="member-profile-field-hint">{PROFILE_PHONE_MESSAGE}</small>
                  {fieldError('phoneNumber')}
                </div>
              </div>

              <div className="member-profile-fields member-profile-fields--single">
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
                    min={PROFILE_BIRTH_DATE_MIN}
                    max={profileBirthDateLimit()}
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
                  <input {...profileInputProps('emergencyContact')} type="tel" inputMode="tel" minLength={8} maxLength={PROFILE_EMERGENCY_CONTACT_MAX_LENGTH} placeholder="Số điện thoại người liên hệ, VD: 0901234567" value={formData.emergencyContact} />
                  {fieldError('emergencyContact')}
                </div>
              </div>


            </form>
              </section>
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
                    <button type="submit" disabled={saving || passwordSaving || Object.keys(passwordChangeErrors(passwordData)).length > 0} className="member-button member-button--soft">
                      {passwordSaving ? <><LoaderCircle className="member-spin" size={16} /> Đang cập nhật...</> : <><Lock size={16} /> Cập nhật mật khẩu</>}
                    </button>
                  </div>
                </form>
              </article>
            </div>
            <ChangeEmailForm currentEmail={profile?.email || formData.email} disabled={saving || passwordSaving} allowAnyEmailDomain />
            <footer className="member-profile-editor-actions"><button type="button" className="member-button" disabled={saving || passwordSaving} onClick={cancelEditing}>Hủy thay đổi</button><button type="submit" form={profileFormId} disabled={saving || passwordSaving || hasPhoneConflict} className="member-button member-button--primary">{saving ? <><LoaderCircle className="member-spin" size={16} /> Đang lưu...</> : <><Save size={16} /> Lưu hồ sơ</>}</button></footer>
          </> : <dl className="member-profile-readonly-grid">
            {[
              ['Họ và tên', profile?.fullName || memberInfo?.fullName || user?.fullName],
              ['Email', profile?.email || memberInfo?.email || user?.email],
              ['Số điện thoại', profile?.phoneNumber || memberInfo?.phone],
              ['Giới tính', { Male: 'Nam', Female: 'Nữ', Other: 'Khác' }[profile?.gender] || profile?.gender],
              ['Ngày sinh', profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : ''],
              ['Mục tiêu tập luyện', profile?.fitnessGoal],
              ['Địa chỉ thường trú', profile?.address],
              ['Liên hệ khẩn cấp', profile?.emergencyContact],
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Chưa cập nhật'}</dd></div>)}
          </dl>}
        </section>
        <FontSizeControl />
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
