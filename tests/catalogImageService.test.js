import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, service
const imageUrl = 'https://assets.example.test/images/catalog.png'
const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
const image = new File([pngBytes], 'catalog.PNG', { type: 'image/png' })

before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/catalogImageService.js')
})

after(async () => {
  await server?.close()
  delete globalThis.localStorage
  delete globalThis.sessionStorage
})

test('manager image endpoints receive the original file in the multipart file field', async () => {
  const requests = []
  api.defaults.adapter = async config => {
    requests.push(config.url)
    assert.equal(config.method, 'post')
    assert.match(config.headers.getContentType(), /multipart\/form-data/)
    assert.ok(config.data instanceof FormData)
    assert.deepEqual([...config.data.keys()], ['file'])
    assert.equal(config.data.get('file').name, 'catalog.PNG')
    assert.deepEqual(Buffer.from(await config.data.get('file').arrayBuffer()), pngBytes)
    return { data: { success: true, data: { id: 7, imageUrl } }, status: 200, headers: {}, config }
  }
  assert.equal(await service.uploadMembershipPackageImage(7, image), imageUrl)
  assert.equal(await service.uploadSportImage('7', image), imageUrl)
  assert.equal(await service.uploadClassImage(7, image), imageUrl)
  assert.deepEqual(requests, ['/membership-packages/7/image', '/sports/7/image', '/classes/7/image'])
})

test('files with invalid size, type or contents are rejected before uploading', async () => {
  api.defaults.adapter = () => assert.fail('An invalid file reached the upload endpoint')
  await assert.rejects(service.uploadSportImage(7, new File([pngBytes], 'picture.gif')), /Chỉ chấp nhận/)
  await assert.rejects(service.uploadSportImage(7, new File([], 'empty.png')), /dung lượng/)
  await assert.rejects(service.uploadSportImage(7, new File([new Uint8Array(2097153)], 'large.jpg')), /dung lượng/)
  await assert.rejects(service.uploadClassImage(7, new File(['plain text'], 'fake.png', { type: 'image/png' })), /Nội dung tệp/)
})

test('an upload cannot replace the current image using a failed or mismatched response', async () => {
  for (const [body, expectedError] of [
    [{ success: false, message: 'Storage chưa sẵn sàng' }, /Storage chưa sẵn sàng/],
    [{ success: true, data: { id: 8, imageUrl } }, /Không xác nhận/],
    [{ success: true, data: { id: 7, imageUrl: 'data:text/plain,fake' } }, /Không xác nhận/],
  ]) {
    api.defaults.adapter = async config => ({ data: body, status: 200, headers: {}, config })
    await assert.rejects(service.uploadMembershipPackageImage(7, image), expectedError)
    await assert.rejects(service.uploadClassImage(7, image), expectedError)
  }
})

test('a missing class image endpoint shows a clear message and preserves backend class errors', async () => {
  const backendError = data => Object.assign(new Error('Request failed with status code 404'), {
    response: { status: 404, data },
  })
  api.defaults.adapter = async () => { throw backendError('') }
  await assert.rejects(service.uploadClassImage(7, image), /Máy chủ chưa hỗ trợ tải ảnh lớp học/)

  const missingClass = backendError({ message: 'Không tìm thấy lớp học.' })
  api.defaults.adapter = async () => { throw missingClass }
  await assert.rejects(service.uploadClassImage(7, image), error => error === missingClass)
})
