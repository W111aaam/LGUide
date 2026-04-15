import { useState } from 'react'

export const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const EMPTY_FORM = {
  courseName: '',
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '09:40',
  location: '',
  teacher: '',
  note: '',
}

// initial 传入时为编辑模式，不传为新增模式
function CourseForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.courseName.trim()) return
    onSubmit(form)
  }

  const inputClass =
    'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <input
          className={`${inputClass} col-span-2`}
          placeholder="课程名称 *"
          value={form.courseName}
          onChange={e => set('courseName', e.target.value)}
        />
        <select
          className={inputClass + ' text-gray-700'}
          value={form.dayOfWeek}
          onChange={e => set('dayOfWeek', Number(e.target.value))}
        >
          {DAY_NAMES.map((name, i) => (
            <option key={i} value={i}>{name}</option>
          ))}
        </select>
        <input
          className={inputClass}
          placeholder="上课地点"
          value={form.location}
          onChange={e => set('location', e.target.value)}
        />
        <input
          type="time"
          className={inputClass + ' text-gray-700'}
          value={form.startTime}
          onChange={e => set('startTime', e.target.value)}
        />
        <input
          type="time"
          className={inputClass + ' text-gray-700'}
          value={form.endTime}
          onChange={e => set('endTime', e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="授课教师"
          value={form.teacher}
          onChange={e => set('teacher', e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="备注（可选）"
          value={form.note}
          onChange={e => set('note', e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg transition-colors"
        >
          {initial ? '保存修改' : '确认添加'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg transition-colors"
        >
          取消
        </button>
      </div>
    </form>
  )
}

export default CourseForm
