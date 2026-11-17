import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, upload
const imageUrl = 'https://assets.example.test/support-tickets/incident.png'
const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
const image = () => new File([bytes], 'incident.PNG', { type: 'image/png' })
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null, removeItem() {} } })
  globalThis.window = { location: { pathname: '/login' } }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  upload = (await server.ssrLoadModule('/src/services/supportTicketService.js')).uploadSupportTicketImage
})
after(async () => { await server?.close(); delete globalThis.localStorage; delete globalThis.sessionStorage; delete globalThis.window })

test('support ticket upload sends only the original file after a valid ticket ID and returns the saved image', async () => {
  api.defaults.adapter = async config => {
    assert.equal(config.url, '/SupportTickets/7/image')
    assert.equal(config.method, 'post')
    assert.equal(config.timeout, 30000)
    assert.match(config.headers.getContentType(), /multipart\/form-data/)
    assert.ok(config.data instanceof FormData)
    assert.deepEqual([...config.data.keys()], ['file'])
    assert.deepEqual(Buffer.from(await config.data.get('file').arrayBuffer()), bytes)
    return { data: { success: true, data: { id: 7, imageUrl, status: 'Open' } }, status: 200, headers: {}, config }
  }
  assert.deepEqual(await upload('7', image()), { id: 7, imageUrl, status: 'Open' })
})

test('invalid ticket IDs, size, extension and fake images never reach the support API', async () => {
  api.defaults.adapter = () => assert.fail('Invalid attachment reached the API')
  for (const id of [null, 0, -1, 1.5, 'abc', 2147483648]) await assert.rejects(upload(id, image()), /phiếu hỗ trợ/)
  for (const [file, message] of [
    [null, /chọn tệp/], [new File([bytes], 'bad.gif'), /Chỉ chấp nhận/],
    [new File([], 'empty.png'), /dung lượng/], [new File([new Uint8Array(2097153)], 'large.png'), /dung lượng/],
    [new File(['fake'], 'renamed.png', { type: 'image/png' }), /Nội dung tệp/],
  ]) await assert.rejects(upload(7, file), message)
})

test('failed, mismatched and unsafe image responses cannot become a confirmed attachment', async () => {
  for (const [body, message] of [
    [{ success: false, message: 'Kho ảnh tạm ngừng' }, /Kho ảnh tạm ngừng/],
    [{ statusCode: 500, message: 'Lỗi ảnh' }, /Lỗi ảnh/],
    [{ data: { id: 8, imageUrl } }, /Chưa xác nhận/],
    [{ data: { id: 7, imageUrl: 'javascript:alert(1)' } }, /Chưa xác nhận/],
    [{ data: { id: 7 } }, /Chưa xác nhận/],
  ]) {
    api.defaults.adapter = async config => ({ data: body, status: 200, headers: {}, config })
    await assert.rejects(upload(7, image()), message)
  }
})

test('ownership and closed ticket rejections from the backend remain available to the UI', async () => {
  for (const status of [401, 403, 409]) {
    const failure = Object.assign(new Error('Rejected'), { response: { status, data: { message: 'Không được cập nhật ảnh phiếu này.' } } })
    api.defaults.adapter = async () => { throw failure }
    await assert.rejects(upload(7, image()), error => error === failure)
  }
})
