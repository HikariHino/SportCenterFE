import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, X } from 'lucide-react'
import { createReceptionistQrCamera } from '../../services/receptionistQrCamera'

export default function QrCameraScanner({ onScan, onClose, onManualEntry }) {
  const video = useRef(null)
  const closeButton = useRef(null)
  const callbacks = useRef({ onScan, onClose })
  callbacks.current = { onScan, onClose }
  const [status, setStatus] = useState('starting')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    closeButton.current?.focus()
    setStatus('starting')
    setError('')
    let active = true
    const camera = createReceptionistQrCamera({
      video: video.current,
      onReady: () => { if (active) setStatus('scanning') },
      onResult: value => { if (active) callbacks.current.onScan(value) },
      onError: message => { if (active) { setError(message); setStatus('error') } },
    })
    const close = () => {
      active = false
      camera.stop()
      callbacks.current.onClose()
    }
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      if (event.key === 'Tab') {
        const buttons = closeButton.current?.closest('[role="dialog"]')?.querySelectorAll('button:not(:disabled)')
        if (!buttons?.length) return
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    const onVisibilityChange = () => { if (document.hidden) close() }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('visibilitychange', onVisibilityChange)
    camera.start()
    return () => {
      active = false
      camera.stop()
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [attempt])

  return <div className="reception-dialog-backdrop reception-qr-camera-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="reception-dialog reception-qr-camera-dialog" role="dialog" aria-modal="true" aria-labelledby="reception-qr-camera-title">
      <header><div><span>CHECK-IN BẰNG QR</span><h2 id="reception-qr-camera-title">Quét mã bằng camera</h2><p>Đưa mã QR hội viên vào khung hình.</p></div><button ref={closeButton} type="button" onClick={onClose} aria-label="Đóng camera"><X size={19} /></button></header>
      <div className="reception-qr-camera-body">
        <div className="reception-qr-camera-preview"><video ref={video} autoPlay muted playsInline aria-label="Hình ảnh camera quét mã QR" />{status !== 'scanning' && <div><Camera size={34} /><span>{status === 'starting' ? 'Đang mở camera...' : 'Camera chưa sẵn sàng'}</span></div>}</div>
        {error ? <p className="reception-qr-camera-error" role="alert">{error}</p> : <p role="status">{status === 'starting' ? 'Chọn Cho phép khi trình duyệt hỏi quyền sử dụng camera.' : 'Đang tìm mã QR. Giữ mã rõ nét và đủ ánh sáng.'}</p>}
        <p>Quét được mã QR sẽ tự động check-in cho hội viên.</p>
      </div>
      <footer><button type="button" onClick={onManualEntry}>Xác nhận thủ công</button>{status === 'error' && <button className="reception-qr-camera-retry" type="button" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={15} />Thử lại</button>}</footer>
    </section>
  </div>
}
