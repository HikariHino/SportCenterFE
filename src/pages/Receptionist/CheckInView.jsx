import { useState } from 'react'
import { CalendarDays, CheckCircle2, QrCode, ScanLine, Search, ShieldCheck, UserCheck } from 'lucide-react'
import { getReceptionistSessionAttendances, markReceptionistAttendance } from '../../services/receptionistAttendanceService'
import { attendanceStatusLabel, EmptyState, requestErrorMessage } from './ReceptionistViewShared'

export function CheckInView({ showNotice }) {
  const [form, setForm] = useState({ sessionId: '', memberId: '', status: 'Present' })
  const [attendance, setAttendance] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [listSessionId, setListSessionId] = useState('')
  const [attendances, setAttendances] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [listLoaded, setListLoaded] = useState(false)

  const updateField = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }))

  const submitAttendance = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await markReceptionistAttendance({
        sessionId: Number(form.sessionId),
        memberId: Number(form.memberId),
        status: form.status,
      })
      setAttendance(result)
      setListSessionId(String(result.sessionId))
      showNotice(`Đã cập nhật điểm danh cho hội viên #${result.memberId}.`)
    } catch (requestError) {
      setAttendance(null)
      setError(requestErrorMessage(requestError, 'Không thể điểm danh hội viên.'))
    } finally {
      setSaving(false)
    }
  }

  const loadAttendances = async event => {
    event?.preventDefault()
    setListLoading(true)
    setListError('')
    setListLoaded(true)
    try {
      const result = await getReceptionistSessionAttendances(Number(listSessionId))
      setAttendances(result)
    } catch (requestError) {
      setAttendances([])
      setListError(requestErrorMessage(requestError, 'Không thể tải danh sách điểm danh.'))
    } finally {
      setListLoading(false)
    }
  }

  return <div className="reception-attendance-page"><div className="reception-checkin-layout">
    <section className="reception-card reception-checkin-search">
      <div className="reception-scan-visual"><span><ScanLine size={42} /></span><i /><strong>Điểm danh tại quầy</strong><p>Nhập đúng mã buổi học và hội viên để ghi nhận trạng thái tham gia.</p></div>
      <form className="reception-attendance-form" onSubmit={submitAttendance}><div><label>Mã buổi học<input name="sessionId" type="number" min="1" value={form.sessionId} onChange={updateField} required /></label><label>Mã hội viên<input name="memberId" type="number" min="1" value={form.memberId} onChange={updateField} required /></label><label>Trạng thái<select name="status" value={form.status} onChange={updateField}><option value="Present">Có mặt</option><option value="Absent">Vắng mặt</option><option value="Excused">Có phép</option></select></label></div>{error && <p role="alert">{error}</p>}<button type="submit" disabled={saving}>{saving ? 'Đang cập nhật...' : 'Cập nhật điểm danh'}</button></form>
    </section>
    <section className="reception-card reception-checkin-result"><div className="reception-card-head"><div><span>KẾT QUẢ ĐIỂM DANH</span><h2>Thông tin hội viên</h2></div><ShieldCheck size={20} /></div>{attendance ? <div className="reception-attendance-result"><span><CheckCircle2 size={26} /></span><h3>{attendance.memberName || `Hội viên #${attendance.memberId}`}</h3><p>Điểm danh đã được ghi nhận trên hệ thống.</p><div><small>Mã điểm danh<strong>#{attendance.id}</strong></small><small>Mã buổi học<strong>#{attendance.sessionId}</strong></small><small>Trạng thái<strong>{attendanceStatusLabel(attendance.status)}</strong></small><small>Thời gian<strong>{sessionDateTimeFormatter.format(new Date(attendance.checkInTime))}</strong></small></div></div> : <EmptyState icon={QrCode} title="Chưa có kết quả điểm danh" text="Kết quả sẽ hiển thị sau khi cập nhật trạng thái hội viên." />}</section>
  </div><section className="reception-card reception-attendance-list-card"><div className="reception-card-head"><div><span>ĐIỂM DANH THEO BUỔI</span><h2>Danh sách đã ghi nhận</h2></div><strong>{listLoaded && !listLoading ? `${attendances.length} hội viên` : 'Attendance API'}</strong></div><form className="reception-attendance-lookup" onSubmit={loadAttendances}><label htmlFor="reception-attendance-session">Mã buổi học</label><div><CalendarDays size={16} /><input id="reception-attendance-session" type="number" min="1" value={listSessionId} onChange={event => setListSessionId(event.target.value)} placeholder="Nhập mã buổi học" required /><button type="submit" disabled={listLoading}>{listLoading ? 'Đang tải...' : 'Xem điểm danh'}</button></div></form>{listLoading ? <EmptyState icon={UserCheck} title="Đang tải điểm danh" text="Dữ liệu đang được đồng bộ từ Attendance API." /> : listError ? <div className="reception-inline-error"><EmptyState icon={UserCheck} title="Không thể tải điểm danh" text={listError} /><button type="button" onClick={loadAttendances}>Thử lại</button></div> : listLoaded ? attendances.length ? <div className="reception-attendance-table"><div className="reception-attendance-heading"><span>Mã</span><span>Hội viên</span><span>Mã hội viên</span><span>Trạng thái</span><span>Thời gian</span></div>{attendances.map(item => <div className="reception-attendance-row" key={item.id}><span>#{item.id}</span><strong>{item.memberName || 'Chưa xác định'}</strong><span>#{item.memberId}</span><b className={String(item.status || '').toLowerCase()}>{attendanceStatusLabel(item.status)}</b><span>{sessionDateTimeFormatter.format(new Date(item.checkInTime))}</span></div>)}</div> : <EmptyState icon={UserCheck} title="Chưa có điểm danh" text="Buổi học này chưa ghi nhận trạng thái hội viên." /> : <EmptyState icon={UserCheck} title="Chọn một buổi học" text="Nhập mã buổi học để xem danh sách điểm danh." />}</section></div>
}

