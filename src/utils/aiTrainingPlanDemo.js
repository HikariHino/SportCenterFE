const toDateInput = date => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const exercisePresets = [
  { sets: '3', reps: '12', durationInMinutes: '15', notes: 'AI Demo: ưu tiên kỹ thuật đúng và nghỉ 60 giây giữa các hiệp.' },
  { sets: '3', reps: '10', durationInMinutes: '12', notes: 'AI Demo: điều chỉnh mức độ theo thể trạng thực tế của học viên.' },
  { sets: '2', reps: '15', durationInMinutes: '10', notes: 'AI Demo: kết thúc nhẹ, theo dõi nhịp thở và khả năng phục hồi.' },
]

export const aiTrainingPlanDemoSteps = [
  'Đang lấy mục tiêu của học viên',
  'Đang xác định thời gian giáo án',
  'Đang lấy bộ môn học viên đăng ký với Coach',
  'Đang hoàn thiện gợi ý bài tập',
]

export function buildAiTrainingPlanDemo({ studentName, exerciseCatalog, startDate = new Date() }) {
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + 28)
  const safeStudentName = String(studentName || 'Học viên').trim() || 'Học viên'
  const catalog = Array.isArray(exerciseCatalog) ? exerciseCatalog : []

  return {
    form: {
      planName: `AI Demo · Thể lực tổng quát · ${safeStudentName}`,
      goal: 'GeneralFitness',
      startDate: toDateInput(start),
      endDate: toDateInput(end),
    },
    exercises: catalog.slice(0, exercisePresets.length).map((exercise, index) => ({
      exerciseId: String(exercise.id),
      ...exercisePresets[index],
    })),
  }
}
