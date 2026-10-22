import { useEffect, useRef, useState } from 'react'
import { AlertCircle, RefreshCw, X } from 'lucide-react'
import { deactivateSportClass, getClassClosureStatus, getClassErrorMessage } from '../../services/sportClassService'
import { SESSION_COMPLETION_EVENT } from '../../services/sessionCompletionService'

export default function CloseClassDialog({ sportClass, onClose, onClosed, onViewSessions }) {
  const [state, setState] = useState({ loading: true, unfinishedCount: null, error: '' })
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const closing = useRef(false)
  const blocked = state.loading || state.unfinishedCount !== 0 || !!state.error

  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: true, unfinishedCount: null, error: '' })
    getClassClosureStatus(sportClass.id, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setState({ ...result, loading: false, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ loading: false, unfinishedCount: null,
        error: getClassErrorMessage(error, 'Không thể kiểm tra buổi học. Vui lòng thử lại trước khi đóng lớp.') })
    })
    return () => controller.abort()
  }, [sportClass.id, revision])

  useEffect(() => {
    const refresh = event => {
      if (!closing.current && event.detail.some(session => String(session.classId) === String(sportClass.id))) {
        setRevision(value => value + 1)
      }
    }
    window.addEventListener(SESSION_COMPLETION_EVENT, refresh)
    return () => window.removeEventListener(SESSION_COMPLETION_EVENT, refresh)
  }, [sportClass.id])

  const close = () => { if (!closing.current) onClose() }
  const submit = async () => {
    if (blocked || closing.current) return
    closing.current = true
    setBusy(true)
    try {
      // The service rechecks every page immediately before sending the close request.
      await deactivateSportClass(sportClass.id)
      onClosed()
    } catch (error) {
      setState({ loading: false, unfinishedCount: error.unfinishedCount ?? null,
        error: getClassErrorMessage(error, 'Không thể đóng lớp học. Vui lòng thử lại.') })
    } finally {
      closing.current = false
      setBusy(false)
    }
  }

  return <div className="class-modal-overlay" onClick={close}>
    <section className="class-modal" role="dialog" aria-modal="true" aria-label="Đóng lớp học" onClick={event => event.stopPropagation()}>
      <div className="class-modal-header"><h3>Đóng lớp học</h3><button type="button" className="class-modal-close" aria-label="Đóng hộp thoại" disabled={busy} onClick={close}><X size={18} /></button></div>
      <div className="class-modal-body">
        <p>Bạn có muốn đóng lớp <strong>“{sportClass.className}”</strong> (Mã: #{sportClass.id})?</p>
        {state.loading ? <p role="status">Đang kiểm tra các buổi học của lớp…</p>
          : state.error ? <div className="class-alert class-alert-error" role="alert"><AlertCircle size={18} /><span>{state.error}</span></div>
          : state.unfinishedCount > 0 ? <div className="class-alert class-alert-error" role="alert"><AlertCircle size={18} /><span>Lớp còn <strong>{state.unfinishedCount} buổi chưa hoàn thành hoặc chưa hủy</strong>. Hãy xử lý các buổi này trước khi đóng lớp.</span></div>
          : <p role="status">Các buổi học đều đã hoàn thành hoặc đã hủy. Bạn có thể đóng lớp.</p>}
        {!state.loading && blocked && <div className="class-close-actions">
          <button type="button" className="class-btn class-btn-secondary" disabled={busy} onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} />Kiểm tra lại</button>
          <button type="button" className="class-btn class-btn-secondary" disabled={busy} onClick={onViewSessions}>Xem buổi học</button>
        </div>}
      </div>
      <div className="class-modal-footer">
        <button type="button" className="class-btn class-btn-secondary" disabled={busy} onClick={close}>Hủy bỏ</button>
        <button type="button" className="class-btn class-btn-danger" disabled={blocked || busy} onClick={submit}>{busy ? 'Đang kiểm tra và đóng lớp…' : 'Xác nhận đóng lớp'}</button>
      </div>
    </section>
  </div>
}
