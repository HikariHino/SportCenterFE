import { useReceptionistResource, useReceptionistViewActive } from '../../contexts/ReceptionistWorkspaceContext'
import RefreshStatus from './RefreshStatus'
import { useId, useRef, useState } from 'react'
import { CheckCircle2, Edit3, IdCard, LoaderCircle, Mail, Phone, RefreshCw, Save, UserRound, X } from 'lucide-react'
import { getProfile, getProfileErrorMessage } from '../../services/profileService'
import { updateStaffProfile } from '../../services/staffProfileService'
import { profileValidationErrors, PROFILE_FULL_NAME_MAX_LENGTH, PROFILE_PHONE_MAX_LENGTH, PROFILE_PHONE_MESSAGE } from '../../utils/profileValidation'
import { ViewLoader } from './ReceptionistViewShared'
import ChangeEmailForm from '../../components/ChangeEmailForm'
import { FULL_NAME_PATTERN, FULL_NAME_MESSAGE } from '../../utils/fullNameValidation'
import useProfileMorph from '../../hooks/useProfileMorph'
import StaffProfileCard from '../../components/StaffProfileCard'
import FontSizeControl from '../../components/FontSizeControl'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const emptyForm = { fullName: '', email: '', phoneNumber: '', currentPassword: '', password: '' }

export function ReceptionistProfileView({ showNotice }) {
  const profileFormId = useId()
  const saveLock = useRef(false)
  const [requestKey, setRequestKey] = useState(0)
  const [editing, setEditing] = useState(false)
  const viewActive = useReceptionistViewActive()
  const morph = useProfileMorph(editing, viewActive)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [form, setForm] = useState(emptyForm)

  const profileQuery = useReceptionistResource('profile', getProfile, { initialData: null, enabled: !editing && !saving, refreshKey: requestKey })
  const { data: profile, loading, refreshing, setData: setProfile } = profileQuery
  const error = profileQuery.error ? getProfileErrorMessage(profileQuery.error, 'Không thể tải hồ sơ Receptionist.') : ''

  const startEditing = () => {
    setForm({ fullName: profile.fullName || '', email: profile.email || '', phoneNumber: profile.phoneNumber || '', currentPassword: '', password: '' })
    setActionError('')
    morph.transition(() => setEditing(true))
  }

  const stopEditing = () => {
    morph.transition(() => setEditing(false))
    setActionError('')
  }

  const handleSubmit = async event => {
    event.preventDefault()
    if (saveLock.current) return
    const errors = profileValidationErrors({ fullName: form.fullName, phoneNumber: form.phoneNumber }, { partial: true })
    const validationError = Object.values(errors)[0]
    if (validationError) {
      setActionError(validationError)
      return
    }
    if (form.password && form.password.length < 8) {
      setActionError('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }
    if (form.password && !form.currentPassword) {
      setActionError('Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu.')
      return
    }

    saveLock.current = true
    setSaving(true)
    setActionError('')
    try {
      const payload = { fullName: form.fullName.trim(), phoneNumber: form.phoneNumber.trim() || null }
      if (form.password) {
        payload.password = form.password
        payload.currentPassword = form.currentPassword
      }
      const updatedProfile = await updateStaffProfile(payload, profile)
      setProfile(updatedProfile)
      morph.transition(() => setEditing(false))
      showNotice?.('Đã cập nhật hồ sơ Receptionist.')
    } catch (requestError) {
      setActionError(getProfileErrorMessage(requestError, 'Không thể cập nhật hồ sơ.'))
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  if (loading) return <ViewLoader />
  if (error && !profile) return <section className="reception-card reception-profile-state error"><UserRound size={28} /><strong>Không thể tải hồ sơ</strong><p>{error}</p><button type="button" onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={14} />Thử lại</button></section>

  return <div className="reception-profile-layout">
    <RefreshStatus refreshing={refreshing} error={error} onRetry={() => setRequestKey(key => key + 1)} />
    <StaffProfileCard profile={profile} role="Receptionist" className="reception-card reception-profile-summary" />
    <section ref={morph.panel} className="reception-card reception-profile-details">
      <div className="reception-card-head">
        <div><span>THÔNG TIN TÀI KHOẢN</span><h2>{editing ? 'Cập nhật thông tin' : 'Thông tin tài khoản'}</h2></div>
        {editing ? <button type="button" onClick={stopEditing} disabled={saving}><X size={16} />Hủy</button> : <button type="button" onClick={startEditing}><Edit3 size={15} />Chỉnh sửa</button>}
      </div>
      {editing ? <form id={profileFormId} className="reception-profile-form" onSubmit={handleSubmit}>
        <label className="reception-profile-name-field">Họ và tên<input name="fullName" disabled={saving} pattern={FULL_NAME_PATTERN} title={FULL_NAME_MESSAGE} value={form.fullName} onChange={event => setForm(current => ({ ...current, fullName: event.target.value }))} maxLength={PROFILE_FULL_NAME_MAX_LENGTH} required /></label>
        <label className="reception-profile-phone-field">Số điện thoại<input name="phoneNumber" disabled={saving} type="tel" inputMode="tel" title={PROFILE_PHONE_MESSAGE} value={form.phoneNumber} onChange={event => setForm(current => ({ ...current, phoneNumber: event.target.value }))} maxLength={PROFILE_PHONE_MAX_LENGTH} placeholder="0912345678" /></label>
        <label className="reception-profile-current-password-field">Mật khẩu hiện tại<input name="currentPassword" disabled={saving} type="password" value={form.currentPassword} onChange={event => setForm(current => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" placeholder="Chỉ nhập khi đổi mật khẩu" /></label>
        <label className="reception-profile-new-password-field">Mật khẩu mới (không bắt buộc)<input name="password" disabled={saving} type="password" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} minLength={8} maxLength={72} autoComplete="new-password" placeholder="Để trống nếu không đổi mật khẩu" /></label>
        {actionError && <p role="alert">{actionError}</p>}
      </form> : <div className="reception-profile-grid">
        <article><span><Mail size={18} /></span><div><small>Email</small><strong>{profile.email}</strong></div></article>
        <article><span><Phone size={18} /></span><div><small>Số điện thoại</small><strong>{profile.phoneNumber || 'Chưa cập nhật'}</strong></div></article>
        <article><span><IdCard size={18} /></span><div><small>Ngày tạo</small><strong>{profile.createdAt ? dateFormatter.format(new Date(profile.createdAt)) : 'Chưa xác định'}</strong></div></article>
        <article><span><CheckCircle2 size={18} /></span><div><small>Cập nhật gần nhất</small><strong>{profile.updatedAt ? dateFormatter.format(new Date(profile.updatedAt)) : 'Chưa cập nhật'}</strong></div></article>
      </div>}
      {editing && <>
        <ChangeEmailForm currentEmail={profile.email} disabled={saving} allowAnyEmailDomain />
        <footer className="reception-profile-actions"><button type="button" onClick={stopEditing} disabled={saving}>Hủy thay đổi</button><button type="submit" form={profileFormId} disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}{saving ? 'Đang lưu...' : 'Lưu hồ sơ'}</button></footer>
      </>}
    </section>
    <FontSizeControl />
  </div>
}
