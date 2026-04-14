import { useState, useEffect } from 'react'
import { load, save } from '../../utils/storage'

// 时长常量（后续可由设置页写入 localStorage 后读取）
const FOCUS_MINUTES = 25
const BREAK_MINUTES = 5

const STATS_KEY = 'pomodoroStats'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

function loadTodayCount() {
  const stored = load(STATS_KEY, null)
  return stored?.date === getTodayStr() ? stored.count : 0
}

// ---- 主组件 ----

function Pomodoro() {
  const [mode, setMode] = useState('focus')       // 'focus' | 'break'
  const [status, setStatus] = useState('idle')    // 'idle' | 'running' | 'paused'
  const [timeLeft, setTimeLeft] = useState(FOCUS_MINUTES * 60)
  const [todayCount, setTodayCount] = useState(() => loadTodayCount())
  const [notification, setNotification] = useState(null)

  // Effect 1：status 为 running 时每秒递减
  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [status])

  // Effect 2：timeLeft 到 0 时处理倒计时结束逻辑
  useEffect(() => {
    if (status !== 'running' || timeLeft !== 0) return

    setStatus('idle')

    if (mode === 'focus') {
      setTodayCount(prev => {
        const next = prev + 1
        save(STATS_KEY, { date: getTodayStr(), count: next })
        return next
      })
      setMode('break')
      setTimeLeft(BREAK_MINUTES * 60)
      showNotification('专注结束！去休息 5 分钟吧')
    } else {
      setMode('focus')
      setTimeLeft(FOCUS_MINUTES * 60)
      showNotification('休息结束！开始下一个番茄')
    }
  }, [timeLeft, status, mode])

  function showNotification(msg) {
    setNotification(msg)
    setTimeout(() => setNotification(null), 4000)
  }

  function handleStart() {
    setStatus('running')
  }

  function handlePause() {
    setStatus('paused')
  }

  function handleReset() {
    setStatus('idle')
    setTimeLeft(mode === 'focus' ? FOCUS_MINUTES * 60 : BREAK_MINUTES * 60)
  }

  function handleSwitchMode(newMode) {
    if (newMode === mode) return
    setMode(newMode)
    setStatus('idle')
    setTimeLeft(newMode === 'focus' ? FOCUS_MINUTES * 60 : BREAK_MINUTES * 60)
  }

  const isFocus = mode === 'focus'
  const accentColor = isFocus ? 'indigo' : 'green'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">番茄钟</h1>

      {/* 倒计时结束通知 */}
      {notification && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm px-4 py-3 rounded-xl">
          {notification}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl py-12 px-6 flex flex-col items-center gap-8">

        {/* 模式切换 */}
        <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => handleSwitchMode('focus')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isFocus
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            专注模式
          </button>
          <button
            onClick={() => handleSwitchMode('break')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              !isFocus
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            休息模式
          </button>
        </div>

        {/* 倒计时圆环 */}
        <div
          className={`w-44 h-44 rounded-full border-8 flex items-center justify-center ${
            isFocus ? 'border-indigo-100' : 'border-green-100'
          }`}
        >
          <span
            className={`text-5xl font-bold font-mono ${
              isFocus ? 'text-indigo-600' : 'text-green-600'
            }`}
          >
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* 控制按钮 */}
        <div className="flex gap-3">
          {status === 'running' ? (
            <button
              onClick={handlePause}
              className={`px-7 py-2.5 rounded-full font-medium text-white transition-colors ${
                isFocus
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              暂停
            </button>
          ) : (
            <button
              onClick={handleStart}
              className={`px-7 py-2.5 rounded-full font-medium text-white transition-colors ${
                isFocus
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {status === 'paused' ? '继续' : '开始'}
            </button>
          )}
          <button
            onClick={handleReset}
            className="px-7 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full font-medium transition-colors"
          >
            重置
          </button>
        </div>

        {/* 今日统计 */}
        <p className="text-sm text-gray-400">
          今日已完成{' '}
          <span className="font-bold text-gray-700 text-base">{todayCount}</span>{' '}
          个番茄
        </p>
      </div>
    </div>
  )
}

export default Pomodoro
