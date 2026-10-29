import { useEffect, useRef, useState } from 'react'
import { loadGoogleIdentity, mountGoogleSignInButton } from '../services/googleIdentityService'
import { getGoogleClientId } from '../utils/googleAuth'

export default function GoogleSignInButton({ disabled, onCredential }) {
  const clientId = getGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID)
  const host = useRef(null)
  const callback = useRef(onCredential)
  callback.current = onCredential
  const [status, setStatus] = useState(clientId ? 'loading' : 'unavailable')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!clientId) return
    let active = true
    let dispose
    setStatus('loading')
    loadGoogleIdentity().then(sdk => {
      if (!active) return
      dispose = mountGoogleSignInButton(sdk, host.current, clientId, credential => callback.current(credential))
      setStatus('ready')
    }).catch(() => { if (active) setStatus('error') })
    return () => { active = false; dispose?.() }
  }, [clientId, attempt])

  return <div className="login-google-signin" aria-busy={status === 'loading'}>
    <div className="login-google-host" ref={host} inert={disabled ? true : undefined} aria-disabled={disabled || undefined} />
    {status === 'loading' && <p className="login-google-note" role="status">Đang tải đăng nhập Google...</p>}
    {status === 'unavailable' && <><button className="login-google-unavailable" type="button" disabled>Đăng nhập bằng Google</button><p className="login-google-note">Đăng nhập Google hiện chưa sẵn sàng.</p></>}
    {status === 'error' && <div className="login-google-note" role="alert">Không thể tải đăng nhập Google. <button type="button" className="login-text-button" disabled={disabled} onClick={() => setAttempt(value => value + 1)}>Thử lại</button></div>}
  </div>
}
