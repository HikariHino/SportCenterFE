import api from './api'
import { isCatalogImageUrl, validateCatalogImage } from '../utils/catalogImages'

async function uploadImage(resource, id, file) {
  const targetId = Number(id)
  if (!Number.isInteger(targetId) || targetId < 1 || targetId > 2147483647) {
    throw new Error('Không tìm thấy mục cần cập nhật ảnh.')
  }
  await validateCatalogImage(file)
  const form = new FormData()
  form.append('file', file)
  const { data: body } = await api.post(`/${resource}/${targetId}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
  if (body?.success === false || Number(body?.statusCode) >= 400) {
    throw new Error(body.message || 'Không thể tải ảnh lên.')
  }
  const item = body?.data ?? body
  if (String(item?.id) !== String(targetId) || !isCatalogImageUrl(item?.imageUrl)) {
    throw new Error('Không xác nhận được ảnh mới. Hãy tải lại danh sách để kiểm tra.')
  }
  return item.imageUrl
}

export const uploadMembershipPackageImage = (id, file) => uploadImage('membership-packages', id, file)
export const uploadSportImage = (id, file) => uploadImage('sports', id, file)

export async function uploadClassImage(id, file) {
  try {
    return await uploadImage('classes', id, file)
  } catch (error) {
    if (error.response?.status === 404 && !error.response.data?.message) {
      throw new Error('Máy chủ chưa hỗ trợ tải ảnh lớp học. Vui lòng thử lại sau khi máy chủ được cập nhật.')
    }
    throw error
  }
}
