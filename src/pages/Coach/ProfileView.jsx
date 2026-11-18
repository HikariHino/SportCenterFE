import { useCoachResource } from '../../contexts/CoachWorkspaceContext'
import RefreshStatus from './RefreshStatus'
import { useEffect, useState } from 'react'
import { CheckCircle2, IdCard, Mail, PencilLine, Phone, UserRound, X } from 'lucide-react'
import { getProfile, getProfileErrorMessage, updateProfile } from '../../services/profileService'
import { getFullNameValidationError, getProfilePhoneValidationError, PROFILE_FULL_NAME_MAX_LENGTH, PROFILE_PHONE_MAX_LENGTH, PROFILE_PHONE_MESSAGE } from '../../utils/profileValidation'
import { ViewLoader } from './CoachViewShared'
import ChangeEmailForm from '../../components/ChangeEmailForm'
import { notifyCoachDataChanged } from '../../hooks/useCoachViewRefresh'
import { FULL_NAME_PATTERN, FULL_NAME_MESSAGE } from '../../utils/fullNameValidation'

const profileDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function CoachProfileView({ active = true, showNotice }) {
  const [requestKey, setRequestKey] = useState(0)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', currentPassword: '', password: '' })
  const profileQuery = useCoachResource('profile', getProfile, { initialData: null, enabled: !editing && !saving, refreshKey: requestKey })
  const { data: profile, loading, refreshing, setData: setProfile } = profileQuery
  const error = profileQuery.error ? getProfileErrorMessage(profileQuery.error, 'Không thể tải hồ sơ Coach.') : ''
  useEffect(() => {
    if (profile && !editing && !saving) setForm({ fullName: profile.fullName || '', email: profile.email || '', phoneNumber: profile.phoneNumber || '', currentPassword: '', password: '' })
  }, [profile, editing, saving])

  const updateField = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }))

  const cancelEdit = () => {
    setEditing(false)
    setActionError('')
    setForm({ fullName: profile.fullName || '', email: profile.email || '', phoneNumber: profile.phoneNumber || '', currentPassword: '', password: '' })
  }

  const submitProfile = async event => {
    event.preventDefault()
    setActionError('')
    const validationError = getFullNameValidationError(form.fullName) || getProfilePhoneValidationError(form.phoneNumber, { required: true })
    if (validationError) {
      setActionError(validationError)
      return
    }
    setSaving(true)
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
      }
      if (form.currentPassword) payload.currentPassword = form.currentPassword
      if (form.password) payload.password = form.password
      const result = await updateProfile(payload)
      setProfile(result)
      setForm({ fullName: result.fullName || '', email: result.email || '', phoneNumber: result.phoneNumber || '', currentPassword: '', password: '' })
      setEditing(false)
      notifyCoachDataChanged('profile')
      showNotice?.('Đã cập nhật hồ sơ Coach.')
    } catch (requestError) {
      setActionError(getProfileErrorMessage(requestError, 'Không thể cập nhật hồ sơ Coach.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <ViewLoader />
  if (error && !profile) return <section className="coach-card coach-profile-api-state error"><UserRound size={28} /><strong>Không thể tải hồ sơ</strong><p>{error}</p><button type="button" onClick={() => setRequestKey(key => key + 1)}>Thử lại</button></section>
  if (!profile) return <section className="coach-card coach-profile-api-state"><UserRound size={28} /><strong>Chưa có hồ sơ</strong><p>Chưa có dữ liệu tài khoản.</p></section>

  const initials = profile.fullName?.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'HLV'
  const createdAt = profile.createdAt ? profileDateFormatter.format(new Date(profile.createdAt)) : 'Chưa xác định'
  const updatedAt = profile.updatedAt ? profileDateFormatter.format(new Date(profile.updatedAt)) : 'Chưa cập nhật'

  return <div className="coach-account-profile-layout">
    <RefreshStatus refreshing={refreshing} error={error} onRetry={() => setRequestKey(key => key + 1)} />
    <section className="coach-card coach-account-profile-summary"><div className="coach-account-profile-cover"><span>{initials}</span></div><div className="coach-account-profile-main"><h2>{profile.fullName}</h2><p>{profile.email}</p><b className={String(profile.status || '').toLowerCase()}>{profile.status || 'Chưa xác định'}</b><div><span><strong>#{profile.userId}</strong><small>Mã tài khoản</small></span><span><strong>{profile.roleName}</strong><small>Vai trò</small></span></div></div></section>
    <section className="coach-card coach-account-profile-details"><div className="coach-card-head"><div><span>THÔNG TIN TÀI KHOẢN</span><h2>{editing ? 'Cập nhật thông tin' : 'Thông tin tài khoản'}</h2></div>{editing ? <button type="button" onClick={cancelEdit} disabled={saving}><X size={15} />Hủy</button> : <button type="button" onClick={() => setEditing(true)}><PencilLine size={15} />Chỉnh sửa</button>}</div>{editing ? <form className="coach-account-profile-form" onSubmit={submitProfile}><div><label>Họ và tên<input pattern={FULL_NAME_PATTERN} title={FULL_NAME_MESSAGE} name="fullName" value={form.fullName} onChange={updateField} minLength="1" maxLength={PROFILE_FULL_NAME_MAX_LENGTH} required /></label><label>Email<input name="email" type="email" value={profile.email} readOnly /></label><label>Số điện thoại<input name="phoneNumber" type="tel" inputMode="tel" title={PROFILE_PHONE_MESSAGE} value={form.phoneNumber} onChange={updateField} maxLength={PROFILE_PHONE_MAX_LENGTH} required /></label><label>Mật khẩu hiện tại<input name="currentPassword" type="password" value={form.currentPassword} onChange={updateField} placeholder="Bắt buộc khi đổi mật khẩu" /></label><label className="wide">Mật khẩu mới (không bắt buộc)<input name="password" type="password" value={form.password} onChange={updateField} minLength={form.password ? 8 : undefined} maxLength="72" placeholder="Để trống nếu không đổi mật khẩu" /></label></div>{actionError && <p role="alert">{actionError}</p>}<footer><button type="button" onClick={cancelEdit} disabled={saving}>Hủy thay đổi</button><button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu hồ sơ'}</button></footer></form> : <div className="coach-account-profile-grid"><article><span><Mail size={18} /></span><div><small>Email</small><strong>{profile.email}</strong></div></article><article><span><Phone size={18} /></span><div><small>Số điện thoại</small><strong>{profile.phoneNumber || 'Chưa cập nhật'}</strong></div></article><article><span><IdCard size={18} /></span><div><small>Ngày tạo tài khoản</small><strong>{createdAt}</strong></div></article><article><span><CheckCircle2 size={18} /></span><div><small>Cập nhật gần nhất</small><strong>{updatedAt}</strong></div></article></div>}{editing && <ChangeEmailForm currentEmail={profile.email} disabled={saving} allowAnyEmailDomain />}</section>
  </div>
}
