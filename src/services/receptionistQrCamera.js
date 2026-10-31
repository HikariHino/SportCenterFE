export function qrCameraErrorMessage(error) {
  if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error?.name)) {
    return 'Chưa được cấp quyền camera. Hãy cho phép camera trong cài đặt của trang rồi nhấn Thử lại, hoặc nhập mã QR thủ công.'
  }
  if (['NotFoundError', 'DevicesNotFoundError'].includes(error?.name)) return 'Không tìm thấy camera. Bạn có thể nhập mã QR thủ công.'
  if (['NotReadableError', 'TrackStartError'].includes(error?.name)) return 'Không mở được camera. Hãy đóng ứng dụng đang dùng camera rồi thử lại.'
  return 'Không thể mở trình quét QR. Vui lòng thử lại hoặc nhập mã QR thủ công.'
}

// A camera session belongs only to the open Receptionist scanner. Nothing is
// requested before start(), and late permission grants are stopped after close.
export function createReceptionistQrCamera({ video, onResult, onError, onReady }, {
  mediaDevices = navigator.mediaDevices,
  secureContext = window.isSecureContext,
  loadScanner = () => import('qr-scanner').then(module => module.default),
  requestFrame = callback => window.requestAnimationFrame(callback),
  cancelFrame = id => window.cancelAnimationFrame(id),
} = {}) {
  let stopped = false
  let started = false
  let stream
  let engine
  let frame
  let lastScan = -Infinity

  const stop = () => {
    stopped = true
    if (frame != null) cancelFrame(frame)
    stream?.getTracks().forEach(track => track.stop())
    stream = null
    engine?.terminate?.()
    engine = null
    video.pause()
    video.srcObject = null
  }

  const start = async () => {
    if (started || stopped) return
    started = true
    if (!secureContext || !mediaDevices?.getUserMedia) {
      stop()
      onError(!secureContext
        ? 'Camera cần kết nối HTTPS hoặc localhost. Bạn vẫn có thể nhập mã QR thủ công.'
        : 'Trình duyệt này không hỗ trợ camera. Bạn có thể nhập mã QR thủ công.')
      return
    }
    try {
      const cameraStream = await mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } })
      if (stopped) {
        cameraStream.getTracks().forEach(track => track.stop())
        return
      }
      stream = cameraStream
      video.srcObject = stream
      await video.play()
      if (stopped) return
      const scanner = await loadScanner()
      if (stopped) return
      const qrEngine = await scanner.createQrEngine()
      if (stopped) {
        qrEngine?.terminate?.()
        return
      }
      engine = qrEngine
      onReady()

      const scan = async timestamp => {
        if (stopped) return
        if (video.readyState >= 2 && timestamp - lastScan >= 100) {
          lastScan = timestamp
          try {
            const result = await scanner.scanImage(video, { qrEngine: engine, returnDetailedScanResult: true })
            if (stopped) return
            const value = result?.data?.trim()
            if (value) {
              stop()
              onResult(value)
              return
            }
          } catch (error) {
            if (stopped) return
            if (error !== scanner.NO_QR_CODE_FOUND) {
              stop()
              onError('Không thể đọc hình ảnh từ camera. Vui lòng thử lại hoặc nhập mã QR thủ công.')
              return
            }
          }
        }
        if (!stopped) frame = requestFrame(scan)
      }
      frame = requestFrame(scan)
    } catch (error) {
      if (stopped) return
      stop()
      onError(qrCameraErrorMessage(error))
    }
  }

  return { start, stop }
}
