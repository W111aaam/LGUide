import { useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'

export const DAY_NAMES_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
  const { isEnglish } = useLanguage()
  const [form, setForm] = useState(initial ?? EMPTY_FORM)

  const dayNames = isEnglish ? DAY_NAMES_EN : DAY_NAMES_ZH
  const text = isEnglish
    ? {
        courseName: 'Course name *',
        location: 'Location',
        teacher: 'Instructor',
        note: 'Note (optional)',
        save: 'Save changes',
        add: 'Add course',
        cancel: 'Cancel',
      }
    : {
        courseName: '课程名称 *',
        location: '上课地点',
        teacher: '授课教师',
        note: '备注（可选）',
        save: '保存修改',
        add: '确认添加',
        cancel: '取消',
      }

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
          placeholder={text.courseName}
          value={form.courseName}
          onChange={e => set('courseName', e.target.value)}
        />
        <select
          className={inputClass + ' text-gray-700'}
          value={form.dayOfWeek}
          onChange={e => set('dayOfWeek', Number(e.target.value))}
        >
          {dayNames.map((name, i) => (
            <option key={i} value={i}>{name}</option>
          ))}
        </select>
        <input
          className={inputClass}
          placeholder={text.location}
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
          placeholder={text.teacher}
          value={form.teacher}
          onChange={e => set('teacher', e.target.value)}
        />
        <input
          className={inputClass}
          placeholder={text.note}
          value={form.note}
          onChange={e => set('note', e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg transition-colors"
        >
          {initial ? text.save : text.add}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg transition-colors"
        >
          {text.cancel}
        </button>
      </div>
    </form>
  )
}

export default CourseForm
