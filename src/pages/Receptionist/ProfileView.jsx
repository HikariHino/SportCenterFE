import { useEffect, useState } from 'react'
import { CheckCircle2, IdCard, Mail, Phone, RefreshCw, UserRound } from 'lucide-react'
import { getProfile, getProfileErrorMessage } from '../../services/profileService'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function ReceptionistProfileView() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)

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

  if (loading) return <section className="reception-card reception-profile-state"><UserRound size={28} /><strong>Đang tải hồ sơ</strong><p>Dữ liệu đang được đồng bộ từ Profile API.</p></section>
  if (error) return <section className="reception-card reception-profile-state error"><UserRound size={28} /><strong>Không thể tải hồ sơ</strong><p>{error}</p><button type="button" onClick={() => setRequestKey(key => key + 1)}><RefreshCw size={14} />Thử lại</button></section>

  const initials = profile?.fullName?.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toLocaleUpperCase('vi-VN') || 'LT'

  return <div className="reception-profile-layout">
    <section className="reception-card reception-profile-summary"><div className="reception-profile-cover"><span>{initials}</span></div><div><h2>{profile.fullName}</h2><p>{profile.email}</p><b className={String(profile.status || '').toLowerCase()}>{profile.status || 'Chưa xác định'}</b><dl><div><dt>Mã tài khoản</dt><dd>#{profile.userId}</dd></div><div><dt>Vai trò</dt><dd>{profile.roleName || 'Receptionist'}</dd></div></dl></div></section>
    <section className="reception-card reception-profile-details"><div className="reception-card-head"><div><span>PROFILE API</span><h2>Thông tin tài khoản</h2></div><CheckCircle2 size={20} /></div><div className="reception-profile-grid"><article><span><Mail size={18} /></span><div><small>Email</small><strong>{profile.email}</strong></div></article><article><span><Phone size={18} /></span><div><small>Số điện thoại</small><strong>{profile.phoneNumber || 'Chưa cập nhật'}</strong></div></article><article><span><IdCard size={18} /></span><div><small>Ngày tạo</small><strong>{profile.createdAt ? dateFormatter.format(new Date(profile.createdAt)) : 'Chưa xác định'}</strong></div></article><article><span><CheckCircle2 size={18} /></span><div><small>Cập nhật gần nhất</small><strong>{profile.updatedAt ? dateFormatter.format(new Date(profile.updatedAt)) : 'Chưa cập nhật'}</strong></div></article></div></section>
  </div>
}
