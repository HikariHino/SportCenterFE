import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isSessionUpdateNotification, sessionNotificationId } from '../src/utils/sessionNotifications.js'

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
