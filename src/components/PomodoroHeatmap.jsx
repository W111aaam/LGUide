import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getBeijingDateString, getBeijingYear } from '../utils/date'
import {
  fetchPomodoroHeatmap,
  fetchPomodoroStats,
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

const TOOLTIP_SIZE = {
  width: 132,
  height: 82,
  gap: 10,
  padding: 8,
}

function PomodoroHeatmap() {
  const { user } = useAuth()
  const sectionRef = useRef(null)
  const [days, setDays] = useState([])
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [tooltip, setTooltip] = useState(null)
  const year = getBeijingYear()
  const todayDate = getBeijingDateString()

  function showTooltip(cell, target) {
    const section = sectionRef.current
    if (!section || !target) return

    const cellRect = target.getBoundingClientRect()
    const sectionRect = section.getBoundingClientRect()
    const { width, height, gap, padding } = TOOLTIP_SIZE

    let x = cellRect.left - sectionRect.left + cellRect.width / 2 - width / 2
    let y = cellRect.top - sectionRect.top - height - gap
    let placement = 'top'

    const maxX = Math.max(padding, sectionRect.width - width - padding)
    x = Math.min(Math.max(x, padding), maxX)

    if (y < padding) {
      y = cellRect.bottom - sectionRect.top + gap
      placement = 'bottom'
    }

    setTooltip({
      date: cell.date,
      minutes: cell.minutes,
      count: cell.count,
      x,
      y,
      placement,
    })
  }

  const refreshHistory = useCallback(async () => {
    if (!user) {
      setDays([])
      setStats(null)
      setError('')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const [heatmap, remoteStats] = await Promise.all([
        fetchPomodoroHeatmap(year),
        fetchPomodoroStats(),
      ])
      setDays(heatmap.days || [])
      setStats(remoteStats)
      setError('')
    } catch (err) {
      setError(err.message || '同步失败')
    } finally {
      setIsLoading(false)
    }
  }, [user, year])

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
        isToday: date === todayDate,
      }
    }),
  ]
  const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const totalSeconds = stats?.totals?.total_seconds || 0
  const completedCount = stats?.totals?.completed_count || 0

  return (
    <section
      ref={sectionRef}
      className="relative rounded-[2rem] border border-orange-100 bg-white p-5 shadow-[0_24px_70px_rgba(154,52,18,0.08)] dark:border-orange-500/20 dark:bg-slate-900/88 dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-400">Tomato Heatmap</p>
          <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-slate-100">番茄投入热力图</h2>
        </div>
        <button
          type="button"
          onClick={refreshHistory}
          className="self-start rounded-full border border-orange-200 px-4 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50 dark:border-orange-400/30 dark:text-orange-300 dark:hover:bg-orange-400/10"
        >
          {isLoading ? '同步中...' : '刷新'}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-orange-50 px-4 py-3 dark:bg-orange-400/10">
          <p className="text-xs text-orange-500 dark:text-orange-300">累计专注</p>
          <p className="mt-1 text-lg font-bold text-orange-950 dark:text-orange-50">{formatDuration(totalSeconds)}</p>
        </div>
        <div className="rounded-2xl bg-red-50 px-4 py-3 dark:bg-red-400/10">
          <p className="text-xs text-red-500 dark:text-red-300">完成番茄</p>
          <p className="mt-1 text-lg font-bold text-red-950 dark:text-red-50">{completedCount} 个</p>
        </div>
        <div className="rounded-2xl bg-amber-50 px-4 py-3 dark:bg-amber-400/10">
          <p className="text-xs text-amber-600 dark:text-amber-300">当前年份</p>
          <p className="mt-1 text-lg font-bold text-amber-950 dark:text-amber-50">{year}</p>
        </div>
      </div>

      {!user && (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
          登录后可查看并同步云端番茄热力图。
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
          暂时连不上 Cloudflare D1，页面会继续使用本地番茄计数：{error}
        </div>
      )}

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="min-w-[760px]">
          <div className="mb-2 grid grid-cols-12 text-xs font-semibold text-gray-400 dark:text-slate-500">
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
                  aria-label={`${cell.date}，${cell.minutes} 分钟，${cell.count} 个番茄`}
                  tabIndex={0}
                  onMouseEnter={event => showTooltip(cell, event.currentTarget)}
                  onMouseLeave={() => setTooltip(null)}
                  onFocus={event => showTooltip(cell, event.currentTarget)}
                  onBlur={() => setTooltip(null)}
                  className={[
                    'h-3 w-3 rounded-[4px] border transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-orange-300',
                    cell.level === 0 && 'border-orange-100 bg-orange-50',
                    cell.level === 1 && 'border-orange-200 bg-orange-200',
                    cell.level === 2 && 'border-orange-300 bg-orange-400',
                    cell.level === 3 && 'border-orange-500 bg-orange-600',
                    cell.level === 4 && 'border-red-700 bg-red-700',
                    cell.isToday && 'border-violet-600 ring-2 ring-violet-400/80 ring-offset-1 ring-offset-white shadow-[0_0_0_1px_rgba(129,140,248,0.35)] dark:ring-violet-300/85 dark:ring-offset-slate-900 dark:shadow-[0_0_0_1px_rgba(196,181,253,0.45)]',
                  ].filter(Boolean).join(' ')}
                />
              )
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 text-xs text-gray-400 dark:text-slate-500">
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

      {tooltip && (
        <div
          className="pointer-events-none absolute z-30 rounded-lg border border-black bg-white px-3 py-2 text-xs leading-relaxed text-black shadow-md dark:border-slate-500 dark:bg-slate-950 dark:text-slate-200 dark:shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
          style={{
            width: `${TOOLTIP_SIZE.width}px`,
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
          }}
          role="tooltip"
        >
          <div className="font-semibold text-black dark:text-white">{tooltip.date}</div>
          <div className="text-black dark:text-slate-300">{tooltip.minutes} 分钟</div>
          <div className="text-black dark:text-slate-300">{tooltip.count} 个番茄</div>
          <span
            className={[
              'absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-black bg-white dark:border-slate-500 dark:bg-slate-950',
              tooltip.placement === 'top'
                ? '-bottom-1 border-b border-r'
                : '-top-1 border-l border-t',
            ].join(' ')}
            aria-hidden="true"
          />
        </div>
      )}
    </section>
  )
}

export default PomodoroHeatmap
