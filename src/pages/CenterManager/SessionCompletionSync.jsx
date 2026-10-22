import { useEffect, useRef, useState } from 'react'
import { completeExpiredClassSessions, SESSION_COMPLETION_EVENT } from '../../services/sessionCompletionService'
import { getClassErrorMessage } from '../../services/sportClassService'

export default function SessionCompletionSync() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const retry = useRef(null)

  useEffect(() => {
    let disposed = false, running = false, controller
    const sync = async () => {
      if (disposed || running) return
      running = true
      setBusy(true)
      controller = new AbortController()
      try {
        const result = await completeExpiredClassSessions({
          signal: controller.signal,
          onCompleted: sessions => window.dispatchEvent(new CustomEvent(SESSION_COMPLETION_EVENT, { detail: sessions })),
        })
        if (!disposed) setError(result.failed.length
          ? `Chưa lưu hoàn thành cho ${result.failed.length} buổi đã kết thúc. ${result.failed[0].message}`
          : '')
      } catch (requestError) {
        if (!disposed) setError(getClassErrorMessage(requestError, 'Chưa cập nhật được các buổi học đã kết thúc.'))
      } finally {
        running = false
        if (!disposed) setBusy(false)
      }
    }
    const resume = () => { if (document.visibilityState === 'visible') void sync() }
    retry.current = sync
    void sync()
    const timer = setInterval(sync, 60_000)
    window.addEventListener('online', sync)
    window.addEventListener('focus', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      disposed = true
      controller?.abort()
      clearInterval(timer)
      window.removeEventListener('online', sync)
      window.removeEventListener('focus', resume)
      document.removeEventListener('visibilitychange', resume)
      retry.current = null
    }
  }, [])

  return error && <div className="manager-session-sync-error" role="alert">
    <span>{error} Hệ thống sẽ tự thử lại.</span>
    <button type="button" disabled={busy} onClick={() => retry.current?.()}>{busy ? 'Đang cập nhật…' : 'Thử lại'}</button>
  </div>
}
