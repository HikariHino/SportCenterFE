import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aiTrainingPlanDemoSteps, buildAiTrainingPlanDemo } from '../src/utils/aiTrainingPlanDemo.js'

test('AI training plan demo exposes the expected progress stages', () => {
  assert.deepEqual(aiTrainingPlanDemoSteps, [
    'Đang lấy mục tiêu của học viên',
    'Đang xác định thời gian giáo án',
    'Đang lấy bộ môn học viên đăng ký với Coach',
    'Đang hoàn thiện gợi ý bài tập',
  ])
})

test('AI training plan demo fills dates and uses up to three catalog exercises', () => {
  const catalog = Array.from({ length: 5 }, (_, index) => ({ id: index + 10, exerciseName: `Bài ${index + 1}` }))
  const demo = buildAiTrainingPlanDemo({ studentName: 'Nguyễn Văn A', exerciseCatalog: catalog, startDate: new Date(2026, 9, 29) })

  assert.deepEqual(demo.form, {
    planName: 'AI Demo · Thể lực tổng quát · Nguyễn Văn A',
    goal: 'GeneralFitness',
    startDate: '2026-10-29',
    endDate: '2026-11-26',
  })
  assert.deepEqual(demo.exercises.map(exercise => exercise.exerciseId), ['10', '11', '12'])
  assert.ok(demo.exercises.every(exercise => Number(exercise.sets) > 0 && Number(exercise.reps) > 0))
})

test('AI demo remains usable while the exercise catalog is unavailable', () => {
  const demo = buildAiTrainingPlanDemo({ studentName: '', exerciseCatalog: null, startDate: new Date(2026, 0, 1) })
  assert.equal(demo.form.planName, 'AI Demo · Thể lực tổng quát · Học viên')
  assert.deepEqual(demo.exercises, [])
})
