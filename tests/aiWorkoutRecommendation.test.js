import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyExercisesPerSession, buildWorkoutGoalContext, buildWorkoutRecommendationPayload, extractWorkoutRecommendation, mapWorkoutRecommendationToPlanExercises } from '../src/utils/aiWorkoutRecommendation.js'

test('AI workout recommendation payload matches the backend contract', () => {
  assert.deepEqual(buildWorkoutRecommendationPayload({
    memberId: '4',
    goal: ' Tăng sức bền ',
    level: 'Intermediate',
    daysPerWeek: '4',
  }), {
    memberId: 4,
    goal: 'Tăng sức bền',
    level: 'Intermediate',
    daysPerWeek: 4,
  })
})

test('AI workout recommendation payload rejects invalid data before calling the API', () => {
  assert.throws(() => buildWorkoutRecommendationPayload({ memberId: 0, goal: 'Tăng cơ', level: 'Beginner', daysPerWeek: 3 }), /học viên/)
  assert.throws(() => buildWorkoutRecommendationPayload({ memberId: 4, goal: '', level: 'Beginner', daysPerWeek: 3 }), /Mục tiêu/)
  assert.throws(() => buildWorkoutRecommendationPayload({ memberId: 4, goal: 'Tăng cơ', level: 'Unknown', daysPerWeek: 3 }), /Trình độ/)
  assert.throws(() => buildWorkoutRecommendationPayload({ memberId: 4, goal: 'Tăng cơ', level: 'Beginner', daysPerWeek: 8 }), /1 đến 7/)
})

test('AI workout recommendation is normalized from the new structured API envelope', () => {
  assert.deepEqual(extractWorkoutRecommendation({ success: true, data: {
    goal: 'Tăng sức bền', level: 'Beginner', daysPerWeek: 3,
    sessions: [{ day: 1, title: 'Toàn thân', durationMinutes: 60, exercises: [{ exerciseName: 'Squat', sets: 3, reps: 12, restSeconds: 60, note: 'Giữ lưng thẳng' }] }],
    warnings: ['Dừng lại nếu cảm thấy đau.'],
  } }), {
    goal: 'Tăng sức bền', level: 'Beginner', daysPerWeek: 3,
    sessions: [{ day: 1, title: 'Toàn thân', durationMinutes: 60, exercises: [{ exerciseName: 'Squat', sets: 3, reps: 12, restSeconds: 60, note: 'Giữ lưng thẳng' }] }],
    warnings: ['Dừng lại nếu cảm thấy đau.'],
  })
})

test('AI workout recommendation rejects the retired text response and empty sessions', () => {
  assert.throws(() => extractWorkoutRecommendation({ success: true, data: { answer: 'Lịch tập 3 buổi.' } }), /đúng định dạng/)
  assert.throws(() => extractWorkoutRecommendation({ success: true, data: { sessions: [] } }), /buổi tập nào/)
})

test('requested exercise count limits every AI session without inventing missing exercises', () => {
  const recommendation = {
    sessions: [
      { day: 1, exercises: [{ exerciseName: 'A' }, { exerciseName: 'B' }, { exerciseName: 'C' }] },
      { day: 2, exercises: [{ exerciseName: 'D' }] },
    ],
    warnings: [],
  }
  const result = applyExercisesPerSession(recommendation, 2)

  assert.equal(result.exercisesPerSession, 2)
  assert.deepEqual(result.sessions.map(session => session.exercises.map(item => item.exerciseName)), [['A', 'B'], ['D']])
  assert.match(result.warnings[0], /buổi 2/)
  assert.throws(() => applyExercisesPerSession(recommendation, 0), /1 đến 10/)
  assert.throws(() => applyExercisesPerSession(recommendation, 11), /1 đến 10/)
})

test('exercise count and available catalog names are included in the supported AI goal field', () => {
  const context = buildWorkoutGoalContext({
    goal: 'Tăng cơ',
    exercisesPerSession: 5,
    exerciseCatalog: [
      { exerciseName: 'Squat (Gánh tạ đùi)' },
      { exerciseName: 'Bench Press (Đẩy ngực)' },
      { exerciseName: 'Plank (Giữ cơ bụng)' },
    ],
  })

  assert.equal(context, 'Tăng cơ. Mỗi buổi phải có đúng 5 bài tập. Chỉ dùng tên bài trong kho: Squat, Bench Press, Plank')
  assert.ok(context.length <= 200)
  assert.throws(() => buildWorkoutGoalContext({ goal: 'Tăng cơ', exercisesPerSession: 0 }), /1 đến 10/)
})

test('Coach workout context includes the sport of the selected student registration', () => {
  const context = buildWorkoutGoalContext({
    goal: 'Tăng sức bền',
    sportName: 'Yoga',
    exercisesPerSession: 4,
    exerciseCatalog: [{ exerciseName: 'Plank' }],
  })

  assert.equal(context, 'Tăng sức bền. Bộ môn: Yoga. Mỗi buổi phải có đúng 4 bài tập. Chỉ dùng tên bài trong kho: Plank')
  assert.ok(context.length <= 200)
})

test('AI exercises are added to the training plan using matching catalog IDs', () => {
  const recommendation = {
    sessions: [
      { day: 1, title: 'Toàn thân', exercises: [
        { exerciseName: 'Squat', sets: 3, reps: 12, restSeconds: 60, note: 'Giữ lưng thẳng' },
        { exerciseName: 'Plank (Giữ cơ bụng)', sets: 3, reps: 10, restSeconds: 30, note: '' },
      ] },
    ],
  }
  const catalog = [
    { id: 11, exerciseName: 'Squat (Gánh tạ đùi)' },
    { id: 12, exerciseName: 'Plank (Giữ cơ bụng)' },
  ]

  assert.deepEqual(mapWorkoutRecommendationToPlanExercises(recommendation, catalog), {
    exercises: [
      { exerciseId: '11', sets: '3', reps: '12', durationInMinutes: '', notes: 'Buổi 1: Toàn thân · Nghỉ 60 giây · Giữ lưng thẳng' },
      { exerciseId: '12', sets: '3', reps: '10', durationInMinutes: '', notes: 'Buổi 1: Toàn thân · Nghỉ 30 giây' },
    ],
    unmatchedNames: [],
  })
})

test('generic AI session titles are not repeated in exercise notes', () => {
  const recommendation = { sessions: [{
    day: 1,
    title: 'Buổi 1',
    exercises: [{ exerciseName: 'Squat', sets: 3, reps: 12, restSeconds: 60, note: 'Thực hiện đúng kỹ thuật.' }],
  }] }

  const result = mapWorkoutRecommendationToPlanExercises(recommendation, [{ id: 11, exerciseName: 'Squat' }])
  assert.equal(result.exercises[0].notes, 'Buổi 1 · Nghỉ 60 giây · Thực hiện đúng kỹ thuật.')
  assert.doesNotMatch(result.exercises[0].notes, /Buổi 1: Buổi 1/)
})

test('AI exercises outside the catalog are reported and never assigned a fake ID', () => {
  const recommendation = { sessions: [{ day: 1, exercises: [
    { exerciseName: 'Burpee', sets: 3, reps: 10 },
    { exerciseName: 'Burpee', sets: 4, reps: 8 },
  ] }] }

  assert.deepEqual(mapWorkoutRecommendationToPlanExercises(recommendation, [{ id: 1, exerciseName: 'Squat' }]), {
    exercises: [],
    unmatchedNames: ['Burpee'],
  })
})
