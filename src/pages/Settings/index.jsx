import { useEffect, useRef, useState } from 'react'
import { loadAlarmSoundEnabled, saveAlarmSoundEnabled } from '../../utils/alarm'
import { load, save } from '../../utils/storage'
import { getStoredTheme, saveTheme, THEMES } from '../../utils/theme'
import { isPomodoroSessionLocked } from '../../utils/pomodoroSession'

const FOCUS_MINUTES_KEY = 'pomodoroFocusMinutes'
const DEFAULT_FOCUS_MINUTES = 25
const MIN_FOCUS_MINUTES = 10
const MAX_FOCUS_MINUTES = 120

function normalizeFocusMinutes(value) {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_FOCUS_MINUTES
  }
  return Math.max(MIN_FOCUS_MINUTES, Math.min(MAX_FOCUS_MINUTES, parsed))
}

function SettingRow({ label, description, badge, children }) {
  return (
    <div className="py-4 border-b border-gray-100 last:border-0 dark:border-slate-800">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-slate-100">{label}</p>
          {description && (
            <p className="text-xs text-gray-400 mt-0.5 dark:text-slate-500">{description}</p>
          )}
        </div>
        {badge && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded whitespace-nowrap dark:bg-slate-800 dark:text-slate-400">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function Settings() {
  const [focusMinutes, setFocusMinutes] = useState(() =>
    normalizeFocusMinutes(load(FOCUS_MINUTES_KEY, DEFAULT_FOCUS_MINUTES)),
  )
  const [focusInputValue, setFocusInputValue] = useState(() => String(focusMinutes))
  const [theme, setTheme] = useState(() => getStoredTheme())
  const [alarmSoundEnabled, setAlarmSoundEnabled] = useState(() => loadAlarmSoundEnabled())
  const [timerNotice, setTimerNotice] = useState('')
  const timerNoticeTimeoutRef = useRef(null)

  useEffect(() => () => {
    if (timerNoticeTimeoutRef.current) {
      window.clearTimeout(timerNoticeTimeoutRef.current)
    }
  }, [])

  function showTimerNotice() {
    setTimerNotice('您正在计时')
    if (timerNoticeTimeoutRef.current) {
      window.clearTimeout(timerNoticeTimeoutRef.current)
    }
    timerNoticeTimeoutRef.current = window.setTimeout(() => setTimerNotice(''), 2400)
  }

  function commitFocusMinutes(rawValue) {
    if (isPomodoroSessionLocked()) {
      setFocusInputValue(String(focusMinutes))
      showTimerNotice()
      return
    }

    const next = normalizeFocusMinutes(rawValue)
    setFocusMinutes(next)
    setFocusInputValue(String(next))
    save(FOCUS_MINUTES_KEY, next)
  }

  function handleFocusInputBlur() {
    commitFocusMinutes(focusInputValue)
  }

  function handleFocusInputKeyDown(event) {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
      return
    }
    if (event.key === 'Escape') {
      setFocusInputValue(String(focusMinutes))
      event.currentTarget.blur()
    }
  }

  function handleThemeChange(nextTheme) {
    setTheme(saveTheme(nextTheme))
  }

  function handleAlarmSoundToggle() {
    setAlarmSoundEnabled(current => saveAlarmSoundEnabled(!current))
  }

  const themeOptions = [
    { value: THEMES.LIGHT, label: '浅色', icon: '☀️' },
    { value: THEMES.DARK, label: '深色', icon: '🌙' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">设置</h1>

      <div className="bg-white border border-gray-200 rounded-xl px-5 dark:border-slate-800 dark:bg-slate-900/88">
        <SettingRow
          label="网站主题"
          description="浅色 / 深色主题切换"
          badge={theme === THEMES.DARK ? '深色' : '浅色'}
        >
          <div className="mt-3 inline-flex rounded-full border border-gray-200 bg-gray-100 p-1 dark:border-slate-700 dark:bg-slate-950">
            {themeOptions.map(option => {
              const isActive = theme === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleThemeChange(option.value)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-orange-300'
                      : 'text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                  aria-pressed={isActive}
                >
                  <span aria-hidden="true">{option.icon}</span>
                  {option.label}
                </button>
              )
            })}
          </div>
        </SettingRow>
        <SettingRow
          label="番茄钟时长"
          description="单次专注时间（分钟）"
          badge={`${focusMinutes} 分钟`}
        >
          {timerNotice && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
              {timerNotice}
            </div>
          )}
          <div className="w-full mt-3 flex items-center gap-3">
            <input
              type="range"
              min={MIN_FOCUS_MINUTES}
              max={MAX_FOCUS_MINUTES}
              step="1"
              value={focusMinutes}
              onChange={e => commitFocusMinutes(e.target.value)}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-orange-100 accent-orange-500"
            />
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number"
                inputMode="numeric"
                min={MIN_FOCUS_MINUTES}
                max={MAX_FOCUS_MINUTES}
                value={focusInputValue}
                onChange={e => {
                  if (isPomodoroSessionLocked()) {
                    setFocusInputValue(String(focusMinutes))
                    showTimerNotice()
                    return
                  }
                  setFocusInputValue(e.target.value)
                }}
                onBlur={handleFocusInputBlur}
                onKeyDown={handleFocusInputKeyDown}
                className="w-16 text-xs text-right text-gray-700 bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-orange-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                aria-label="番茄钟时长输入"
              />
              <span className="text-xs text-gray-500 dark:text-slate-400">分钟</span>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
            <span>{MIN_FOCUS_MINUTES} 分钟</span>
            <span>2 小时</span>
          </div>
        </SettingRow>
        <SettingRow
          label="闹钟声音"
          description="课前十分钟和番茄钟结束时播放提醒音；关闭后仍保留网页弹框提醒"
          badge={alarmSoundEnabled ? '已开启' : '已关闭'}
        >
          <button
            type="button"
            onClick={handleAlarmSoundToggle}
            className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              alarmSoundEnabled
                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-400/15 dark:text-orange-200 dark:hover:bg-orange-400/25'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
            aria-pressed={alarmSoundEnabled}
          >
            <span aria-hidden="true">{alarmSoundEnabled ? '🔔' : '🔕'}</span>
            {alarmSoundEnabled ? '关闭闹钟声音' : '开启闹钟声音'}
          </button>
        </SettingRow>
        <SettingRow
          label="短休息时长"
          description="每个番茄钟后的短休息"
          badge="5 分钟"
        />
        <SettingRow
          label="长休息时长"
          description="每 4 个番茄钟后的长休息"
          badge="15 分钟"
        />
        <SettingRow
          label="更多设置"
          description="后续版本将支持更多偏好配置"
          badge="待规划"
        />
      </div>
    </div>
  )
}

export default Settings
