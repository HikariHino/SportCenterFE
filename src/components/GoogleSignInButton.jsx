import { useEffect, useRef, useState } from 'react'
import { loadGoogleIdentity, mountGoogleSignInButton } from '../services/googleIdentityService'
import { getGoogleClientId } from '../utils/googleAuth'
import { useTheme } from '../contexts/ThemeContext'
import '../style/GoogleSignInButton.css'

export default function GoogleSignInButton({ disabled, onCredential, intent = 'signin' }) {
  const { theme } = useTheme()
  const action = intent === 'signup' ? 'Đăng ký' : 'Đăng nhập'
  const buttonText = intent === 'signup' ? 'signup_with' : 'signin_with'
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
      dispose = mountGoogleSignInButton(sdk, host.current, clientId, credential => callback.current(credential), theme, buttonText)
      setStatus('ready')
    }).catch(() => { if (active) setStatus('error') })
    return () => { active = false; dispose?.() }
  }, [clientId, attempt, theme, buttonText])

  return <div className="login-google-signin" aria-busy={status === 'loading'}>
    <div className="login-google-host" ref={host} inert={disabled ? true : undefined} aria-disabled={disabled || undefined} />
    {status === 'loading' && <p className="login-google-note" role="status">Đang tải {action.toLowerCase()} Google...</p>}
    {status === 'unavailable' && <><button className="login-google-unavailable" type="button" disabled>{action} bằng Google</button><p className="login-google-note">{action} Google hiện chưa sẵn sàng.</p></>}
    {status === 'error' && <div className="login-google-note" role="alert">Không thể tải {action.toLowerCase()} Google. <button type="button" className="login-text-button" disabled={disabled} onClick={() => setAttempt(value => value + 1)}>Thử lại</button></div>}
  </div>
}
