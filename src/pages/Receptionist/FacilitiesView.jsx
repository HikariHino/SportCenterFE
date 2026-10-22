import { useState } from 'react'
import { CalendarDays, DoorOpen } from 'lucide-react'
import { RoomsView } from './RoomsView'
import { SessionsView } from './SessionsView'

export function FacilitiesView({ showNotice }) {
  const [section, setSection] = useState('rooms')

  return <>
    <section className="reception-card reception-facility-switcher">
      <div>
        <small>KHÔNG GIAN VẬN HÀNH</small>
        <strong>Quản lý phòng tập & buổi học</strong>
        <p>Tra cứu cơ sở vật chất, xem lịch sử dụng phòng và xử lý nghiệp vụ buổi học tại một nơi.</p>
      </div>
      <nav aria-label="Chọn nội dung quản lý">
        <button type="button" className={section === 'rooms' ? 'active' : ''} aria-pressed={section === 'rooms'} onClick={() => setSection('rooms')}><DoorOpen size={17} />Phòng tập & lịch tuần</button>
        <button type="button" className={section === 'sessions' ? 'active' : ''} aria-pressed={section === 'sessions'} onClick={() => setSection('sessions')}><CalendarDays size={17} />Nghiệp vụ buổi học</button>
      </nav>
    </section>

    {section === 'rooms'
      ? <RoomsView onOpenSessions={() => setSection('sessions')} />
      : <div className="reception-facility-sessions"><SessionsView showNotice={showNotice} /></div>}
  </>
}
