import { useCallback, useLayoutEffect, useRef } from 'react'
import { playProfileMorph } from '../utils/profileMorph'

export default function useProfileMorph(mode, active = true) {
  const panel = useRef(null)
  const pendingHeight = useRef(null)
  const cancel = useRef(() => {})
  const transition = useCallback(update => {
    // Capture the currently visible height before React switches edit modes,
    // including an intermediate height when the previous morph is interrupted.
    pendingHeight.current = panel.current?.getBoundingClientRect().height ?? null
    cancel.current()
    update()
  }, [])

  useLayoutEffect(() => {
    const fromHeight = pendingHeight.current
    pendingHeight.current = null
    if (!active || fromHeight === null) return
    cancel.current = playProfileMorph(panel.current, fromHeight)
    return () => cancel.current()
  }, [mode, active])

  return { panel, transition }
}
