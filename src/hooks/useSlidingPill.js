import { useLayoutEffect, useRef } from 'react'
import { attachSlidingPill } from '../utils/slidingPill'

export default function useSlidingPill(activeKey, visible = true) {
  const container = useRef(null)
  const pill = useRef(null)
  const controller = useRef(null)

  useLayoutEffect(() => {
    const session = attachSlidingPill(container.current, pill.current)
    controller.current = session
    return () => { session.dispose(); controller.current = null }
  }, [])
  useLayoutEffect(() => { controller.current?.update() }, [activeKey, visible])
  return { container, pill }
}
