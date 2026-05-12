import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PomodoroHeatmap from '../../components/PomodoroHeatmap'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getBeijingDateString, getBeijingDayOfWeek, getBeijingYear, getMillisecondsUntilNextBeijingMidnight } from '../../utils/date'
import { load } from '../../utils/storage'
import { fetchPomodoroHeatmap } from '../../utils/pomodoroApi'

function getCurrentTime() {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`
}

function parseTimeToMinutes(time = '00:00') {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

function StatCard({ title, value, hint }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function QuickLink({ to, label }) {
  return (
    <Link
      to={to}
      className="block bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-sm px-4 py-3 rounded-lg transition-colors text-center"
    >
      {label}
    </Link>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const { isEnglish } = useLanguage()
  const [todayStr, setTodayStr] = useState(() => getBeijingDateString())
  const currentTime = getCurrentTime()
  const currentBeijingYear = getBeijingYear()
  const assignments = load('assignments', [])
  const courses = load('courses', [])
  const pomodoroStats = load('pomodoroStats', null)
  const [todayFocus, setTodayFocus] = useState(() => ({
    count: pomodoroStats?.date === todayStr ? pomodoroStats.count : 0,
    minutes: (pomodoroStats?.date === todayStr ? pomodoroStats.count : 0) * 25,
  }))

  const todayDueCount = assignments.filter(a => a.dueDate === todayStr).length
  const pendingCount = assignments.filter(a => !a.done).length
  const todayTomato = todayFocus.count
  const todayFocusMinutes = todayFocus.minutes

  const todayIndex = getBeijingDayOfWeek()
  const currentMinutes = parseTimeToMinutes(currentTime)
  const todayCourses = courses
    .filter(c => c.dayOfWeek === todayIndex)
    .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime))
  const remainingCourses = todayCourses.filter(
    c => parseTimeToMinutes(c.endTime) > currentMinutes
  ).length
  const nextCourse = todayCourses.find(
    c => parseTimeToMinutes(c.startTime) > currentMinutes
  )

  const text = isEnglish
    ? {
        title: 'Home',
        todayAssignments: 'Today assignments',
        dueHint: `Due today ${todayDueCount}, pending ${pendingCount}`,
        todayCourses: 'Today classes',
        coursesUnit: 'classes',
        remainingCoursesHint: 'Remaining classes today',
        todayFocus: 'Today focus',
        minutes: 'min',
        todayTomatoHint: `Completed ${todayTomato} pomodoros today`,
        nextClass: 'Next class',
        location: 'Location',
        noCourseAdd: 'No classes today yet. Add your schedule to get started.',
        noCourseLater: 'No more classes left today. Use the remaining time well.',
        quickActions: 'Quick actions',
        assignments: 'Assignments',
        startFocus: 'Start focus',
        viewSchedule: 'View schedule',
        preferences: 'Preferences',
      }
    : {
        title: '首页',
        todayAssignments: '今日作业',
        dueHint: `今日到期 ${todayDueCount}，剩余 ${pendingCount}`,
        todayCourses: '今日课程',
        coursesUnit: '门',
        remainingCoursesHint: '今日剩余课程',
        todayFocus: '今日专注',
        minutes: '分钟',
        todayTomatoHint: `今日完成 ${todayTomato} 个番茄`,
        nextClass: '下一节课',
        location: '地点',
        noCourseAdd: '今天没有课程，快去课表中添加你的课程安排。',
        noCourseLater: '今天已经没有后续课程了，祝你接下来的时间高效。',
        quickActions: '快速入口',
        assignments: '作业管理',
        startFocus: '开始专注',
        viewSchedule: '查看课表',
        preferences: '偏好设置',
      }

  useEffect(() => {
    function syncBeijingDay() {
      const nextTodayStr = getBeijingDateString()
      setTodayStr(current => (current === nextTodayStr ? current : nextTodayStr))
    }

    let timeoutId = null

    function scheduleNextSync() {
      timeoutId = window.setTimeout(() => {
        syncBeijingDay()
        scheduleNextSync()
      }, getMillisecondsUntilNextBeijingMidnight())
    }

    scheduleNextSync()
    window.addEventListener('focus', syncBeijingDay)

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
      window.removeEventListener('focus', syncBeijingDay)
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    async function syncTodayFocus() {
      try {
        const heatmap = await fetchPomodoroHeatmap(currentBeijingYear)
        if (isCancelled) return
        const todayEntry = (heatmap.days || []).find(day => day.date === todayStr)
        setTodayFocus({
          count: Number(todayEntry?.completed_count || 0),
          minutes: Math.round(Number(todayEntry?.total_seconds || 0) / 60),
        })
      } catch {
        // keep local fallback stats when remote sync is temporarily unavailable
      }
    }

    if (user) {
      syncTodayFocus()
    } else {
      setTodayFocus({
        count: pomodoroStats?.date === todayStr ? pomodoroStats.count : 0,
        minutes: (pomodoroStats?.date === todayStr ? pomodoroStats.count : 0) * 25,
      })
    }

    return () => {
      isCancelled = true
    }
  }, [currentBeijingYear, pomodoroStats?.count, pomodoroStats?.date, todayStr, user])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">{text.title}</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title={text.todayAssignments}
          value={`${todayDueCount} / ${pendingCount}`}
          hint={text.dueHint}
        />
        <StatCard
          title={text.todayCourses}
          value={`${remainingCourses} ${text.coursesUnit}`}
          hint={text.remainingCoursesHint}
        />
        <StatCard
          title={text.todayFocus}
          value={`${todayFocusMinutes} ${text.minutes}`}
          hint={text.todayTomatoHint}
        />
      </div>

      <section className="bg-white border border-indigo-200 rounded-2xl p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-2">{text.nextClass}</h2>
        {nextCourse ? (
          <div>
            <p className="text-lg font-semibold text-gray-900">
              {nextCourse.courseName}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {nextCourse.startTime}–{nextCourse.endTime}
            </p>
            {nextCourse.location && (
              <p className="text-sm text-gray-500 mt-1">
                {text.location}: {nextCourse.location}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {todayCourses.length === 0
              ? text.noCourseAdd
              : text.noCourseLater}
          </p>
        )}
      </section>

      <PomodoroHeatmap />

      <div>
        <h2 className="text-base font-semibold text-gray-600 mb-3">{text.quickActions}</h2>
        <div className="grid grid-cols-4 gap-3">
          <QuickLink to="/assignments" label={text.assignments} />
          <QuickLink to="/pomodoro" label={text.startFocus} />
          <QuickLink to="/schedule" label={text.viewSchedule} />
          <QuickLink to="/settings" label={text.preferences} />
        </div>
      </div>
    </div>
  )
}

export default Dashboard
