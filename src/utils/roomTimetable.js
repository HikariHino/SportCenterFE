import { getRoomForClass } from './memberClasses.js'

const normalizedName = value => String(value || '').trim().toLocaleLowerCase('vi-VN')

export function getSessionRoom(session, sportClass, rooms) {
  let assignedRoom
  // An explicit session assignment always takes precedence over the class default.
  if (session.roomId != null && session.roomId !== '') {
    assignedRoom = { id: session.roomId, name: session.roomName }
  } else if (session.roomName?.trim()) {
    assignedRoom = rooms.find(room => normalizedName(room.name) === normalizedName(session.roomName)) || { name: session.roomName }
  } else if (sportClass.roomId != null && sportClass.roomId !== '') {
    assignedRoom = { id: sportClass.roomId, name: sportClass.roomName }
  } else {
    assignedRoom = getRoomForClass(sportClass, rooms)
  }
  return assignedRoom || null
}

export function roomSessionForTimetable(session, sportClass, rooms, selectedRoom) {
  const assignedRoom = getSessionRoom(session, sportClass, rooms)
  if (!assignedRoom) return null
  const matches = assignedRoom.id != null
    ? String(assignedRoom.id) === String(selectedRoom.id)
    : normalizedName(assignedRoom.name) === normalizedName(selectedRoom.name)
  if (!matches) return null

  const inheritsCoach = session.coachId == null || String(session.coachId) === String(sportClass.coachId)
  return {
    ...session,
    classId: sportClass.id,
    classStartDate: sportClass.startDate,
    classEndDate: sportClass.endDate,
    coachId: session.coachId ?? sportClass.coachId,
    className: session.className || sportClass.className,
    sportName: session.sportName || sportClass.sportName,
    coachName: session.coachName || (inheritsCoach ? sportClass.coachName : undefined),
    roomId: selectedRoom.id,
    roomName: selectedRoom.name,
    status: session.status || session.Status || 'Scheduled',
  }
}
