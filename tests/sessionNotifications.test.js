import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isSessionUpdateNotification, sessionNotificationId } from '../src/utils/sessionNotifications.js'
import { formatNotificationContent } from '../src/utils/notificationContent.js'

test('booking notifications display .NET UTC timestamps as short Vietnam times', () => {
  for (const timestamp of ['2026-11-25T11:00:00.0000000Z', '2026-11-25T11:00:00.0000000', '2026-11-25T11:00:00Z']) {
    const content = `Hội viên 7 đã đặt buổi 240 - Yoga, bắt đầu ${timestamp} (UTC).`
    assert.equal(formatNotificationContent(content), 'Hội viên 7 đã đặt buổi 240 - Yoga, bắt đầu 18:00 25/11/2026.')
  }
})

test('notification times keep the correct Vietnam date across midnight and offset timestamps', () => {
  assert.equal(formatNotificationContent('Bắt đầu 2026-11-25T20:15:30.1234567Z.'), 'Bắt đầu 03:15 26/11/2026.')
  assert.equal(formatNotificationContent('Bắt đầu 2026-11-25T18:00:00+07:00.'), 'Bắt đầu 18:00 25/11/2026.')
})

test('plain notification text and timestamps without a known timezone are left unchanged', () => {
  for (const content of ['', 'Đặt lịch thành công.', 'Bắt đầu 2026-11-25T11:00:00.', 'Ngày 2026-02-30T11:00:00Z (UTC).']) {
    assert.equal(formatNotificationContent(content), content)
  }
  assert.equal(formatNotificationContent(null), '')
})

test('server schedule notifications lead to the affected session without parsing a UTC date as local time', () => {
  const item = { title: 'Cập nhật lịch buổi học', content: 'Buổi #123 - Yoga đã được cập nhật lịch học sang 26/10/2026 11:30 (UTC). Vui lòng kiểm tra lại lịch của bạn.' }
  assert.equal(isSessionUpdateNotification(item), true)
  assert.equal(sessionNotificationId(item), '123')
  assert.equal(sessionNotificationId({ ...item, content: 'Nội dung khác' }), null)
  assert.equal(isSessionUpdateNotification({ ...item, title: item.title.normalize('NFD') }), true)
})

test('other notifications do not expose the schedule update shortcut', () => {
  for (const item of [null, {}, { title: 'Buổi học đã hủy', content: 'Buổi #123 - Yoga' }, { title: 'Đặt lịch thành công' }]) {
    assert.equal(isSessionUpdateNotification(item), false)
    assert.equal(sessionNotificationId(item), null)
  }
})
