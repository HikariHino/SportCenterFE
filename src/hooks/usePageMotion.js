import { useEffect, useRef } from 'react'
import { observePageReveals, playPageTransition } from '../utils/pageMotion'

export default function usePageMotion(viewKey, revealSelector) {
  const content = useRef(null)
  useEffect(() => playPageTransition(content.current), [viewKey])
  useEffect(() => observePageReveals(content.current, revealSelector), [revealSelector])
  return content
}
