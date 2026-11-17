import { useEffect, useRef } from 'react'
import '../../style/CenterManager/ManagerFormError.css'

export default function ManagerFormError({ message }) {
  const feedback = useRef(null)
  useEffect(() => {
    if (!message) return
    feedback.current?.focus({ preventScroll: true })
    feedback.current?.scrollIntoView({ block: 'nearest' })
  }, [message])
  return message ? <p className="manager-form-error" ref={feedback} role="alert" tabIndex={-1}>{message}</p> : null
}
