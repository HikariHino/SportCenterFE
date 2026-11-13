export const CATALOG_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp'
const maxImageBytes = 2 * 1024 * 1024
const allowedExtensions = CATALOG_IMAGE_ACCEPT.split(',')

export function isCatalogImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}

export async function validateCatalogImage(file) {
  if (!file) throw new Error('Vui lòng chọn tệp ảnh.')
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!allowedExtensions.includes(extension)) throw new Error('Chỉ chấp nhận ảnh JPG, JPEG, PNG hoặc WebP.')
  if (!file.size || file.size > maxImageBytes) throw new Error('Ảnh phải có dung lượng lớn hơn 0 và tối đa 2 MB.')

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const startsWith = (signature, offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte)
  const validFormat = extension === '.png'
    ? startsWith([137, 80, 78, 71, 13, 10, 26, 10])
    : extension === '.webp'
      ? startsWith([82, 73, 70, 70]) && startsWith([87, 69, 66, 80], 8)
      : startsWith([255, 216, 255])
  if (!validFormat) throw new Error('Nội dung tệp không khớp với định dạng ảnh đã chọn.')
}
