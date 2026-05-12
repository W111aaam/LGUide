import { useEffect, useRef, useState } from 'react'
import { LANGUAGES, useLanguage } from '../../context/LanguageContext'
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
  const { isEnglish, language, setLanguage } = useLanguage()
  const [focusMinutes, setFocusMinutes] = useState(() =>
    normalizeFocusMinutes(load(FOCUS_MINUTES_KEY, DEFAULT_FOCUS_MINUTES)),
  )
  const [focusInputValue, setFocusInputValue] = useState(() => String(focusMinutes))
  const [theme, setTheme] = useState(() => getStoredTheme())
  const [alarmSoundEnabled, setAlarmSoundEnabled] = useState(() => loadAlarmSoundEnabled())
  const [timerNotice, setTimerNotice] = useState('')
  const timerNoticeTimeoutRef = useRef(null)

  const text = isEnglish
    ? {
        title: 'Settings',
        timerNotice: 'The timer is currently running.',
        themeLabel: 'Site theme',
        themeDescription: 'Switch between light and dark themes',
        themeBadgeDark: 'Dark',
        themeBadgeLight: 'Light',
        themeLight: 'Light',
        themeDark: 'Dark',
        languageLabel: 'Language',
        languageDescription: 'Switch the interface between Chinese and English',
        languageBadge: 'English',
        chinese: 'Chinese',
        english: 'English',
        focusLabel: 'Pomodoro length',
        focusDescription: 'Single focus session duration in minutes',
        minutes: 'min',
        hours2: '2 h',
        focusInputAria: 'Pomodoro duration input',
        alarmLabel: 'Alarm sound',
        alarmDescription: 'Play reminder audio before class and when pomodoro sessions end; popup reminders stay on even if sound is off',
        alarmOn: 'On',
        alarmOff: 'Off',
        turnAlarmOff: 'Turn alarm sound off',
        turnAlarmOn: 'Turn alarm sound on',
        shortBreakLabel: 'Short break length',
        shortBreakDescription: 'Break after each pomodoro',
        longBreakLabel: 'Long break length',
        longBreakDescription: 'Long break after every four pomodoros',
        moreLabel: 'More settings',
        moreDescription: 'More preferences will be supported in a future version',
        planned: 'Planned',
      }
    : {
        title: '设置',
        timerNotice: '您正在计时',
        themeLabel: '网站主题',
        themeDescription: '浅色 / 深色主题切换',
        themeBadgeDark: '深色',
        themeBadgeLight: '浅色',
        themeLight: '浅色',
        themeDark: '深色',
        languageLabel: '界面语言',
        languageDescription: '在中文和英文界面之间切换',
        languageBadge: language === LANGUAGES.EN ? '英文' : '中文',
        chinese: '中文',
        english: 'English',
        focusLabel: '番茄钟时长',
        focusDescription: '单次专注时间（分钟）',
        minutes: '分钟',
        hours2: '2 小时',
        focusInputAria: '番茄钟时长输入',
        alarmLabel: '闹钟声音',
        alarmDescription: '课前十分钟和番茄钟结束时播放提醒音；关闭后仍保留网页弹框提醒',
        alarmOn: '已开启',
        alarmOff: '已关闭',
        turnAlarmOff: '关闭闹钟声音',
        turnAlarmOn: '开启闹钟声音',
        shortBreakLabel: '短休息时长',
        shortBreakDescription: '每个番茄钟后的短休息',
        longBreakLabel: '长休息时长',
        longBreakDescription: '每 4 个番茄钟后的长休息',
        moreLabel: '更多设置',
        moreDescription: '后续版本将支持更多偏好配置',
        planned: '待规划',
      }

  useEffect(() => () => {
    if (timerNoticeTimeoutRef.current) {
      window.clearTimeout(timerNoticeTimeoutRef.current)
    }
  }, [])

  function showTimerNotice() {
    setTimerNotice(text.timerNotice)
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

  function handleLanguageChange(nextLanguage) {
    setLanguage(nextLanguage)
  }

  const themeOptions = [
    { value: THEMES.LIGHT, label: text.themeLight, icon: '☀️' },
    { value: THEMES.DARK, label: text.themeDark, icon: '🌙' },
  ]

  const languageOptions = [
    { value: LANGUAGES.ZH, label: text.chinese },
    { value: LANGUAGES.EN, label: text.english },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">{text.title}</h1>

      <div className="bg-white border border-gray-200 rounded-xl px-5 dark:border-slate-800 dark:bg-slate-900/88">
        <SettingRow
          label={text.themeLabel}
          description={text.themeDescription}
          badge={theme === THEMES.DARK ? text.themeBadgeDark : text.themeBadgeLight}
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
          label={text.languageLabel}
          description={text.languageDescription}
          badge={text.languageBadge}
        >
          <div className="mt-3 inline-flex rounded-full border border-gray-200 bg-gray-100 p-1 dark:border-slate-700 dark:bg-slate-950">
            {languageOptions.map(option => {
              const isActive = language === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleLanguageChange(option.value)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-orange-300'
                      : 'text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                  aria-pressed={isActive}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </SettingRow>
        <SettingRow
          label={text.focusLabel}
          description={text.focusDescription}
          badge={`${focusMinutes} ${text.minutes}`}
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
                aria-label={text.focusInputAria}
              />
              <span className="text-xs text-gray-500 dark:text-slate-400">{text.minutes}</span>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
            <span>{MIN_FOCUS_MINUTES} {text.minutes}</span>
            <span>{text.hours2}</span>
          </div>
        </SettingRow>
        <SettingRow
          label={text.alarmLabel}
          description={text.alarmDescription}
          badge={alarmSoundEnabled ? text.alarmOn : text.alarmOff}
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
            {alarmSoundEnabled ? text.turnAlarmOff : text.turnAlarmOn}
          </button>
        </SettingRow>
        <SettingRow
          label={text.shortBreakLabel}
          description={text.shortBreakDescription}
          badge={`5 ${text.minutes}`}
        />
        <SettingRow
          label={text.longBreakLabel}
          description={text.longBreakDescription}
          badge={`15 ${text.minutes}`}
        />
        <SettingRow
          label={text.moreLabel}
          description={text.moreDescription}
          badge={text.planned}
        />
      </div>
    </div>
  )
}

export default Settings
