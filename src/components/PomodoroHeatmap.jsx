import { useCallback, useEffect, useState } from 'react'
import {
  fetchPomodoroHeatmap,
  fetchPomodoroStats,
  getPomodoroUserId,
  touchPomodoroUser,
} from '../utils/pomodoroApi'

function buildYearDays(year) {
  const days = []
  const cursor = new Date(Date.UTC(year, 0, 1))
  while (cursor.getUTCFullYear() === year) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function getHeatLevel(minutes) {
  if (minutes <= 0) return 0
  if (minutes <= 25) return 1
  if (minutes <= 50) return 2
  if (minutes <= 100) return 3
  return 4
}

function formatDuration(seconds) {
  const totalMinutes = Math.round((seconds || 0) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `${minutes} 分钟`
  if (!minutes) return `${hours} 小时`
  return `${hours} 小时 ${minutes} 分钟`
}

function PomodoroHeatmap() {
  const [userId] = useState(() => getPomodoroUserId())
  const [days, setDays] = useState([])
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const year = new Date().getFullYear()

  const refreshHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      await touchPomodoroUser(userId)
      const [heatmap, remoteStats] = await Promise.all([
        fetchPomodoroHeatmap(userId, year),
        fetchPomodoroStats(userId),
      ])
      setDays(heatmap.days || [])
      setStats(remoteStats)
      setError('')
    } catch (err) {
      setError(err.message || '同步失败')
    } finally {
      setIsLoading(false)
    }
  }, [userId, year])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  const byDate = new Map(
    days.map(day => [day.date, {
      seconds: Number(day.total_seconds || 0),
      count: Number(day.completed_count || 0),
    }]),
  )
  const yearDays = buildYearDays(year)
  const leadingBlankDays = new Date(Date.UTC(year, 0, 1)).getUTCDay()
  const cells = [
    ...Array.from({ length: leadingBlankDays }, (_, index) => ({ id: `blank-${index}`, blank: true })),
    ...yearDays.map(date => {
      const entry = byDate.get(date) || { seconds: 0, count: 0 }
      const minutes = Math.round(entry.seconds / 60)
      return {
        id: date,
        date,
        minutes,
        count: entry.count,
        level: getHeatLevel(minutes),
      }
    }),
  ]
  const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const totalSeconds = stats?.totals?.total_seconds || 0
  const completedCount = stats?.totals?.completed_count || 0

  return (
    <section className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-[0_24px_70px_rgba(154,52,18,0.08)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-400">Tomato Heatmap</p>
          <h2 className="mt-2 text-xl font-bold text-gray-900">番茄投入热力图</h2>
        </div>
        <button
          type="button"
          onClick={refreshHistory}
          className="self-start rounded-full border border-orange-200 px-4 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50"
        >
          {isLoading ? '同步中...' : '刷新'}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-orange-50 px-4 py-3">
          <p className="text-xs text-orange-500">累计专注</p>
          <p className="mt-1 text-lg font-bold text-orange-950">{formatDuration(totalSeconds)}</p>
        </div>
        <div className="rounded-2xl bg-red-50 px-4 py-3">
          <p className="text-xs text-red-500">完成番茄</p>
          <p className="mt-1 text-lg font-bold text-red-950">{completedCount} 个</p>
        </div>
        <div className="rounded-2xl bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-600">当前年份</p>
          <p className="mt-1 text-lg font-bold text-amber-950">{year}</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          暂时连不上 Cloudflare D1，页面会继续使用本地番茄计数：{error}
        </div>
      )}

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="min-w-[760px]">
          <div className="mb-2 grid grid-cols-12 text-xs font-semibold text-gray-400">
            {monthLabels.map(label => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div
            className="grid grid-flow-col grid-rows-7 gap-[5px]"
            style={{ gridAutoColumns: '12px' }}
            aria-label={`${year} 番茄钟热力图`}
          >
            {cells.map(cell => (
              cell.blank ? (
                <span key={cell.id} className="h-3 w-3" aria-hidden="true" />
              ) : (
                <span
                  key={cell.id}
                  title={`${cell.date}: ${cell.minutes} 分钟，${cell.count} 个番茄`}
                  className={[
                    'h-3 w-3 rounded-[4px] border transition-transform hover:scale-125',
                    cell.level === 0 && 'border-orange-100 bg-orange-50',
                    cell.level === 1 && 'border-orange-200 bg-orange-200',
                    cell.level === 2 && 'border-orange-300 bg-orange-400',
                    cell.level === 3 && 'border-orange-500 bg-orange-600',
                    cell.level === 4 && 'border-red-700 bg-red-700',
                  ].filter(Boolean).join(' ')}
                />
              )
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 text-xs text-gray-400">
            <span>少</span>
            {[0, 1, 2, 3, 4].map(level => (
              <span
                key={level}
                className={[
                  'h-3 w-3 rounded-[4px] border',
                  level === 0 && 'border-orange-100 bg-orange-50',
                  level === 1 && 'border-orange-200 bg-orange-200',
                  level === 2 && 'border-orange-300 bg-orange-400',
                  level === 3 && 'border-orange-500 bg-orange-600',
                  level === 4 && 'border-red-700 bg-red-700',
                ].filter(Boolean).join(' ')}
              />
            ))}
            <span>多</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default PomodoroHeatmap
