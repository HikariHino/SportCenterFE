import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createReceptionistQrCamera, isQrCameraMiss, qrCameraErrorMessage } from '../src/services/receptionistQrCamera.js'

function fixture(changes = {}) {
  const state = { requests: [], stoppedTracks: 0, terminated: 0, results: [], errors: [], ready: 0, frames: new Map() }
  const stream = { getTracks: () => [{ stop: () => { state.stoppedTracks++ } }] }
  const video = { readyState: 4, videoWidth: 1280, videoHeight: 720, srcObject: null, play: async () => {}, pause() {} }
  const engine = { terminate: () => { state.terminated++ } }
  const scanner = { NO_QR_CODE_FOUND: 'No QR code found', createQrEngine: async () => engine, scanImage: async () => ({ data: ' SC-MEM-000020 ' }) }
  let frameId = 0
  const dependencies = {
    mediaDevices: { getUserMedia: async constraints => { state.requests.push(constraints); return stream } },
    secureContext: true, loadScanner: async () => scanner, createCanvas: () => ({}),
    requestFrame: callback => { const id = ++frameId; state.frames.set(id, callback); return id },
    cancelFrame: id => state.frames.delete(id),
    ...changes,
  }
  const camera = createReceptionistQrCamera({ video, onReady: () => { state.ready++ }, onResult: value => state.results.push(value), onError: message => state.errors.push(message) }, dependencies)
  const scanFrame = async timestamp => {
    const [id, callback] = state.frames.entries().next().value
    state.frames.delete(id)
    await callback(timestamp)
  }
  return { camera, state, stream, scanner, engine, video, scanFrame }
}

test('camera permission is requested only on start and never requests audio', async () => {
  const { camera, state, video, stream, scanFrame } = fixture()
  assert.equal(state.requests.length, 0)
  await camera.start()
  await camera.start()
  assert.deepEqual(state.requests, [{ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }])
  assert.equal(state.ready, 1)
  assert.equal(video.srcObject, stream)
  await scanFrame(0)
  assert.deepEqual(state.results, ['SC-MEM-000020'])
  assert.equal(state.stoppedTracks, 1)
  assert.equal(state.terminated, 1)
  assert.equal(video.srcObject, null)
  assert.equal(state.frames.size, 0)
})

test('closing before a pending camera permission resolves immediately stops a late stream', async () => {
  let grant
  const permission = new Promise(resolve => { grant = resolve })
  const { camera, state, stream, video } = fixture({ mediaDevices: { getUserMedia: () => permission } })
  const starting = camera.start()
  camera.stop()
  grant(stream)
  await starting
  assert.equal(state.stoppedTracks, 1)
  assert.equal(state.ready, 0)
  assert.deepEqual(state.results, [])
  assert.deepEqual(state.errors, [])
  assert.equal(video.srcObject, null)
})

test('closing during decoder initialization stops camera and terminates a late worker', async () => {
  let resolveEngine, engineStarted
  const waitingForEngine = new Promise(resolve => { engineStarted = resolve })
  const enginePromise = new Promise(resolve => { resolveEngine = resolve })
  const { camera, state, scanner, engine } = fixture()
  scanner.createQrEngine = () => { engineStarted(); return enginePromise }
  const starting = camera.start()
  await waitingForEngine
  camera.stop()
  resolveEngine(engine)
  await starting
  assert.equal(state.stoppedTracks, 1)
  assert.equal(state.terminated, 1)
  assert.equal(state.ready, 0)
  assert.equal(state.frames.size, 0)
})

test('camera rejection and missing devices expose actionable messages without decoding', async () => {
  for (const [name, message] of [['NotAllowedError', /quyền camera/], ['NotFoundError', /Không tìm thấy camera/], ['NotReadableError', /đang dùng camera/]]) {
    const { camera, state } = fixture({ mediaDevices: { getUserMedia: async () => { throw Object.assign(new Error(), { name }) } } })
    await camera.start()
    assert.match(state.errors[0], message)
    assert.equal(state.ready, 0)
    assert.equal(state.frames.size, 0)
  }
  assert.doesNotMatch(qrCameraErrorMessage(new Error('private camera details')), /private/)
})

test('insecure origins and unsupported camera APIs do not request camera access', async () => {
  for (const changes of [{ secureContext: false }, { mediaDevices: {} }]) {
    const { camera, state } = fixture(changes)
    await camera.start()
    assert.equal(state.requests.length, 0)
    assert.equal(state.errors.length, 1)
    assert.equal(state.ready, 0)
  }
})

test('frames without a QR keep scanning and a valid result is delivered once', async () => {
  const { camera, state, scanner, scanFrame } = fixture()
  let decodes = 0
  scanner.scanImage = async () => { if (++decodes === 1) throw scanner.NO_QR_CODE_FOUND; return { data: 'SC-MEM-000020' } }
  await camera.start()
  await scanFrame(0)
  assert.deepEqual(state.results, [])
  assert.equal(state.errors.length, 0)
  assert.equal(state.frames.size, 1)
  await scanFrame(100)
  camera.stop()
  assert.deepEqual(state.results, ['SC-MEM-000020'])
  assert.equal(state.stoppedTracks, 1)
  assert.equal(state.frames.size, 0)
})

test('native Chrome misses, wrapped strings and Error objects keep the camera running until a QR appears', async () => {
  for (const miss of ['No QR code found', 'Scanner error: No QR code found', new Error('Scanner error: No QR code found')]) {
    const { camera, state, scanner, scanFrame } = fixture()
    let frames = 0
    scanner.scanImage = async () => { if (++frames < 4) throw miss; return { data: ' SC-MEM-000020 ' } }
    await camera.start()
    for (let time = 0; time < 300; time += 100) {
      await scanFrame(time)
      assert.equal(state.frames.size, 1)
      assert.equal(state.stoppedTracks, 0)
      assert.deepEqual(state.errors, [])
    }
    await scanFrame(300)
    assert.deepEqual(state.results, ['SC-MEM-000020'])
    assert.equal(state.stoppedTracks, 1)
    assert.equal(state.frames.size, 0)
  }
  assert.equal(isQrCameraMiss(new Error('Scanner error: timeout')), false)
})

test('zero-size and transient video frames wait for the next frame without discarding the camera', async () => {
  const { camera, state, scanner, video, scanFrame } = fixture()
  let calls = 0
  scanner.scanImage = async () => {
    if (++calls === 1) throw Object.assign(new Error('Frame not ready'), { name: 'InvalidStateError' })
    return { data: 'QR' }
  }
  await camera.start()
  video.videoWidth = 0
  await scanFrame(0)
  assert.equal(calls, 0)
  video.videoWidth = 1280
  await scanFrame(100)
  assert.equal(state.stoppedTracks, 0)
  await scanFrame(200)
  assert.deepEqual(state.results, ['QR'])
})

test('a broken native detector switches to the software decoder while retaining the stream and canvas', async () => {
  const native = { detect() {} }
  const messages = []
  let terminated = 0, fallbacks = 0
  const worker = { postMessage: message => messages.push(message), terminate() { terminated++ } }
  const { camera, state, scanner, scanFrame } = fixture({ loadFallbackEngine: async () => { fallbacks++; return worker } })
  scanner.createQrEngine = async () => native
  let firstCanvas
  scanner.scanImage = async (video, { qrEngine, canvas }) => {
    if (!firstCanvas) firstCanvas = canvas
    assert.equal(canvas, firstCanvas)
    if (qrEngine === native) throw new Error('Scanner error: service unavailable')
    assert.equal(qrEngine, worker)
    return { data: 'QR' }
  }
  await camera.start()
  await scanFrame(0)
  assert.equal(state.stoppedTracks, 0)
  assert.equal(state.requests.length, 1)
  await scanFrame(100)
  assert.deepEqual(state.results, ['QR'])
  assert.equal(fallbacks, 1)
  assert.equal(terminated, 1)
  assert.deepEqual(messages, [{ id: -1, type: 'inversionMode', data: 'both' }])
})

test('native detection that silently keeps missing QR codes falls back after a bounded number of frames', async () => {
  const native = { detect() {} }
  const worker = { terminate() {} }
  let fallbacks = 0
  const { camera, state, scanner, scanFrame } = fixture({ loadFallbackEngine: async () => { fallbacks++; return worker } })
  scanner.createQrEngine = async () => native
  scanner.scanImage = async (video, { qrEngine }) => {
    if (qrEngine === native) throw 'Scanner error: No QR code found'
    return 'QR'
  }
  await camera.start()
  for (let index = 0; index < 15; index++) await scanFrame(index * 100)
  assert.equal(fallbacks, 1)
  assert.equal(state.errors.length, 0)
  await scanFrame(1500)
  assert.deepEqual(state.results, ['QR'])
})

test('closing during native fallback terminates a late worker and never resumes scanning', async () => {
  let release, started
  const waiting = new Promise(resolve => { started = resolve })
  let terminated = 0
  const worker = { terminate() { terminated++ } }
  const { camera, state, scanner, scanFrame } = fixture({ loadFallbackEngine: () => { started(); return new Promise(resolve => { release = resolve }) } })
  scanner.createQrEngine = async () => ({ detect() {} })
  scanner.scanImage = async () => { throw 'Scanner error: timeout' }
  await camera.start()
  const decoding = scanFrame(0)
  await waiting
  camera.stop()
  release(worker)
  await decoding
  assert.equal(terminated, 1)
  assert.equal(state.frames.size, 0)
  assert.equal(state.stoppedTracks, 1)
  assert.deepEqual(state.errors, [])
  assert.deepEqual(state.results, [])
})

test('initialization falls back when native decoder setup fails and releases tracks if both decoders fail', async () => {
  const worker = { terminate() {} }
  const good = fixture({ loadFallbackEngine: async () => worker })
  good.scanner.createQrEngine = async () => { throw new Error('Native not available') }
  await good.camera.start()
  await good.scanFrame(0)
  assert.equal(good.state.ready, 1)
  assert.equal(good.state.results.length, 1)
  const failed = fixture({ loadFallbackEngine: async () => { throw new Error('Worker unavailable') } })
  failed.scanner.createQrEngine = good.scanner.createQrEngine
  await failed.camera.start()
  assert.equal(failed.state.stoppedTracks, 1)
  assert.equal(failed.state.errors.length, 1)
})

test('a decoder result that arrives after closing is ignored', async () => {
  let decoded
  const result = new Promise(resolve => { decoded = resolve })
  const { camera, state, scanner, scanFrame } = fixture()
  scanner.scanImage = () => result
  await camera.start()
  const scanning = scanFrame(0)
  camera.stop()
  decoded({ data: 'SC-MEM-000020' })
  await scanning
  assert.deepEqual(state.results, [])
  assert.equal(state.frames.size, 0)
})

test('unexpected decoding and playback failures release camera tracks', async () => {
  const { camera, state, scanner, scanFrame } = fixture()
  scanner.scanImage = async () => { throw new Error('decoder failed') }
  await camera.start()
  await scanFrame(0)
  assert.equal(state.stoppedTracks, 1)
  assert.equal(state.terminated, 1)
  assert.match(state.errors[0], /Không thể đọc hình ảnh/)
  const playback = fixture()
  playback.video.play = async () => { throw new Error('playback failed') }
  await playback.camera.start()
  assert.equal(playback.state.stoppedTracks, 1)
  assert.equal(playback.state.errors.length, 1)
})
