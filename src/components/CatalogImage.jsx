import { useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { isCatalogImageUrl } from '../utils/catalogImages'
import '../style/CatalogImage.css'

export default function CatalogImage({ src, fallback, className = '' }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const showImage = isCatalogImageUrl(src) && failedUrl !== src

  return <span className={`catalog-image ${className}`} aria-hidden="true">
    {showImage
      ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(src)} />
      : (fallback ?? <ImageIcon size={22} />)}
  </span>
}
