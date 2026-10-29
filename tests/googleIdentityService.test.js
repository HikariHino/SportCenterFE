import assert from 'node:assert/strict'
import { test } from 'node:test'

let sequence = 0
async function isolated(t) {
  const descriptors = ['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  const scripts = []
  const head = { appendChild(script) { scripts.push(script); script.parentNode = head } }
  class Script extends EventTarget {
    remove() { this.parentNode = null }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { head, createElement: () => new Script(), getElementById: id => scripts.find(script => script.parentNode && script.id === id) } })
  t.after(() => {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  const service = await import(`../src/services/googleIdentityService.js?test=${++sequence}`)
  return { service, scripts }
}

test('concurrent SDK requests share one official script and resolve after load', async t => {
  const { service, scripts } = await isolated(t)
  const first = service.loadGoogleIdentity()
  const second = service.loadGoogleIdentity()
  assert.equal(first, second)
  assert.equal(scripts.length, 1)
  assert.equal(scripts[0].src, 'https://accounts.google.com/gsi/client?hl=vi')
  const sdk = { initialize() {}, renderButton() {} }
  window.google = { accounts: { id: sdk } }
  scripts[0].dispatchEvent(new Event('load'))
  assert.equal(await first, sdk)
  assert.equal(await service.loadGoogleIdentity(), sdk)
  assert.equal(scripts.length, 1)
})

test('blocked SDK scripts can be retried', async t => {
  const { service, scripts } = await isolated(t)
  const failed = service.loadGoogleIdentity()
  const rejection = assert.rejects(failed, /unavailable/)
  scripts[0].dispatchEvent(new Event('error'))
  await rejection
  assert.equal(scripts[0].parentNode, null)
  const retry = service.loadGoogleIdentity()
  assert.equal(scripts.length, 2)
  window.google = { accounts: { id: {} } }
  scripts[1].dispatchEvent(new Event('load'))
  await retry
})

test('an SDK that never responds times out instead of leaving login loading forever', async t => {
  const { service, scripts } = await isolated(t)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const pending = service.loadGoogleIdentity()
  const rejection = assert.rejects(pending, /unavailable/)
  t.mock.timers.tick(15000)
  await rejection
  assert.equal(scripts[0].parentNode, null)
})

test('GIS initializes once, ignores removed button callbacks and retains responsive branded options', async t => {
  const { service } = await isolated(t)
  let initialization, buttonOptions, initializationCount = 0
  const sdk = {
    initialize(options) { initialization = options; initializationCount++ },
    renderButton(host, options) { buttonOptions = options },
  }
  const host = { clientWidth: 350, replaceChildren() {} }
  const received = []
  const dispose = service.mountGoogleSignInButton(sdk, host, 'client-id', token => received.push(token))
  const firstState = buttonOptions.state
  assert.equal(buttonOptions.width, '350')
  assert.equal(buttonOptions.locale, 'vi')
  assert.equal(initialization.ux_mode, 'popup')
  assert.equal(initialization.auto_select, false)
  initialization.callback({ credential: 'first', state: firstState })
  dispose()
  initialization.callback({ credential: 'after-unmount', state: firstState })
  host.clientWidth = 800
  const disposeAgain = service.mountGoogleSignInButton(sdk, host, 'client-id', token => received.push(token))
  assert.equal(initializationCount, 1)
  assert.equal(buttonOptions.width, '400')
  initialization.callback({ credential: 'stale-popup', state: firstState })
  initialization.callback({ credential: 'second', state: buttonOptions.state })
  assert.deepEqual(received, ['first', 'second'])
  disposeAgain()
})

test('a failed button render does not leave a credential callback active', async t => {
  const { service } = await isolated(t)
  let initialization, calls = 0
  const sdk = {
    initialize(config) { initialization = config },
    renderButton() { throw new Error('SDK rendering failed') },
  }
  const host = { clientWidth: 300, replaceChildren() {} }
  assert.throws(() => service.mountGoogleSignInButton(sdk, host, 'client-id', () => calls++), /rendering failed/)
  initialization.callback({ credential: 'late-credential' })
  assert.equal(calls, 0)
})
