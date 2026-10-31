import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, QrCode, ScanLine, ShieldCheck, UserCheck } from 'lucide-react'
import { checkOutGymMember, getCheckInErrorMessage, getTodayCheckIns, manualCheckIn, scanQrCheckIn } from '../../services/gymCheckInService'
import { EmptyState, formatDateTime, ViewLoader } from './ReceptionistViewShared'

const QrCameraScanner = lazy(() => import('./QrCameraScanner'))

export function CheckInView({ showNotice }) {
  const [qrForm, setQrForm] = useState({ qrCode: '', notes: '' })
  const [qrResult, setQrResult] = useState(null)
  const [qrSaving, setQrSaving] = useState(false)
  const [qrError, setQrError] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [qrManualOpen, setQrManualOpen] = useState(false)
  const qrSubmitting = useRef(false)
  const qrInput = useRef(null)
  const cameraButton = useRef(null)

  useEffect(() => {
    if (qrManualOpen) qrInput.current?.focus()
  }, [qrManualOpen])
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

  const performQrCheckIn = async payload => {
    if (qrSubmitting.current) return
    if (!payload.qrCode.trim()) {
      setQrError('Vui lòng nhập hoặc quét mã QR hội viên.')
      return
    }
    qrSubmitting.current = true
    setQrSaving(true)
    setQrError('')
    try {
      const result = await scanQrCheckIn(payload)
      setQrResult(result)
      setTodayCheckIns(current => [result, ...current.filter(item => item.id !== result.id)])
      setQrForm(current => ({ ...current, qrCode: '' }))
      showNotice?.(`Đã check-in ${result.memberName || `hội viên #${result.memberId}`} bằng QR.`)
    } catch (requestError) {
      setQrResult(null)
      setQrError(getCheckInErrorMessage(requestError, 'Không thể check-in bằng mã QR.'))
    } finally {
      qrSubmitting.current = false
      setQrSaving(false)
    }
  }

  const submitQrCheckIn = event => {
    event.preventDefault()
    if (!cameraOpen) performQrCheckIn(qrForm)
  }

  const closeCamera = () => {
    setCameraOpen(false)
    cameraButton.current?.focus()
  }

  const openManualQr = () => {
    setCameraOpen(false)
    setQrManualOpen(true)
    qrInput.current?.focus()
  }

  const handleScannedQr = qrCode => {
    setQrForm(current => ({ ...current, qrCode }))
    setCameraOpen(false)
    performQrCheckIn({ qrCode, notes: qrForm.notes })
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
        <div className="reception-card-head"><div><span>XÁC THỰC HỘI VIÊN</span><h2>Quét mã QR hội viên</h2></div><QrCode size={20} /></div>
        <div className="reception-qr-checkin-actions"><button ref={cameraButton} type="button" className="reception-qr-camera-open" disabled={qrSaving || cameraOpen} onClick={() => { setQrError(''); setCameraOpen(true) }}><Camera size={17} />Quét QR bằng camera</button><p>Quét được mã QR sẽ tự động check-in cho hội viên.</p><button type="button" className="reception-qr-manual-toggle" aria-expanded={qrManualOpen} aria-controls="reception-qr-manual-form" disabled={qrSaving || cameraOpen} onClick={() => setQrManualOpen(value => !value)}>{qrManualOpen ? 'Ẩn xác nhận thủ công' : 'Xác nhận thủ công'}</button></div>
        {qrSaving && <p className="reception-qr-checkin-status" role="status" aria-live="polite">Đang xác minh mã QR và check-in...</p>}
        {qrError && <p className="reception-qr-checkin-error" role="alert">{qrError}</p>}
        {qrManualOpen && <form id="reception-qr-manual-form" onSubmit={submitQrCheckIn}><label>Mã QR<input ref={qrInput} value={qrForm.qrCode} disabled={qrSaving} onChange={event => setQrForm(current => ({ ...current, qrCode: event.target.value }))} placeholder="Dán hoặc quét nội dung QR" required /></label><label>Ghi chú<input value={qrForm.notes} disabled={qrSaving} onChange={event => setQrForm(current => ({ ...current, notes: event.target.value }))} placeholder="Không bắt buộc" /></label><button type="submit" disabled={qrSaving || cameraOpen || !qrForm.qrCode.trim()}><ScanLine size={16} />{qrSaving ? 'Đang xác minh...' : 'Xác nhận check-in bằng QR'}</button></form>}
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
      {todayLoading ? <EmptyState icon={UserCheck} title="Đang tải check-in hôm nay" text="Dữ liệu check-in đang được đồng bộ từ hệ thống." /> : todayError ? <div className="reception-inline-error"><EmptyState icon={UserCheck} title="Không thể tải check-in hôm nay" text={todayError} /><button type="button" onClick={() => setTodayRequestKey(key => key + 1)}>Thử lại</button></div> : todayCheckIns.length ? <div className="reception-gym-today-table reception-table-scroll reception-table-scroll--checkins" role="region" aria-label="Danh sách check-in hôm nay, có thể cuộn" tabIndex={0}><div className="reception-gym-today-heading"><span>Hội viên</span><span>Gói tập</span><span>Giờ vào</span><span>Giờ ra</span><span>Thao tác</span></div>{todayCheckIns.map(item => <article key={item.id}><span><strong>{item.memberName}</strong><small>{item.memberCode} · {item.phoneNumber || 'Chưa có SĐT'}</small></span><span>{item.packageName || 'Chưa có gói'}</span><span>{formatDateTime(item.checkInTime)}</span><span>{item.checkOutTime ? formatDateTime(item.checkOutTime) : 'Đang ở phòng gym'}</span><button type="button" disabled={Boolean(item.checkOutTime) || checkOutSavingId !== null} onClick={() => handleCheckOut(item)}>{checkOutSavingId === item.id ? 'Đang xử lý...' : item.checkOutTime ? 'Đã ra về' : 'Check-out'}</button></article>)}</div> : <EmptyState icon={UserCheck} title="Chưa có lượt check-in" text="Hôm nay chưa có hội viên nào vào phòng gym." />}
    </section>
    {cameraOpen && <Suspense fallback={<div className="reception-qr-camera-loading" role="status">Đang tải trình quét QR...<button type="button" onClick={closeCamera}>Hủy</button></div>}><QrCameraScanner onScan={handleScannedQr} onClose={closeCamera} onManualEntry={openManualQr} /></Suspense>}
  </div>
}
