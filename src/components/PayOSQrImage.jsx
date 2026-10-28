import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import QRCode from 'qrcode'

export default function PayOSQrImage({ value, className }) {
  const [image, setImage] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setError('')
    QRCode.toDataURL(value, { width: 240, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then(url => { if (active) setImage({ value, url }) })
      .catch(() => { if (active) setError('Chưa tạo được ảnh QR. Bạn có thể mở cổng PayOS để thanh toán.') })
    return () => { active = false }
  }, [value])
  if (error) return <p role="status">{error}</p>
  if (image?.value !== value) return <LoaderCircle size={28} className="member-spin" aria-label="Đang tạo mã QR thanh toán" />
  return <img src={image.url} width="240" height="240" alt="Mã QR thanh toán PayOS" className={className} />
}
