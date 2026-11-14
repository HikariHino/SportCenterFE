export function qrCameraErrorMessage(error) {
  if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error?.name)) {
    return 'Chưa được cấp quyền camera. Hãy cho phép camera trong cài đặt của trang rồi nhấn Thử lại, hoặc nhập mã QR thủ công.'
  }
  if (['NotFoundError', 'DevicesNotFoundError'].includes(error?.name)) return 'Không tìm thấy camera. Bạn có thể nhập mã QR thủ công.'
  if (['NotReadableError', 'TrackStartError'].includes(error?.name)) return 'Không mở được camera. Hãy đóng ứng dụng đang dùng camera rồi thử lại.'
  return 'Không thể mở trình quét QR. Vui lòng thử lại hoặc nhập mã QR thủ công.'
}

// BarcodeDetector's scanImage path prefixes ordinary misses with "Scanner error:".
// They are expected while a camera is pointed at a scene without a QR code.
export function isQrCameraMiss(error, noCodeMessage = 'No QR code found') {
  const message = String(error?.message || error || '').replace(/^(?:Scanner error:\s*)+/i, '').trim()
  return message.toLowerCase() === String(noCodeMessage).toLowerCase()
}

// A camera session belongs only to the open Receptionist scanner. Nothing is
// requested before start(), and late permission grants are stopped after close.
export function createReceptionistQrCamera({ video, onResult, onError, onReady, facingMode = 'environment' }, {
  mediaDevices = navigator.mediaDevices,
  secureContext = window.isSecureContext,
  loadScanner = () => import('qr-scanner').then(module => module.default),
  loadFallbackEngine = () => import('qr-scanner/qr-scanner-worker.min.js').then(module => module.createWorker()),
  createCanvas = () => document.createElement('canvas'),
  requestFrame = callback => window.requestAnimationFrame(callback),
  cancelFrame = id => window.cancelAnimationFrame(id),
} = {}) {
  let stopped = false
  let started = false
  let stream
  let engine
  let frame
  let lastScan = -Infinity
  let nativeMisses = 0
  let canvas

  const useEngine = nextEngine => {
    if (stopped) { nextEngine?.terminate?.(); return false }
    engine?.terminate?.()
    engine = nextEngine
    // Configure the bundled qr-scanner worker for both normal and inverted QR.
    engine?.postMessage?.({ id: -1, type: 'inversionMode', data: 'both' })
    return true
  }

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
      const cameraStream = await mediaDevices.getUserMedia({ audio: false, video: {
        facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 },
      } })
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
      let qrEngine
      try { qrEngine = await scanner.createQrEngine() }
      catch { if (!stopped) qrEngine = await loadFallbackEngine() }
      if (!useEngine(qrEngine)) return
      canvas = createCanvas()
      onReady()

      const scan = async timestamp => {
        if (stopped) return
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && timestamp - lastScan >= 100) {
          lastScan = timestamp
          try {
            const result = await scanner.scanImage(video, { qrEngine: engine, canvas, returnDetailedScanResult: true })
            if (stopped) return
            const value = (typeof result === 'string' ? result : result?.data)?.trim()
            if (value) {
              stop()
              onResult(value)
              return
            }
          } catch (error) {
            if (stopped) return
            const miss = isQrCameraMiss(error, scanner.NO_QR_CODE_FOUND)
            const transientFrame = ['InvalidStateError', 'IndexSizeError'].includes(error?.name)
            if (!transientFrame && typeof engine?.detect === 'function' && (!miss || ++nativeMisses >= 15)) {
              // Some browsers advertise BarcodeDetector but fail to decode.
              // Switch once to the bundled decoder without reopening the camera.
              try { if (!useEngine(await loadFallbackEngine())) return }
              catch {
                if (stopped) return
                stop()
                onError('Không thể khởi động bộ đọc QR dự phòng. Vui lòng thử lại hoặc nhập mã thủ công.')
                return
              }
            } else if (!miss && !transientFrame) {
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
