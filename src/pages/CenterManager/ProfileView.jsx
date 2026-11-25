import { useId, useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, LoaderCircle, Mail, PencilLine, Phone, RefreshCw, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useManagerResource, useManagerViewActive } from '../../contexts/ManagerWorkspaceContext'
import { getProfile, getProfileErrorMessage } from '../../services/profileService'
import { formatStaffBirthDate, staffBirthDateValue, updateStaffProfile } from '../../services/staffProfileService'
import { profileBirthDateLimit, profileFieldErrors, profileValidationErrors, PROFILE_BIRTH_DATE_MIN, PROFILE_FULL_NAME_MAX_LENGTH, PROFILE_PHONE_MAX_LENGTH } from '../../utils/profileValidation'
import useProfileMorph from '../../hooks/useProfileMorph'
import StaffProfileCard from '../../components/StaffProfileCard'
import FontSizeControl from '../../components/FontSizeControl'
import '../../style/CenterManager/ManagerProfile.css'

const profileFields = profile => ({ fullName: profile?.fullName || '', phoneNumber: profile?.phoneNumber || '',
  dateOfBirth: staffBirthDateValue(profile), currentPassword: '', password: '' })
const formatDate = value => Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa cập nhật'

export default function ManagerProfileView() {
  const id = useId(), lock = useRef(false)
  const auth = useAuth()
  const active = useManagerViewActive()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => profileFields(null))
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const morph = useProfileMorph(editing, active)
  const read = useManagerResource('profile', getProfile, { initialData: null, enabled: active, paused: editing || saving })
  const profile = read.data
  const startEditing = () => {
    setForm(profileFields(profile)); setFieldErrors({}); setError(''); setNotice('')
    morph.transition(() => setEditing(true))
  }
  const cancel = () => {
    if (lock.current) return
    setForm(profileFields(profile)); setFieldErrors({}); setError('')
    morph.transition(() => setEditing(false))
  }
  const change = event => {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
    setFieldErrors(current => ({ ...current, [name]: undefined }))
  }
  const submit = async event => {
    event.preventDefault()
    if (lock.current) return
    const payload = { fullName: form.fullName.trim(), phoneNumber: form.phoneNumber.trim() || null,
      ...(form.dateOfBirth && { dateOfBirth: `${form.dateOfBirth}T00:00:00.000Z` }),
      ...(form.password && { password: form.password, currentPassword: form.currentPassword }) }
    const errors = profileValidationErrors({ ...payload,
      ...(staffBirthDateValue(profile) && !form.dateOfBirth ? { dateOfBirth: '' } : {}) }, { partial: true })
    setFieldErrors(errors); setError(''); setNotice('')
    if (Object.keys(errors).length) return
    lock.current = true; setSaving(true)
    try {
      const updated = await updateStaffProfile(payload, profile)
      read.setData(updated)
      auth?.refreshUserProfile?.(updated)
      setForm(profileFields(updated))
      morph.transition(() => setEditing(false))
      setNotice('Đã cập nhật hồ sơ quản lý.')
    } catch (requestError) {
      setFieldErrors(profileFieldErrors(requestError))
      setError(getProfileErrorMessage(requestError, 'Không thể cập nhật hồ sơ quản lý.'))
    } finally { lock.current = false; setSaving(false) }
  }
  const inputProps = name => ({ name, value: form[name], disabled: saving, onChange: change,
    'aria-invalid': Boolean(fieldErrors[name]), 'aria-describedby': fieldErrors[name] ? `${id}-${name}-error` : undefined })
  const fieldError = name => fieldErrors[name] && <small id={`${id}-${name}-error`} className="manager-profile-field-error" role="alert">{fieldErrors[name]}</small>

  if (read.loading) return <div className="manager-profile-state" role="status"><LoaderCircle size={24} />Đang tải hồ sơ quản lý...</div>
  if (!profile) return <div className="manager-profile-state" role="alert"><p>{read.error ? getProfileErrorMessage(read.error) : 'Chưa có dữ liệu hồ sơ.'}</p><button type="button" onClick={read.reload}><RefreshCw size={16} />Thử lại</button></div>

  return <div className="manager-profile-layout">
    <StaffProfileCard profile={profile} role="Manager" className="manager-card manager-profile-summary" />
    <section ref={morph.panel} className="manager-card manager-personal-profile">
      <header><div><h1>{editing ? 'Cập nhật thông tin' : 'Thông tin tài khoản'}</h1><p>Thông tin cá nhân và bảo mật tài khoản quản lý.</p></div>
        <button type="button" disabled={saving} onClick={editing ? cancel : startEditing}>{editing ? <X size={16} /> : <PencilLine size={16} />}{editing ? 'Hủy' : 'Chỉnh sửa'}</button>
      </header>
      {notice && <p className="manager-profile-notice" role="status">{notice}</p>}
      {error && <p className="manager-profile-field-error" role="alert">{error}</p>}
      {read.error && profile && !editing && <p role="status">Chưa thể đồng bộ hồ sơ mới: {getProfileErrorMessage(read.error)}</p>}
      {editing ? <>
        <form id={`${id}-form`} className="manager-profile-form" onSubmit={submit}>
          <label>Họ và tên<input {...inputProps('fullName')} maxLength={PROFILE_FULL_NAME_MAX_LENGTH} required />{fieldError('fullName')}</label>
          <label>Số điện thoại<input {...inputProps('phoneNumber')} type="tel" inputMode="tel" maxLength={PROFILE_PHONE_MAX_LENGTH} />{fieldError('phoneNumber')}</label>
          <label>Ngày sinh<input {...inputProps('dateOfBirth')} type="date" min={PROFILE_BIRTH_DATE_MIN} max={profileBirthDateLimit()} /><small>Từ 01/01/1950, đủ 16 tuổi trở lên.</small>{fieldError('dateOfBirth')}</label>
          <label>Mật khẩu hiện tại<input {...inputProps('currentPassword')} type="password" autoComplete="current-password" placeholder="Bắt buộc khi đổi mật khẩu" />{fieldError('currentPassword')}</label>
          <label className="manager-profile-wide">Mật khẩu mới (không bắt buộc)<input {...inputProps('password')} type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="Để trống nếu không đổi mật khẩu" />{fieldError('password')}</label>
        </form>
        <footer className="manager-profile-actions"><button type="button" disabled={saving} onClick={cancel}>Hủy thay đổi</button><button type="submit" form={`${id}-form`} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu hồ sơ'}</button></footer>
      </> : <dl>
        <div><dt><Mail size={15} /> Email</dt><dd>{profile.email}</dd></div>
        <div><dt><Phone size={15} /> Số điện thoại</dt><dd>{profile.phoneNumber || 'Chưa cập nhật'}</dd></div>
        <div><dt><CalendarDays size={15} /> Ngày sinh</dt><dd>{formatStaffBirthDate(profile)}</dd></div>
        <div><dt>Vai trò</dt><dd>Quản lý trung tâm</dd></div>
        <div><dt>Ngày tạo tài khoản</dt><dd>{formatDate(profile.createdAt)}</dd></div>
        <div><dt><CheckCircle2 size={15} /> Cập nhật gần nhất</dt><dd>{formatDate(profile.updatedAt)}</dd></div>
      </dl>}
    </section>
    <FontSizeControl />
  </div>
}
