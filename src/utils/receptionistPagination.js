export const RECEPTIONIST_PAGE_SIZE = 10

export function receptionistPage(total, requestedPage = 1) {
  const count = Math.max(0, Number.isSafeInteger(total) ? total : 0)
  const pageCount = Math.max(1, Math.ceil(count / RECEPTIONIST_PAGE_SIZE))
  const page = Math.min(pageCount, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1))
  const offset = (page - 1) * RECEPTIONIST_PAGE_SIZE
  return { page, pageCount, offset, from: count ? offset + 1 : 0, to: Math.min(offset + RECEPTIONIST_PAGE_SIZE, count), total: count }
}

// A UI page is ten rows. Fetch all API pages before local filtering/pagination
// so entries beyond the first server page remain reachable.
export async function getAllReceptionistPages(request) {
  const items = [], seen = new Set()
  for (let page = 1; ; page++) {
    const result = await request(page, 100)
    if (!Array.isArray(result?.items)) throw new Error('Dữ liệu phân trang không hợp lệ.')
    const next = result.items.filter(item => !seen.has(String(item.id)))
    if (result.items.length && !next.length) throw new Error('Máy chủ trả lặp trang dữ liệu. Vui lòng thử lại.')
    next.forEach(item => { seen.add(String(item.id)); items.push(item) })
    if (items.length >= Number(result.total || 0)) return items
    if (!result.items.length) throw new Error('Chưa tải đủ danh sách. Vui lòng thử lại.')
  }
}
