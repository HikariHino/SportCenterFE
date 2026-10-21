import { useEffect, useState } from 'react'
import { CheckCircle2, Edit3, IdCard, LoaderCircle, Mail, Phone, RefreshCw, Save, UserRound, X } from 'lucide-react'
import { getProfile, getProfileErrorMessage, updateProfile } from '../../services/profileService'
import { ViewLoader } from './ReceptionistViewShared'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const emptyForm = { fullName: '', email: '', phoneNumber: '', currentPassword: '', password: '' }

export function ReceptionistProfileView({ showNotice }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    let active = true
    const loadProfile = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getProfile()
        if (active) setProfile(result)
      } catch (requestError) {
        if (active) setError(getProfileErrorMessage(requestError, 'Không thể tải hồ sơ Receptionist.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    loadProfile()
    return () => { active = false }
  }, [requestKey])

  const startEditing = () => {
    setForm({ fullName: profile.fullName || '', email: profile.email || '', phoneNumber: profile.phoneNumber || '', currentPassword: '', password: '' })
    setActionError('')
    setEditing(true)
  }

  const stopEditing = () => {
    setEditing(false)
    setActionError('')
  }

  const handleSubmit = async event => {
    event.preventDefault()
    if (!form.fullName.trim() || !form.email.trim()) {
      setActionError('Họ tên và email không được để trống.')
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

    setSaving(true)
    setActionError('')
    try {
      const payload = { fullName: form.fullName.trim(), email: form.email.trim(), phoneNumber: form.phoneNumber.trim() || null }
      if (form.password) {
        payload.password = form.password
        payload.currentPassword = form.currentPassword
      }
      const updatedProfile = await updateProfile(payload)
      setProfile(updatedProfile)
      setEditing(false)
      showNotice?.('Đã cập nhật hồ sơ Receptionist.')
    } catch (requestError) {
      setActionError(getProfileErrorMessage(requestError, 'Không thể cập nhật hồ sơ.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <ViewLoader />
  if (error) return <section className="reception-card reception-profile-state error"><UserRound size={28} /><strong>Không thể tải hồ sơ</strong><p>{error}</p><button type="button" onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={14} />Thử lại</button></section>

  const initials = profile?.fullName?.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toLocaleUpperCase('vi-VN') || 'LT'

  return <div className="reception-profile-layout">
    <section className="reception-card reception-profile-summary">
      <div className="reception-profile-cover"><span>{initials}</span></div>
      <div><h2>{profile.fullName}</h2><p>{profile.email}</p><b className={String(profile.status || '').toLowerCase()}>{profile.status || 'Chưa xác định'}</b><dl><div><dt>Mã tài khoản</dt><dd>#{profile.userId}</dd></div><div><dt>Vai trò</dt><dd>{profile.roleName || 'Receptionist'}</dd></div></dl></div>
    </section>
    <section className="reception-card reception-profile-details">
      <div className="reception-card-head">
        <div><span>THÔNG TIN TÀI KHOẢN</span><h2>{editing ? 'Cập nhật thông tin' : 'Thông tin tài khoản'}</h2></div>
        {editing ? <button type="button" onClick={stopEditing} disabled={saving}><X size={16} />Hủy</button> : <button type="button" onClick={startEditing}><Edit3 size={15} />Chỉnh sửa</button>}
      </div>
      {editing ? <form className="reception-profile-form" onSubmit={handleSubmit}>
        <label>Họ và tên<input value={form.fullName} onChange={event => setForm(current => ({ ...current, fullName: event.target.value }))} maxLength={200} required /></label>
        <label>Email<input type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} maxLength={254} required /></label>
        <label>Số điện thoại<input value={form.phoneNumber} onChange={event => setForm(current => ({ ...current, phoneNumber: event.target.value }))} maxLength={30} placeholder="Chưa cập nhật" /></label>
        <label>Mật khẩu hiện tại<input type="password" value={form.currentPassword} onChange={event => setForm(current => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" placeholder="Chỉ nhập khi đổi mật khẩu" /></label>
        <label className="wide">Mật khẩu mới<input type="password" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} minLength={8} maxLength={72} autoComplete="new-password" placeholder="Để trống nếu không đổi mật khẩu" /></label>
        {actionError && <p>{actionError}</p>}
        <button type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
      </form> : <div className="reception-profile-grid">
        <article><span><Mail size={18} /></span><div><small>Email</small><strong>{profile.email}</strong></div></article>
        <article><span><Phone size={18} /></span><div><small>Số điện thoại</small><strong>{profile.phoneNumber || 'Chưa cập nhật'}</strong></div></article>
        <article><span><IdCard size={18} /></span><div><small>Ngày tạo</small><strong>{profile.createdAt ? dateFormatter.format(new Date(profile.createdAt)) : 'Chưa xác định'}</strong></div></article>
        <article><span><CheckCircle2 size={18} /></span><div><small>Cập nhật gần nhất</small><strong>{profile.updatedAt ? dateFormatter.format(new Date(profile.updatedAt)) : 'Chưa cập nhật'}</strong></div></article>
      </div>}
    </section>
  </div>
}
