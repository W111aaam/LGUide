import { useEffect, useRef, useState } from 'react'
import JSZip from 'jszip'
import { getAlarmAudioSrc, loadAlarmSoundEnabled, triggerWebAlarm } from '../../utils/alarm'
import { getBeijingDateString } from '../../utils/date'
import { load, save } from '../../utils/storage'
import CourseForm, { DAY_NAMES } from './CourseForm'
import { parseIcsEvents } from './parseIcs'

const COURSES_KEY = 'courses'
const IMAGE_KEY = 'scheduleImage'
const COURSE_REMINDER_HISTORY_KEY = 'courseReminderHistory'

function getCourseReminderKey(course, todayStr) {
  return `${todayStr}|${course.id}|${course.startTime}`
}

function loadReminderHistory(todayStr) {
  const stored = load(COURSE_REMINDER_HISTORY_KEY, null)
  return stored?.date === todayStr && Array.isArray(stored.keys) ? stored.keys : []
}

function saveReminderHistory(todayStr, keys) {
  save(COURSE_REMINDER_HISTORY_KEY, { date: todayStr, keys })
}

function getCourseStartOffsetMs(course, now) {
  const [hours, minutes] = course.startTime.split(':').map(value => Number.parseInt(value, 10))
  const courseStartTime = new Date(now)
  courseStartTime.setHours(hours || 0, minutes || 0, 0, 0)
  return courseStartTime.getTime() - now.getTime()
}

// 将上传的图片文件压缩为 JPEG DataURL（最长边不超过 1200px，质量 0.75）
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = e => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const MAX = 1200
        let { width, height } = img
        if (width > MAX) {
          height = Math.round((height * MAX) / width)
          width = MAX
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// ---- 单条课程卡片 ----

function CourseCard({ course, onEdit, onDelete }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-800">{course.courseName}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {DAY_NAMES[course.dayOfWeek]}&nbsp;&nbsp;
            {course.startTime}–{course.endTime}
            {course.location && ` · ${course.location}`}
          </p>
          {course.teacher && (
            <p className="text-xs text-gray-400 mt-0.5">教师：{course.teacher}</p>
          )}
          {course.note && (
            <p className="text-xs text-gray-400 mt-0.5">备注：{course.note}</p>
          )}
        </div>
        <div className="flex gap-3 flex-shrink-0 mt-0.5">
          <button
            onClick={onEdit}
            className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            编辑
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-gray-300 hover:text-red-500 transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- 主页面 ----

function Schedule() {
  const [courses, setCourses] = useState(() => load(COURSES_KEY, []))
  const [scheduleImage, setScheduleImage] = useState(() => load(IMAGE_KEY, null))
  const [showForm, setShowForm] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null) // course | null
  const [now, setNow] = useState(() => new Date())
  const [alarmSoundEnabled, setAlarmSoundEnabled] = useState(() => loadAlarmSoundEnabled())
  const fileInputRef = useRef(null)
  const zipInputRef = useRef(null)
  const alarmAudioRef = useRef(null)
  const [importStatus, setImportStatus] = useState(null)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    function syncAlarmSetting() {
      setAlarmSoundEnabled(loadAlarmSoundEnabled())
    }

    window.addEventListener('focus', syncAlarmSetting)
    window.addEventListener('storage', syncAlarmSetting)
    return () => {
      window.removeEventListener('focus', syncAlarmSetting)
      window.removeEventListener('storage', syncAlarmSetting)
    }
  }, [])

  // 今日课程
  const todayIndex = now.getDay()
  const todayCourses = [...courses]
    .filter(c => c.dayOfWeek === todayIndex)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`
  const nextCourse = todayCourses.find(c => c.startTime > currentTime)

  useEffect(() => {
    const todayStr = getBeijingDateString(now)
    const existingKeys = new Set(loadReminderHistory(todayStr))
    const dueCourse = todayCourses.find(course => {
      const reminderKey = getCourseReminderKey(course, todayStr)
      const offsetMs = getCourseStartOffsetMs(course, now)
      return offsetMs > 0 && offsetMs <= 10 * 60 * 1000 && !existingKeys.has(reminderKey)
    })

    if (!dueCourse) {
      return
    }

    const reminderKey = getCourseReminderKey(dueCourse, todayStr)
    existingKeys.add(reminderKey)
    saveReminderHistory(todayStr, [...existingKeys])

    triggerWebAlarm(
      alarmAudioRef.current,
      alarmSoundEnabled,
      '课前提醒',
      `${dueCourse.courseName} 将在 10 分钟内开始${dueCourse.location ? `，地点：${dueCourse.location}` : ''}`,
    )
  }, [alarmSoundEnabled, now, todayCourses])

  // 全部课程（按星期 → 时间排序）
  const sortedCourses = [...courses].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    return a.startTime.localeCompare(b.startTime)
  })

  // ---- 图片处理 ----

  async function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const dataUrl = await compressImage(file)
      setScheduleImage(dataUrl)
      save(IMAGE_KEY, dataUrl)
    } catch {
      alert('图片处理失败，请重试')
    }
    e.target.value = '' // 允许重复选同一文件
  }

  function handleDeleteImage() {
    setScheduleImage(null)
    save(IMAGE_KEY, null)
  }

  // ---- ICS 导入 ----

  function mergeCourses(existing, imported) {
    const key = c => `${c.courseName}|${c.dayOfWeek}|${c.startTime}`
    const existingKeys = new Set(existing.map(key))
    const newOnes = imported.filter(c => !existingKeys.has(key(c)))
    return [...existing, ...newOnes]
  }

  function showImportStatus(text, isError) {
    setImportStatus({ text, isError })
    setTimeout(() => setImportStatus(null), 6000)
  }

  async function handleZipImport(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    try {
      const zip = await JSZip.loadAsync(file)
      const icsFiles = Object.values(zip.files).filter(
        f => !f.dir && f.name.toLowerCase().endsWith('.ics')
      )
      if (icsFiles.length === 0) {
        showImportStatus('压缩包中未找到 .ics 文件', true)
        return
      }
      const allImported = []
      for (const f of icsFiles) {
        const text = await f.async('text')
        allImported.push(...parseIcsEvents(text))
      }
      if (allImported.length === 0) {
        showImportStatus('未解析到任何课程事件，请检查 .ics 文件格式', true)
        return
      }
      const current = load(COURSES_KEY, [])
      const merged = mergeCourses(current, allImported)
      const addedCount = merged.length - current.length
      const skipped = allImported.length - addedCount
      setCourses(merged)
      save(COURSES_KEY, merged)
      showImportStatus(
        `导入完成：解析 ${allImported.length} 条事件，新增 ${addedCount} 门课程${skipped > 0 ? `，跳过重复 ${skipped} 条` : ''}`,
        false
      )
    } catch (err) {
      showImportStatus(`解析失败：${err.message}`, true)
    }
  }

  // ---- 课程增删改 ----

  function handleAddCourse(formData) {
    const newCourse = { id: crypto.randomUUID(), ...formData }
    setCourses(prev => {
      const next = [...prev, newCourse]
      save(COURSES_KEY, next)
      return next
    })
    setShowForm(false)
  }

  function handleEditCourse(formData) {
    setCourses(prev => {
      const next = prev.map(c =>
        c.id === editingCourse.id ? { id: c.id, ...formData } : c
      )
      save(COURSES_KEY, next)
      return next
    })
    setEditingCourse(null)
  }

  function handleDeleteCourse(id) {
    setCourses(prev => {
      const next = prev.filter(c => c.id !== id)
      save(COURSES_KEY, next)
      return next
    })
  }

  function handleStartEdit(course) {
    const { id, ...editable } = course
    setEditingCourse({ id, ...editable })
    setShowForm(false)
  }

  function handleCancelForm() {
    setShowForm(false)
    setEditingCourse(null)
  }

  return (
    <div className="space-y-8">
      <audio ref={alarmAudioRef} src={getAlarmAudioSrc()} preload="auto" className="hidden" />

      <h1 className="text-2xl font-bold text-gray-800">课表</h1>

      {/* ── 今日课程 ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-600 mb-3">
          今日课程 · {DAY_NAMES[todayIndex]}
        </h2>
        {todayCourses.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
            <p className="text-gray-400 text-sm">今天没有课</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayCourses.map(c => (
              <div
                key={c.id}
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4"
              >
                <span className="text-sm font-mono text-indigo-600 w-28 flex-shrink-0">
                  {c.startTime}–{c.endTime}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {c.courseName}
                  </p>
                  {c.location && (
                    <p className="text-xs text-gray-400">{c.location}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 下一节课 ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-600 mb-3">下一节课</h2>
        {nextCourse ? (
          <div className="bg-white border border-indigo-200 rounded-2xl p-5">
            <p className="text-base font-semibold text-gray-800">{nextCourse.courseName}</p>
            <p className="text-sm text-gray-500 mt-1">
              {nextCourse.startTime}–{nextCourse.endTime}
            </p>
            {nextCourse.location && (
              <p className="text-sm text-gray-500 mt-1">地点：{nextCourse.location}</p>
            )}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-gray-500 text-sm">
            {todayCourses.length === 0
              ? '今天没有课程，快去添加你的课表吧。'
              : '今天已经没有后续课程了，祝你剩余时间高效。'}
          </div>
        )}
      </section>

      {/* ── 课表截图 ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-600">课表截图</h2>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {scheduleImage ? '替换图片' : '上传截图'}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleZipImport}
        />

        {scheduleImage ? (
          <div className="space-y-2">
            <img
              src={scheduleImage}
              alt="课表截图"
              className="w-full rounded-xl border border-gray-200 object-contain max-h-[500px]"
            />
            <button
              onClick={handleDeleteImage}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              删除图片
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-indigo-300 transition-colors"
          >
            <p className="text-gray-500 text-sm font-medium">点击上传课表截图</p>
            <p className="text-gray-400 text-xs mt-1">支持 JPG / PNG 格式</p>
          </div>
        )}
      </section>

      {/* ── 课程列表 ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-600">
            全部课程
            {courses.length > 0 && (
              <span className="ml-1.5 text-gray-400 font-normal">
                · {courses.length}
              </span>
            )}
          </h2>
          {!showForm && !editingCourse && (
            <div className="flex gap-2">
              <button
                onClick={() => zipInputRef.current?.click()}
                className="text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-4 py-1.5 rounded-lg transition-colors"
              >
                导入 sis 系统下载的 ICS zip
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg transition-colors"
              >
                手动添加课程
              </button>
            </div>
          )}
        </div>

        {importStatus && (
          <div
            className={`text-sm px-4 py-3 rounded-xl mb-3 ${
              importStatus.isError
                ? 'bg-red-50 border border-red-200 text-red-600'
                : 'bg-green-50 border border-green-200 text-green-600'
            }`}
          >
            {importStatus.text}
          </div>
        )}

        {showForm && (
          <div className="mb-3">
            <CourseForm onSubmit={handleAddCourse} onCancel={handleCancelForm} />
          </div>
        )}

        {editingCourse && (
          <div className="mb-3">
            <CourseForm
              initial={editingCourse}
              onSubmit={handleEditCourse}
              onCancel={handleCancelForm}
            />
          </div>
        )}

        {sortedCourses.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
            <p className="text-gray-400 text-sm">暂无课程，点击右上角添加</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedCourses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                onEdit={() => handleStartEdit(course)}
                onDelete={() => handleDeleteCourse(course.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Schedule
