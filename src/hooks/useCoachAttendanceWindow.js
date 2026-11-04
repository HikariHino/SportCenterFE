import { useEffect, useState } from 'react'
import { getCoachAttendanceAvailability } from '../utils/coachAttendance.js'

export default function useCoachAttendanceWindow(session, active = true) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active || !session?.id) return
    const tick = () => setNow(Date.now())
    tick()
    const timer = window.setInterval(tick, 1000)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [active, session?.id])
  return getCoachAttendanceAvailability(session, now)
}
