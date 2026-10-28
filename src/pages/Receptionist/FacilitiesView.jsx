import { useState } from 'react'
import { CalendarDays, DoorOpen } from 'lucide-react'
import { RoomsView } from './RoomsView'
import { SessionsView } from './SessionsView'

export function FacilitiesView({ showNotice, selectedSession, onSelectSession }) {
  const [section, setSection] = useState(() => selectedSession?.id ? 'sessions' : 'rooms')

  const openSessions = session => {
    if (session?.id) onSelectSession?.(session)
    setSection('sessions')
  }

  return <>
    <section className="reception-card reception-facility-switcher">
      <div>
        <small>CHỌN NỘI DUNG</small>
        <strong>{section === 'rooms' ? 'Phòng tập và lịch sử dụng' : 'Buổi học và hội viên'}</strong>
      </div>
      <nav aria-label="Chọn nội dung quản lý">
        <button type="button" className={section === 'rooms' ? 'active' : ''} aria-pressed={section === 'rooms'} onClick={() => setSection('rooms')}><DoorOpen size={17} />Phòng tập</button>
        <button type="button" className={section === 'sessions' ? 'active' : ''} aria-pressed={section === 'sessions'} onClick={() => setSection('sessions')}><CalendarDays size={17} />Buổi học</button>
      </nav>
    </section>

    {section === 'rooms'
      ? <RoomsView onOpenSessions={openSessions} onSelectSession={onSelectSession} />
      : <div className="reception-facility-sessions"><SessionsView showNotice={showNotice} selectedSession={selectedSession} onSelectSession={onSelectSession} /></div>}
  </>
}
