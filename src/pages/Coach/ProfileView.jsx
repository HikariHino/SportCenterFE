import { useCoachResource } from '../../contexts/CoachWorkspaceContext'
import RefreshStatus from './RefreshStatus'
import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, IdCard, Mail, PencilLine, Phone, UserRound, X } from 'lucide-react'
import { getProfile, getProfileErrorMessage } from '../../services/profileService'
import { formatStaffBirthDate, staffBirthDateValue, updateStaffProfile } from '../../services/staffProfileService'
import { profileBirthDateLimit, profileFieldErrors, profileValidationErrors, PROFILE_BIRTH_DATE_MIN, PROFILE_FULL_NAME_MAX_LENGTH, PROFILE_PHONE_MAX_LENGTH, PROFILE_PHONE_MESSAGE } from '../../utils/profileValidation'
import { ViewLoader } from './CoachViewShared'
import ChangeEmailForm from '../../components/ChangeEmailForm'
import { notifyCoachDataChanged } from '../../hooks/useCoachViewRefresh'
import { FULL_NAME_PATTERN, FULL_NAME_MESSAGE } from '../../utils/fullNameValidation'
import useProfileMorph from '../../hooks/useProfileMorph'
import StaffProfileCard from '../../components/StaffProfileCard'
import FontSizeControl from '../../components/FontSizeControl'

const profileDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function CoachProfileView({ active = true, showNotice }) {
  const profileFormId = useId()
  const saveLock = useRef(false)
  const [requestKey, setRequestKey] = useState(0)
  const [editing, setEditing] = useState(false)
  const morph = useProfileMorph(editing, active)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', dateOfBirth: '', currentPassword: '', password: '' })
  const [birthDateError, setBirthDateError] = useState('')
  const profileQuery = useCoachResource('profile', getProfile, { initialData: null, enabled: !editing && !saving, refreshKey: requestKey })
  const { data: profile, loading, refreshing, setData: setProfile } = profileQuery
  const error = profileQuery.error ? getProfileErrorMessage(profileQuery.error, 'Không thể tải hồ sơ Coach.') : ''
  useEffect(() => {
    if (profile && !editing && !saving) setForm({ fullName: profile.fullName || '', email: profile.email || '', phoneNumber: profile.phoneNumber || '', dateOfBirth: staffBirthDateValue(profile), currentPassword: '', password: '' })
  }, [profile, editing, saving])

  const updateField = event => {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
    if (name === 'dateOfBirth') setBirthDateError('')
  }

  const cancelEdit = () => {
    morph.transition(() => setEditing(false))
    setActionError('')
    setBirthDateError('')
    setForm({ fullName: profile.fullName || '', email: profile.email || '', phoneNumber: profile.phoneNumber || '', dateOfBirth: staffBirthDateValue(profile), currentPassword: '', password: '' })
  }

  const submitProfile = async event => {
    event.preventDefault()
    if (saveLock.current) return
    setActionError('')
    const birthDate = form.dateOfBirth || staffBirthDateValue(profile) ? { dateOfBirth: form.dateOfBirth } : {}
    const errors = profileValidationErrors({ fullName: form.fullName, phoneNumber: form.phoneNumber, ...birthDate }, { partial: true, requirePhone: true })
    setBirthDateError(errors.dateOfBirth || '')
    const validationError = Object.values(errors)[0]
    if (validationError) {
      setActionError(validationError)
      return
    }
    saveLock.current = true
    setSaving(true)
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        ...(form.dateOfBirth && { dateOfBirth: `${form.dateOfBirth}T00:00:00.000Z` }),
      }
      if (form.currentPassword) payload.currentPassword = form.currentPassword
      if (form.password) payload.password = form.password
      const result = await updateStaffProfile(payload, profile)
      setProfile(result)
      setForm({ fullName: result.fullName || '', email: result.email || '', phoneNumber: result.phoneNumber || '', dateOfBirth: staffBirthDateValue(result), currentPassword: '', password: '' })
      morph.transition(() => setEditing(false))
      notifyCoachDataChanged('profile')
      showNotice?.('Đã cập nhật hồ sơ Coach.')
    } catch (requestError) {
      setBirthDateError(profileFieldErrors(requestError).dateOfBirth || '')
      setActionError(getProfileErrorMessage(requestError, 'Không thể cập nhật hồ sơ Coach.'))
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  if (loading) return <ViewLoader />
  if (error && !profile) return <section className="coach-card coach-profile-api-state error"><UserRound size={28} /><strong>Không thể tải hồ sơ</strong><p>{error}</p><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></section>
  if (!profile) return <section className="coach-card coach-profile-api-state"><UserRound size={28} /><strong>Chưa có hồ sơ</strong><p>Chưa có dữ liệu tài khoản.</p></section>

  const createdAt = profile.createdAt ? profileDateFormatter.format(new Date(profile.createdAt)) : 'Chưa xác định'
  const updatedAt = profile.updatedAt ? profileDateFormatter.format(new Date(profile.updatedAt)) : 'Chưa cập nhật'

  return <div className="coach-account-profile-layout">
    <RefreshStatus refreshing={refreshing} error={error} onRetry={() => setRequestKey(key => key + 1)} />
    <StaffProfileCard profile={profile} role="Coach" className="coach-card coach-account-profile-summary" />
    <section ref={morph.panel} className="coach-card coach-account-profile-details">
      <div className="coach-card-head"><div><span>THÔNG TIN TÀI KHOẢN</span><h2>{editing ? 'Cập nhật thông tin' : 'Thông tin tài khoản'}</h2></div>{editing ? <button type="button" onClick={cancelEdit} disabled={saving}><X size={15} />Hủy</button> : <button type="button" onClick={() => morph.transition(() => setEditing(true))}><PencilLine size={15} />Chỉnh sửa</button>}</div>
      {editing ? <form id={profileFormId} className="coach-account-profile-form" onSubmit={submitProfile}>
        <div className="coach-account-profile-fields">
          <label className="coach-profile-name-field">Họ và tên<input pattern={FULL_NAME_PATTERN} title={FULL_NAME_MESSAGE} name="fullName" disabled={saving} value={form.fullName} onChange={updateField} minLength="1" maxLength={PROFILE_FULL_NAME_MAX_LENGTH} required /></label>
          <label className="coach-profile-phone-field">Số điện thoại<input name="phoneNumber" disabled={saving} type="tel" inputMode="tel" title={PROFILE_PHONE_MESSAGE} value={form.phoneNumber} onChange={updateField} maxLength={PROFILE_PHONE_MAX_LENGTH} required /></label>
          <label className="coach-profile-birthdate-field" htmlFor={`${profileFormId}-birthdate`}>Ngày sinh<input id={`${profileFormId}-birthdate`} name="dateOfBirth" type="date" min={PROFILE_BIRTH_DATE_MIN} max={profileBirthDateLimit()} value={form.dateOfBirth} onChange={updateField} disabled={saving} aria-invalid={Boolean(birthDateError)} aria-describedby={`${profileFormId}-birthdate-hint`} /><small id={`${profileFormId}-birthdate-hint`}>{birthDateError || 'Từ 01/01/1950, đủ 16 tuổi trở lên.'}</small></label>
          <label className="coach-profile-current-password-field">Mật khẩu hiện tại<input name="currentPassword" disabled={saving} type="password" value={form.currentPassword} onChange={updateField} autoComplete="current-password" placeholder="Bắt buộc khi đổi mật khẩu" /></label>
          <label className="coach-profile-new-password-field">Mật khẩu mới (không bắt buộc)<input name="password" disabled={saving} type="password" value={form.password} onChange={updateField} autoComplete="new-password" minLength={form.password ? 8 : undefined} maxLength="72" placeholder="Để trống nếu không đổi mật khẩu" /></label>
        </div>
        {actionError && <p role="alert">{actionError}</p>}
      </form> : <div className="coach-account-profile-grid"><article><span><Mail size={18} /></span><div><small>Email</small><strong>{profile.email}</strong></div></article><article><span><Phone size={18} /></span><div><small>Số điện thoại</small><strong>{profile.phoneNumber || 'Chưa cập nhật'}</strong></div></article><article><span><CalendarDays size={18} /></span><div><small>Ngày sinh</small><strong>{formatStaffBirthDate(profile)}</strong></div></article><article><span><IdCard size={18} /></span><div><small>Ngày tạo tài khoản</small><strong>{createdAt}</strong></div></article><article><span><CheckCircle2 size={18} /></span><div><small>Cập nhật gần nhất</small><strong>{updatedAt}</strong></div></article></div>}
      {editing && <>
        <ChangeEmailForm currentEmail={profile.email} disabled={saving} allowAnyEmailDomain />
        <footer className="coach-account-profile-actions"><button type="button" onClick={cancelEdit} disabled={saving}>Hủy thay đổi</button><button type="submit" form={profileFormId} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu hồ sơ'}</button></footer>
      </>}
    </section>
    <FontSizeControl />
  </div>
}
