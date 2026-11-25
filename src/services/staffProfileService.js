import { getProfile, updateProfile } from './profileService'

export const staffBirthDateValue = profile => typeof profile?.dateOfBirth === 'string' ? profile.dateOfBirth.slice(0, 10) : ''

export function formatStaffBirthDate(profile) {
  const value = staffBirthDateValue(profile)
  const stamp = Date.parse(`${value}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== value) return 'Chưa cập nhật'
  return value.split('-').reverse().join('/')
}

export async function updateStaffProfile(payload, currentProfile) {
  const validate = profile => {
    if (!profile || String(profile.userId) !== String(currentProfile.userId)) {
      throw new Error('Phản hồi không khớp tài khoản đang chỉnh sửa. Vui lòng tải lại hồ sơ.')
    }
    return profile
  }
  const updated = validate(await updateProfile(payload))
  if (payload.dateOfBirth === undefined) return updated
  // Older BE versions silently ignore staff birthdays. Never cache or report that as saved.
  const saved = validate(await getProfile())
  if (staffBirthDateValue(saved) !== payload.dateOfBirth.slice(0, 10)) {
    throw Object.assign(new Error('Máy chủ chưa lưu được ngày sinh nhân viên. Các thông tin khác có thể đã được cập nhật; vui lòng kiểm tra lại hồ sơ.'), {
      fieldErrors: { dateOfBirth: 'Ngày sinh chưa được lưu. Vui lòng liên hệ quản trị trung tâm để được hỗ trợ.' },
    })
  }
  return saved
}
