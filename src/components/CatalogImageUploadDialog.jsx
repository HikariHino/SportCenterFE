import { useEffect, useId, useRef, useState } from 'react'
import { LoaderCircle, Upload, X } from 'lucide-react'
import CatalogImage from './CatalogImage'
import { CATALOG_IMAGE_ACCEPT, validateCatalogImage } from '../utils/catalogImages'
import '../style/CenterManager/CatalogImageUploadDialog.css'

export default function CatalogImageUploadDialog({ name, imageUrl, upload, onUploaded, onClose }) {
  const titleId = useId()
  const helpId = useId()
  const dialogRef = useRef(null)
  const [candidate, setCandidate] = useState(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  useEffect(() => {
    if (candidate) return () => URL.revokeObjectURL(candidate.url)
  }, [candidate])

  function handleClose() {
    dialogRef.current.close()
    onClose()
  }

  async function chooseFile(event) {
    const input = event.currentTarget
    const file = input.files?.[0]
    setCandidate(null)
    setPreviewReady(false)
    setError('')
    if (!file) return

    try {
      await validateCatalogImage(file)
      if (input.isConnected && input.files?.[0] === file) {
        setCandidate({ file, url: URL.createObjectURL(file) })
      }
    } catch (failure) {
      if (input.isConnected && input.files?.[0] === file) setError(failure.message)
    }
  }

  async function handleUpload(event) {
    event.preventDefault()
    if (!candidate || !previewReady || uploading) return
    setError('')
    setUploading(true)
    try {
      const url = await upload(candidate.file)
      dialogRef.current?.close()
      onUploaded(url)
    } catch (failure) {
      setError(failure.code === 'ECONNABORTED'
        ? 'Tải ảnh quá lâu. Hãy tải lại danh sách để kiểm tra ảnh trước khi thử lại.'
        : failure.response?.data?.message || failure.message || 'Không thể tải ảnh lên. Vui lòng thử lại.')
    } finally {
      setUploading(false)
    }
  }

  return <dialog ref={dialogRef} className="catalog-upload-dialog" aria-labelledby={titleId} onCancel={event => {
    event.preventDefault()
    if (!uploading) handleClose()
  }}>
    <form onSubmit={handleUpload} aria-busy={uploading}>
      <header className="catalog-upload-header">
        <div><h3 id={titleId}>Cập nhật ảnh</h3><p>{name}</p></div>
        <button type="button" className="catalog-upload-close" aria-label="Đóng" disabled={uploading} onClick={handleClose}><X size={20} /></button>
      </header>
      <div className="catalog-upload-body">
        <div className="catalog-upload-previews">
          <figure><figcaption>Ảnh hiện tại</figcaption><CatalogImage src={imageUrl} /></figure>
          <figure><figcaption>Xem trước ảnh mới</figcaption>
            {candidate ? <span className="catalog-image"><img key={candidate.url} src={candidate.url} alt="Ảnh mới đã chọn" onLoad={() => setPreviewReady(true)} onError={() => {
              setCandidate(null)
              setPreviewReady(false)
              setError('Không đọc được ảnh đã chọn. Hãy chọn tệp khác.')
            }} /></span> : <CatalogImage />}
          </figure>
        </div>
        <label className="catalog-upload-file">Chọn tệp ảnh
          <input type="file" accept={CATALOG_IMAGE_ACCEPT} aria-describedby={helpId} disabled={uploading} onChange={chooseFile} />
        </label>
        <p id={helpId} className="catalog-upload-help">JPG, JPEG, PNG hoặc WebP. Tối đa 2 MB.</p>
        {error && <p className="catalog-upload-error" role="alert">{error}</p>}
      </div>
      <footer className="catalog-upload-footer">
        <button type="button" disabled={uploading} onClick={handleClose}>Hủy</button>
        <button type="submit" disabled={!previewReady || uploading}>
          {uploading ? <><LoaderCircle size={17} />Đang tải ảnh…</> : <><Upload size={17} />Lưu ảnh</>}
        </button>
      </footer>
    </form>
  </dialog>
}
