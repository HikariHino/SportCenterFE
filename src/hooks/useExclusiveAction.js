import { useRef } from 'react'

// Acquire before awaiting or setting React state so same-tick submissions cannot
// both start a write. The ref survives rerenders; every exit releases the lock.
export default function useExclusiveAction() {
  const locked = useRef(false)
  return action => async (...args) => {
    args[0]?.preventDefault?.()
    if (locked.current) return
    locked.current = true
    try { return await action(...args) }
    finally { locked.current = false }
  }
}
