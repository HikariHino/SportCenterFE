import { useEffect, useState } from 'react'
import { CheckCircle2, QrCode, ScanLine, ShieldCheck, UserCheck } from 'lucide-react'
import { checkOutGymMember, getCheckInErrorMessage, getTodayCheckIns, manualCheckIn, scanQrCheckIn } from '../../services/gymCheckInService'
import { EmptyState, formatDateTime, ViewLoader } from './ReceptionistViewShared'

export function CheckInView({ showNotice }) {
  const [qrForm, setQrForm] = useState({ qrCode: '', notes: '' })
  const [qrResult, setQrResult] = useState(null)
  const [qrSaving, setQrSaving] = useState(false)
  const [qrError, setQrError] = useState('')
  const [manualForm, setManualForm] = useState({ memberId: '', phoneNumber: '', notes: '' })
  const [manualSaving, setManualSaving] = useState(false)
  const [manualError, setManualError] = useState('')
  const [checkOutSavingId, setCheckOutSavingId] = useState(null)
  const [checkOutError, setCheckOutError] = useState('')
  const [todayCheckIns, setTodayCheckIns] = useState([])
  const [todayLoading, setTodayLoading] = useState(true)
  const [todayError, setTodayError] = useState('')
  const [todayRequestKey, setTodayRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const loadTodayCheckIns = async () => {
      setTodayLoading(true)
      setTodayError('')
      try {
        const result = await getTodayCheckIns()
        if (active) setTodayCheckIns(result)
      } catch (requestError) {
        if (active) {
          setTodayCheckIns([])
          setTodayError(getCheckInErrorMessage(requestError, 'Không thể tải danh sách check-in hôm nay.'))
        }
      } finally {
        if (active) setTodayLoading(false)
      }
    }
    loadTodayCheckIns()
    return () => { active = false }
  }, [todayRequestKey])

  const submitQrCheckIn = async event => {
    event.preventDefault()
    setQrSaving(true)
    setQrError('')
    try {
      const result = await scanQrCheckIn(qrForm)
      setQrResult(result)
      setTodayCheckIns(current => [result, ...current.filter(item => item.id !== result.id)])
      setQrForm(current => ({ ...current, qrCode: '' }))
      showNotice?.(`Đã check-in ${result.memberName || `hội viên #${result.memberId}`} bằng QR.`)
    } catch (requestError) {
      setQrResult(null)
      setQrError(getCheckInErrorMessage(requestError, 'Không thể check-in bằng mã QR.'))
    } finally {
      setQrSaving(false)
    }
  }

  const submitManualCheckIn = async event => {
    event.preventDefault()
    setManualError('')
    if (!manualForm.memberId && !manualForm.phoneNumber.trim()) {
      setManualError('Vui lòng nhập mã hội viên hoặc số điện thoại.')
      return
    }
    setManualSaving(true)
    try {
      const result = await manualCheckIn(manualForm)
      setQrResult(result)
      setTodayCheckIns(current => [result, ...current.filter(item => item.id !== result.id)])
      setManualForm({ memberId: '', phoneNumber: '', notes: '' })
      showNotice?.(`Đã check-in ${result.memberName || `hội viên #${result.memberId}`} tại quầy.`)
    } catch (requestError) {
      setManualError(getCheckInErrorMessage(requestError, 'Không thể check-in thủ công.'))
    } finally {
      setManualSaving(false)
    }
  }

  const handleCheckOut = async (checkIn = qrResult) => {
    if (!checkIn?.id || checkIn.checkOutTime || checkOutSavingId !== null) return
    setCheckOutSavingId(checkIn.id)
    setCheckOutError('')
    try {
      const result = await checkOutGymMember(checkIn.id)
      setQrResult(current => current?.id === result.id ? result : current)
      setTodayCheckIns(current => current.map(item => item.id === result.id ? result : item))
      showNotice?.(`Đã check-out ${result.memberName || `hội viên #${result.memberId}`}.`)
    } catch (requestError) {
      setCheckOutError(getCheckInErrorMessage(requestError, 'Không thể check-out hội viên.'))
    } finally {
      setCheckOutSavingId(null)
    }
  }

  if (todayLoading) return <ViewLoader />

  return <div className="reception-attendance-page">
    <div className="reception-gym-checkin-layout">
      <section className="reception-card reception-gym-checkin-card">
        <div className="reception-card-head"><div><span>GYM CHECK-IN API</span><h2>Quét mã QR hội viên</h2></div><QrCode size={20} /></div>
        <form onSubmit={submitQrCheckIn}><label>Mã QR<input value={qrForm.qrCode} onChange={event => setQrForm(current => ({ ...current, qrCode: event.target.value }))} placeholder="Dán hoặc quét nội dung QR" required /></label><label>Ghi chú<input value={qrForm.notes} onChange={event => setQrForm(current => ({ ...current, notes: event.target.value }))} placeholder="Không bắt buộc" /></label>{qrError && <p role="alert">{qrError}</p>}<button type="submit" disabled={qrSaving}><ScanLine size={16} />{qrSaving ? 'Đang xác minh...' : 'Check-in bằng QR'}</button></form>
      </section>
      <section className="reception-card reception-gym-result">
        <div className="reception-card-head"><div><span>KẾT QUẢ CHECK-IN</span><h2>Thông tin lượt vào phòng gym</h2></div><ShieldCheck size={20} /></div>
        {qrResult ? <div className="reception-gym-result-body"><span><CheckCircle2 size={24} /></span><div><h3>{qrResult.memberName}</h3><p>{qrResult.memberCode} · {qrResult.packageName || 'Chưa có gói'}</p></div><dl><div><dt>Mã lượt</dt><dd>#{qrResult.id}</dd></div><div><dt>Thời gian vào</dt><dd>{formatDateTime(qrResult.checkInTime)}</dd></div><div><dt>Thời gian ra</dt><dd>{qrResult.checkOutTime ? formatDateTime(qrResult.checkOutTime) : 'Chưa check-out'}</dd></div><div><dt>Nhân viên</dt><dd>{qrResult.checkedByStaffName || 'Receptionist'}</dd></div></dl>{checkOutError && <p className="reception-gym-checkout-error" role="alert">{checkOutError}</p>}<button className="reception-gym-checkout-button" type="button" disabled={Boolean(qrResult.checkOutTime) || checkOutSavingId !== null} onClick={() => handleCheckOut(qrResult)}>{checkOutSavingId === qrResult.id ? 'Đang check-out...' : qrResult.checkOutTime ? 'Đã check-out' : 'Check-out hội viên'}</button></div> : <EmptyState icon={QrCode} title="Chưa quét mã QR" text="Thông tin check-in phòng gym sẽ hiển thị tại đây." />}
      </section>
      <section className="reception-card reception-gym-manual-card">
        <div className="reception-card-head"><div><span>PHƯƠNG ÁN DỰ PHÒNG</span><h2>Check-in thủ công</h2></div><UserCheck size={20} /></div>
        <form onSubmit={submitManualCheckIn}><label>Mã hội viên<input type="number" min="1" value={manualForm.memberId} onChange={event => setManualForm(current => ({ ...current, memberId: event.target.value }))} placeholder="Ví dụ: 12" /></label><span>hoặc</span><label>Số điện thoại<input value={manualForm.phoneNumber} onChange={event => setManualForm(current => ({ ...current, phoneNumber: event.target.value }))} placeholder="0912 345 678" /></label><label>Ghi chú<input value={manualForm.notes} onChange={event => setManualForm(current => ({ ...current, notes: event.target.value }))} placeholder="Không bắt buộc" /></label>{manualError && <p role="alert">{manualError}</p>}<button type="submit" disabled={manualSaving}><UserCheck size={16} />{manualSaving ? 'Đang check-in...' : 'Xác nhận check-in'}</button></form>
      </section>
    </div>
    <section className="reception-card reception-gym-today-card">
      <div className="reception-card-head"><div><span>HOẠT ĐỘNG HÔM NAY</span><h2>Hội viên đang sử dụng phòng gym</h2></div><button type="button" onClick={() => setTodayRequestKey(key => key + 1)} disabled={todayLoading}>{todayLoading ? 'Đang tải...' : 'Làm mới'}</button></div>
      {todayLoading ? <EmptyState icon={UserCheck} title="Đang tải check-in hôm nay" text="Dữ liệu đang được đồng bộ từ GymCheckIns API." /> : todayError ? <div className="reception-inline-error"><EmptyState icon={UserCheck} title="Không thể tải check-in hôm nay" text={todayError} /><button type="button" onClick={() => setTodayRequestKey(key => key + 1)}>Thử lại</button></div> : todayCheckIns.length ? <div className="reception-gym-today-table"><div className="reception-gym-today-heading"><span>Hội viên</span><span>Gói tập</span><span>Giờ vào</span><span>Giờ ra</span><span>Thao tác</span></div>{todayCheckIns.map(item => <article key={item.id}><span><strong>{item.memberName}</strong><small>{item.memberCode} · {item.phoneNumber || 'Chưa có SĐT'}</small></span><span>{item.packageName || 'Chưa có gói'}</span><span>{formatDateTime(item.checkInTime)}</span><span>{item.checkOutTime ? formatDateTime(item.checkOutTime) : 'Đang ở phòng gym'}</span><button type="button" disabled={Boolean(item.checkOutTime) || checkOutSavingId !== null} onClick={() => handleCheckOut(item)}>{checkOutSavingId === item.id ? 'Đang xử lý...' : item.checkOutTime ? 'Đã ra về' : 'Check-out'}</button></article>)}</div> : <EmptyState icon={UserCheck} title="Chưa có lượt check-in" text="Hôm nay chưa có hội viên nào vào phòng gym." />}
    </section>
  </div>
}
