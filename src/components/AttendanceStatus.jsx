import { CheckCircle2, CircleHelp, Clock3, XCircle } from 'lucide-react'
import { registrationAttendance } from '../utils/memberClasses'
import '../style/member/AttendanceStatus.css'

export default function AttendanceStatus({ item }) {
  const attendance = registrationAttendance(item)
  if (!attendance) return null
  const Icon = attendance.tone === 'success' ? CheckCircle2 : attendance.tone === 'danger' ? XCircle : attendance.code === 'unknown' ? CircleHelp : Clock3
  return <span className="member-attendance-status" data-state={attendance.code} data-tone={attendance.tone} aria-label={`Điểm danh: ${attendance.label}`}>
    <Icon size={14} aria-hidden="true" />{attendance.label}
  </span>
}
