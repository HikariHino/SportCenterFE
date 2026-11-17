import { useLayoutEffect, useRef } from 'react'

export default function RoomDialog({ label, busy, onClose, children }) {
  const dialog = useRef(null)
  const opener = useRef(document.activeElement)
  const latest = useRef({ busy, onClose })
  latest.current = { busy, onClose }
  useLayoutEffect(() => {
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!element.contains(document.activeElement)) element.focus()
    const keyboard = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (!latest.current.busy) latest.current.onClose()
      } else if (event.key === 'Tab') {
        const controls = [...element.querySelectorAll('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
        const first = controls[0], last = controls.at(-1)
        if (!first) { event.preventDefault(); element.focus() }
        else if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement) || document.activeElement === element)) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      document.removeEventListener('keydown', keyboard)
      document.body.style.overflow = previousOverflow
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true })
    }
  }, [])
  return <div className="room-modal-overlay" onClick={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <div className="room-modal" ref={dialog} role="dialog" aria-modal="true" aria-label={label} aria-busy={busy} tabIndex={-1}>
      {children}
    </div>
  </div>
}
