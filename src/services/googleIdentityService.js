const SCRIPT_ID = 'sportpulse-google-identity'
let loading
let initializedSdk
let initializedClientId
let activeButton
let buttonSequence = 0

export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const script = document.getElementById(SCRIPT_ID) || document.createElement('script')
    const finish = (error) => {
      clearTimeout(timer)
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
      if (error) { script.remove(); reject(error) }
      else resolve(window.google.accounts.id)
    }
    const onLoad = () => finish(window.google?.accounts?.id ? null : new Error('Google SDK unavailable'))
    const onError = () => finish(new Error('Google SDK unavailable'))
    const timer = setTimeout(onError, 15000)
    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)
    if (!script.parentNode) {
      script.id = SCRIPT_ID
      script.src = 'https://accounts.google.com/gsi/client?hl=vi'
      script.async = true
      document.head.appendChild(script)
    }
  }).catch(error => { loading = undefined; throw error })
  return loading
}

// GIS initialization is shared across React remounts. Only the mounted button
// receives credentials; callbacks from a removed button are ignored.
export function mountGoogleSignInButton(sdk, host, clientId, onCredential) {
  if (sdk !== initializedSdk || clientId !== initializedClientId) {
    sdk.initialize({
      client_id: clientId,
      auto_select: false,
      ux_mode: 'popup',
      callback: response => {
        if (activeButton && (!response.state || response.state === activeButton.state)) {
          activeButton.onCredential(response.credential)
        }
      },
    })
    initializedSdk = sdk
    initializedClientId = clientId
  }
  const button = { state: `sportpulse-${++buttonSequence}`, onCredential }
  activeButton = button
  let previousWidth
  const render = () => {
    const width = Math.min(400, Math.floor(host.clientWidth || 320))
    if (width === previousWidth) return
    previousWidth = width
    host.replaceChildren()
    sdk.renderButton(host, {
      type: 'standard', theme: 'outline', size: 'large', text: 'signin_with',
      shape: 'rectangular', logo_alignment: 'left', locale: 'vi',
      width: String(width), state: button.state,
    })
  }
  let observer
  const dispose = () => {
    observer?.disconnect()
    if (activeButton === button) activeButton = undefined
    host.replaceChildren()
  }
  try {
    render()
    observer = typeof ResizeObserver === 'function' ? new ResizeObserver(render) : null
    observer?.observe(host)
  } catch (error) {
    dispose()
    throw error
  }
  return dispose
}
