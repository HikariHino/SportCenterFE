import { useEffect, useId, useRef, useState } from 'react'
import { ImagePlus, RefreshCw, X, ZoomIn } from 'lucide-react'
import { CATALOG_IMAGE_ACCEPT, isCatalogImageUrl, validateCatalogImage } from '../utils/catalogImages'
import '../style/SupportTicketImage.css'

export function useSupportImageSelection() {
  const input = useRef(null)
  const revision = useRef(0)
  const [candidate, setCandidate] = useState(null)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => { revision.current++ }, [])
  useEffect(() => {
    if (candidate) return () => URL.revokeObjectURL(candidate.url)
  }, [candidate])

  const clear = () => {
    revision.current++
    setCandidate(null)
    setReady(false)
    setChecking(false)
    setError('')
    if (input.current) input.current.value = ''
  }
  const choose = async event => {
    const file = event.currentTarget.files?.[0]
    clear()
    if (!file) return
    const current = revision.current
    setChecking(true)
    try {
      await validateCatalogImage(file)
      if (revision.current === current) setCandidate({ file, url: URL.createObjectURL(file) })
    } catch (failure) {
      if (revision.current === current) setError(failure.message || 'Không đọc được ảnh. Vui lòng chọn lại.')
    } finally {
      if (revision.current === current) setChecking(false)
    }
  }
  const previewFailed = () => {
    clear()
    setError('Không đọc được ảnh đã chọn. Hãy chọn tệp khác hoặc bỏ ảnh để gửi phiếu.')
  }
  return { input, candidate, ready, checking, error, clear, choose, previewFailed,
    previewLoaded: () => setReady(true), blocked: checking || Boolean(error) || Boolean(candidate && !ready) }
}

export function SupportImagePicker({ selection, disabled = false }) {
  const id = useId()
  return <div className="support-image-picker">
    <label htmlFor={id}><ImagePlus size={18} /> Ảnh sự cố (không bắt buộc)</label>
    <input ref={selection.input} id={id} type="file" accept={CATALOG_IMAGE_ACCEPT} disabled={disabled} onChange={selection.choose} aria-describedby={`${id}-help${selection.error ? ` ${id}-error` : ''}`} aria-invalid={Boolean(selection.error)} />
    <small id={`${id}-help`}>Một ảnh JPG, JPEG, PNG hoặc WebP, tối đa 2 MB.</small>
    {selection.checking && <p role="status">Đang kiểm tra ảnh...</p>}
    {selection.candidate && <figure className="support-image-preview">
      <img key={selection.candidate.url} src={selection.candidate.url} alt="Xem trước ảnh sự cố đã chọn" onLoad={selection.previewLoaded} onError={selection.previewFailed} />
      <figcaption>{selection.candidate.file.name}</figcaption>
    </figure>}
    {selection.error && <p id={`${id}-error`} className="support-image-error" role="alert">{selection.error}</p>}
    {(selection.candidate || selection.error || selection.checking) && <button type="button" disabled={disabled} onClick={selection.clear}><X size={16} /> Bỏ ảnh đã chọn</button>}
  </div>
}

function TicketImage({ imageUrl, ticketId }) {
  const [opened, setOpened] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const dialog = useRef(null)
  const opener = useRef(null)
  const titleId = useId()
  const alt = `Ảnh sự cố đính kèm phiếu #${ticketId}`

  useEffect(() => {
    if (!opened) return
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    element.querySelector('button')?.focus({ preventScroll: true })
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true })
    }
  }, [opened])

  const retry = () => { setFailed(false); setAttempt(value => value + 1) }
  return <div className="support-ticket-image">
    {failed ? <div className="support-image-unavailable"><p>Không tải được ảnh sự cố.</p><button type="button" onClick={retry}><RefreshCw size={15} /> Tải lại ảnh</button></div>
      : <button className="support-image-thumbnail" type="button" aria-label={`Xem ảnh sự cố phiếu #${ticketId}`} onClick={event => { opener.current = event.currentTarget; setOpened(true) }}>
        <img key={attempt} src={imageUrl} alt={alt} loading="lazy" onError={() => setFailed(true)} />
        <span><ZoomIn size={16} /> Xem ảnh sự cố</span>
      </button>}
    {opened && <dialog ref={dialog} className="support-image-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); setOpened(false) }} onClick={event => { if (event.target === event.currentTarget) setOpened(false) }}>
      <header><h2 id={titleId}>Ảnh sự cố · Phiếu #{ticketId}</h2><button type="button" aria-label="Đóng ảnh sự cố" onClick={() => setOpened(false)}><X size={20} /></button></header>
      <div className="support-image-dialog-body">{failed ? <div className="support-image-unavailable"><p role="alert">Không tải được ảnh sự cố.</p><button type="button" onClick={retry}><RefreshCw size={15} /> Tải lại ảnh</button></div>
        : <img key={attempt} src={imageUrl} alt={alt} onError={() => setFailed(true)} />}</div>
    </dialog>}
  </div>
}

export default function SupportTicketImage({ imageUrl, ticketId }) {
  if (!imageUrl) return null
  if (!isCatalogImageUrl(imageUrl)) return <p className="support-image-error">Không thể mở ảnh đính kèm.</p>
  return <TicketImage key={imageUrl} imageUrl={imageUrl} ticketId={ticketId} />
}
