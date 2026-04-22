import { useEffect, useRef, useState } from 'react'
import { forceCollide, forceSimulation } from 'd3-force'
import { useAuth } from '../../context/AuthContext'
import {
  getAlarmAudioSrc,
  loadAlarmSoundEnabled,
  triggerWebAlarm,
} from '../../utils/alarm'
import { getBeijingDateString, getMillisecondsUntilNextBeijingMidnight } from '../../utils/date'
import { load, save } from '../../utils/storage'
import { savePomodoroSession } from '../../utils/pomodoroApi'
import {
  loadPomodoroTimerSession,
  savePomodoroTimerSession,
} from '../../utils/pomodoroSession'

// 时长常量（后续可由设置页写入 localStorage 后读取）
const FOCUS_MINUTES_KEY = 'pomodoroFocusMinutes'
const DEFAULT_FOCUS_MINUTES = 25
const MIN_FOCUS_MINUTES = 10
const MAX_FOCUS_MINUTES = 120
const BREAK_MINUTES = 5

const STATS_KEY = 'pomodoroStats'
const TOMATO_SCENE = {
  width: 960,
  height: 680,
  floorPadding: 18,
}
const TOMATO_RADIUS = 42
const BASE_TOMATO_SIZE_REM = 5.8
const MAX_TOMATO_SIZE_REM = 21
const DEFAULT_REM_IN_PX = 16

function normalizeFocusMinutes(value) {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_FOCUS_MINUTES
  }
  return Math.max(MIN_FOCUS_MINUTES, Math.min(MAX_FOCUS_MINUTES, parsed))
}

function getTomatoEmojiFontSize(focusMinutes) {
  const BASE_MINUTES = 25
  const MAX_MINUTES = 120
  const clampedMinutes = Math.max(MIN_FOCUS_MINUTES, Math.min(MAX_MINUTES, Number(focusMinutes)))
  const minutesProgress = (clampedMinutes - BASE_MINUTES) / (MAX_MINUTES - BASE_MINUTES)
  const size = BASE_TOMATO_SIZE_REM + minutesProgress * (MAX_TOMATO_SIZE_REM - BASE_TOMATO_SIZE_REM)
  return `${size.toFixed(2)}rem`
}

function getRootFontSizePx() {
  if (typeof window === 'undefined') {
    return DEFAULT_REM_IN_PX
  }
  const parsedSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(parsedSize) ? parsedSize : DEFAULT_REM_IN_PX
}

function getTomatoVisualSizePx(emojiFontSize) {
  const parsedSize = Number.parseFloat(String(emojiFontSize))
  const size = Number.isFinite(parsedSize) ? parsedSize : BASE_TOMATO_SIZE_REM
  return size * getRootFontSizePx()
}

function getTomatoPhysicsMetrics(emojiFontSize) {
  const visualSizePx = getTomatoVisualSizePx(emojiFontSize)
  const radius = visualSizePx / 2

  return {
    visualSizePx,
    radius,
    collisionRadius: radius,
  }
}

function createSettledTomatoes(count, emojiFontSizes = []) {
  const columns = 8
  const spacingX = 88
  const spacingY = 64
  const startX = 156
  const fallbackEmojiFontSize = getTomatoEmojiFontSize(DEFAULT_FOCUS_MINUTES)

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const offset = row % 2 === 0 ? 0 : 26
    const x = startX + column * spacingX + offset
    const emojiFontSize = emojiFontSizes[index] || fallbackEmojiFontSize
    const tomatoMetrics = getTomatoPhysicsMetrics(emojiFontSize)
    const floorY = TOMATO_SCENE.height - TOMATO_SCENE.floorPadding - tomatoMetrics.radius
    const y = floorY - row * spacingY

    return {
      id: `settled-${index}`,
      x,
      y,
      vx: 0,
      vy: 0,
      fx: x,
      fy: y,
      radius: tomatoMetrics.radius,
      collisionRadius: tomatoMetrics.collisionRadius,
      visualSizePx: tomatoMetrics.visualSizePx,
      rotation: (index % 2 === 0 ? -1 : 1) * (5 + (index % 3) * 2),
      opacity: 1,
      squashPhase: 0,
      state: 'settled',
      emojiFontSize,
      persistAfterReset: true,
      removableOnReset: false,
      completedAt: new Date().toISOString(),
    }
  })
}

function createTomatoPhysicsForce() {
  let nodes = []

  function force(alpha) {
    const floor = TOMATO_SCENE.height - TOMATO_SCENE.floorPadding

    for (const node of nodes) {
      if (node.state === 'settled') {
        node.x = node.fx
        node.y = node.fy
        node.vx = 0
        node.vy = 0
        node.squashPhase *= 0.84
        continue
      }

      if (node.state === 'dragging') {
        // position is pinned via fx/fy by the mouse handler
        continue
      }

      if (node.state === 'fading') {
        node.vx *= 0.96
        node.vy *= 0.9
        node.opacity = Math.max(0, node.opacity - 0.018)
        node.squashPhase *= 0.9
        node.rotation *= 0.99
        if (node.opacity <= 0.02) {
          node.remove = true
        }
      } else {
        node.vy += 0.55
        node.vx *= 0.997
        node.rotation += node.vx * 0.12
      }

      const radius = node.radius || TOMATO_RADIUS
      const minX = radius
      const maxX = TOMATO_SCENE.width - radius

      if (node.x < minX) {
        node.x = minX
        node.vx = Math.abs(node.vx) * 0.55
      }
      if (node.x > maxX) {
        node.x = maxX
        node.vx = -Math.abs(node.vx) * 0.55
      }

      const floorY = floor - radius
      if (node.y >= floorY) {
        const impact = Math.max(Math.abs(node.vy), 2)
        node.y = floorY

        if (node.state === 'fading') {
          node.vy = Math.min(node.vy, 0)
        } else {
          node.vy = -impact * 0.48
          node.squashPhase = Math.min(0.34, impact / 18)
          if (Math.abs(node.vy) < 1.2) {
            node.vy = 0
          }
        }
      } else {
        node.squashPhase *= 0.88
      }
    }
  }

  force.initialize = nextNodes => {
    nodes = nextNodes.filter(n => n.state !== 'exploding')
  }

  return force
}

function getTomatoTransform(node) {
  if (node.state === 'exploding') {
    const progress = node.explosionProgress || 0
    const SWELL_END = 0.38
    if (progress <= SWELL_END) {
      // pure swell: grow from 1× to 1.5× with a slight squash wobble
      const t = progress / SWELL_END
      const scaleX = 1 + t * 0.55 + Math.sin(t * Math.PI) * 0.08
      const scaleY = 1 + t * 0.45 - Math.sin(t * Math.PI) * 0.08
      return `translate(-50%, -50%) rotate(${node.rotation}deg) scaleX(${scaleX.toFixed(3)}) scaleY(${scaleY.toFixed(3)})`
    }
    // burst phase: tomato is gone (opacity=0 set in physics), render nothing visible
    return `translate(-50%, -50%) scale(1.5)`
  }

  const squash = node.squashPhase || 0
  const stretch = Math.min(0.22, Math.abs(Math.min(node.vy, 0)) / 16)
  const scaleX = 1 + squash - stretch * 0.35
  const scaleY = 1 - squash * 0.72 + stretch

  return `translate(-50%, -50%) rotate(${node.rotation}deg) scaleX(${scaleX}) scaleY(${scaleY})`
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function getModeDurationSeconds(mode, focusMinutes) {
  return (mode === 'focus' ? focusMinutes : BREAK_MINUTES) * 60
}

function loadTodayCount(todayStr = getBeijingDateString()) {
  const stored = load(STATS_KEY, null)
  return stored?.date === todayStr ? stored.count : 0
}

function loadTodayTomatoEmojiSizes(todayStr = getBeijingDateString()) {
  const stored = load(STATS_KEY, null)
  if (stored?.date !== todayStr || !Array.isArray(stored.tomatoEmojiSizes)) {
    return []
  }
  return stored.tomatoEmojiSizes
}

function saveTodayCompletion(count, emojiFontSize, todayStr = getBeijingDateString()) {
  const date = todayStr
  const stored = load(STATS_KEY, null)
  const isToday = stored?.date === date
  const existingSizes = isToday && Array.isArray(stored.tomatoEmojiSizes)
    ? stored.tomatoEmojiSizes.slice(0, Math.max(0, count - 1))
    : []

  save(STATS_KEY, {
    ...(isToday ? stored : {}),
    date,
    count,
    tomatoEmojiSizes: [...existingSizes, emojiFontSize],
  })
}

function loadTimerSession() {
  const session = loadPomodoroTimerSession()
  if (!session || !['focus', 'break'].includes(session.mode)) return null
  if (!['idle', 'running', 'paused'].includes(session.status)) return null
  return session
}

function saveTimerSession(session) {
  savePomodoroTimerSession(session)
}

function sanitizeTomatoNode(node) {
  return {
    id: node.id,
    x: node.x,
    y: node.y,
    vx: node.vx || 0,
    vy: node.vy || 0,
    fx: node.fx ?? null,
    fy: node.fy ?? null,
    radius: node.radius,
    collisionRadius: node.collisionRadius,
    visualSizePx: node.visualSizePx,
    rotation: node.rotation || 0,
    opacity: node.opacity ?? 1,
    squashPhase: node.squashPhase || 0,
    state: node.state === 'dragging' ? 'active' : node.state,
    emojiFontSize: node.emojiFontSize || getTomatoEmojiFontSize(DEFAULT_FOCUS_MINUTES),
    explosionProgress: node.explosionProgress || 0,
    stainFade: node.stainFade ?? 1,
    persistAfterReset: Boolean(node.persistAfterReset),
    removableOnReset: node.removableOnReset !== false && !node.persistAfterReset,
    completedAt: node.completedAt || null,
    createdAt: node.createdAt || null,
  }
}

function hydrateTomatoNode(node) {
  const emojiFontSize = node?.emojiFontSize || getTomatoEmojiFontSize(DEFAULT_FOCUS_MINUTES)
  const tomatoMetrics = getTomatoPhysicsMetrics(emojiFontSize)

  return {
    id: String(node?.id || crypto.randomUUID()),
    x: Number.isFinite(Number(node?.x)) ? Number(node.x) : TOMATO_SCENE.width / 2,
    y: Number.isFinite(Number(node?.y)) ? Number(node.y) : -120,
    vx: Number(node?.vx) || 0,
    vy: Number(node?.vy) || 0,
    fx: node?.fx ?? null,
    fy: node?.fy ?? null,
    radius: Number(node?.radius) || tomatoMetrics.radius,
    collisionRadius: Number(node?.collisionRadius) || tomatoMetrics.collisionRadius,
    visualSizePx: Number(node?.visualSizePx) || tomatoMetrics.visualSizePx,
    rotation: Number(node?.rotation) || 0,
    opacity: node?.opacity ?? 1,
    squashPhase: Number(node?.squashPhase) || 0,
    state: node?.state === 'dragging' ? 'active' : (node?.state || 'settled'),
    emojiFontSize,
    explosionProgress: Number(node?.explosionProgress) || 0,
    stainFade: node?.stainFade ?? 1,
    persistAfterReset: node?.persistAfterReset ?? node?.state === 'settled',
    removableOnReset: node?.removableOnReset ?? node?.state !== 'settled',
    completedAt: node?.completedAt || null,
    createdAt: node?.createdAt || null,
  }
}

function isHistoricalTomato(node) {
  return Boolean(node.persistAfterReset) || node.removableOnReset === false
}

function getSessionRemainingSeconds(session, now = Date.now()) {
  if (!session) return 0
  if (session.status === 'paused') {
    return Math.max(0, Number(session.remainingSeconds) || 0)
  }
  return Math.max(0, Math.ceil((Number(session.targetEndTime) - now) / 1000))
}

function getInitialTimerState(focusMinutes, todayStr = getBeijingDateString()) {
  const fallbackSeconds = getModeDurationSeconds('focus', focusMinutes)
  const session = loadTimerSession()
  const fallbackTodayCount = 0
  const fallbackTomatoes = []

  if (!session) {
    return {
      mode: 'focus',
      status: 'idle',
      timeLeft: fallbackSeconds,
      totalSeconds: fallbackSeconds,
      todayCount: fallbackTodayCount,
      completedTomatoes: fallbackTomatoes,
      transientTomatoes: [],
      nextTomatoId: fallbackTodayCount,
      activeTomatoId: null,
      focusTomatoSpawned: false,
      focusSessionStartedAt: null,
      sessionEndAt: null,
      sessionLocked: false,
      session: null,
    }
  }

  const isTodaySession = session.date === todayStr
  const sessionLocked = Boolean(session.sessionLocked) || session.status === 'running' || session.status === 'paused'
  const sessionTomatoes = Array.isArray(session.tomatoes)
    ? session.tomatoes.map(hydrateTomatoNode).filter(node => !node.remove)
    : fallbackTomatoes
  const completedTomatoes = Array.isArray(session.completedTomatoes)
    ? session.completedTomatoes.map(hydrateTomatoNode).filter(node => !node.remove)
    : sessionTomatoes.filter(isHistoricalTomato)
  const transientTomatoes = Array.isArray(session.transientTomatoes)
    ? session.transientTomatoes.map(hydrateTomatoNode).filter(node => !node.remove)
    : sessionTomatoes.filter(node => !isHistoricalTomato(node))
  const safeCompletedTomatoes = isTodaySession ? completedTomatoes : []
  const safeTransientTomatoes = isTodaySession
    ? transientTomatoes
    : transientTomatoes.filter(node => !isHistoricalTomato(node))
  const remainingSeconds = getSessionRemainingSeconds(session)
  const durationSeconds = sessionLocked
    ? Number(session.durationSeconds) || getModeDurationSeconds(session.mode, focusMinutes)
    : getModeDurationSeconds(session.mode, focusMinutes)
  const safeStatus = ['running', 'paused', 'idle'].includes(session.status) ? session.status : 'idle'

  return {
    mode: session.mode,
    status: safeStatus,
    timeLeft: sessionLocked
      ? (safeStatus === 'running' ? remainingSeconds : Math.max(0, remainingSeconds || durationSeconds))
      : durationSeconds,
    totalSeconds: durationSeconds,
    todayCount: isTodaySession && Number.isFinite(Number(session.todayCount)) ? Number(session.todayCount) : fallbackTodayCount,
    completedTomatoes: safeCompletedTomatoes,
    transientTomatoes: safeTransientTomatoes,
    nextTomatoId: Number.isFinite(Number(session.nextTomatoId))
      ? Number(session.nextTomatoId)
      : Math.max(fallbackTodayCount, safeCompletedTomatoes.length + safeTransientTomatoes.length),
    activeTomatoId: session.activeTomatoId || safeTransientTomatoes.find(node => node.state === 'active')?.id || null,
    focusTomatoSpawned: Boolean(session.focusTomatoSpawned),
    focusSessionStartedAt: session.focusSessionStartedAt || null,
    sessionEndAt: safeStatus === 'running' ? Number(session.targetEndTime) || null : null,
    sessionLocked,
    session,
  }
}

// ---- 主组件 ----

function Pomodoro() {
  const { user } = useAuth()
  const [todayStr, setTodayStr] = useState(() => getBeijingDateString())
  const [settingsFocusMinutes, setSettingsFocusMinutes] = useState(() =>
    normalizeFocusMinutes(load(FOCUS_MINUTES_KEY, DEFAULT_FOCUS_MINUTES)),
  )
  const [initialTimerState] = useState(() => getInitialTimerState(settingsFocusMinutes, getBeijingDateString()))
  const [mode, setMode] = useState(initialTimerState.mode)       // 'focus' | 'break'
  const [status, setStatus] = useState(initialTimerState.status)    // 'idle' | 'running' | 'paused'
  const [timeLeft, setTimeLeft] = useState(initialTimerState.timeLeft)
  const [durationSeconds, setDurationSeconds] = useState(initialTimerState.totalSeconds)
  const [todayCount, setTodayCount] = useState(initialTimerState.todayCount)
  const [notification, setNotification] = useState(null)
  const [alarmSoundEnabled, setAlarmSoundEnabled] = useState(() => loadAlarmSoundEnabled())
  const [completedTomatoes, setCompletedTomatoes] = useState(initialTimerState.completedTomatoes)
  const [transientTomatoes, setTransientTomatoes] = useState(initialTimerState.transientTomatoes)
  const tomatoNodes = [...completedTomatoes, ...transientTomatoes]

  const currentTomatoEmojiFontSize = getTomatoEmojiFontSize(settingsFocusMinutes)

  const nodesRef = useRef([])
  const simulationRef = useRef(null)
  const animationFrameRef = useRef(null)
  const notificationTimeoutRef = useRef(null)
  const alarmAudioRef = useRef(null)
  const nextTomatoIdRef = useRef(initialTimerState.nextTomatoId)
  const activeTomatoIdRef = useRef(initialTimerState.activeTomatoId)
  const focusTomatoSpawnedRef = useRef(initialTimerState.focusTomatoSpawned)
  const sceneRef = useRef(null)
  const prevMouseRef = useRef(null)
  const dragNodeRef = useRef(null)
  const focusSessionStartedAtRef = useRef(
    initialTimerState.focusSessionStartedAt
      ? new Date(initialTimerState.focusSessionStartedAt)
      : null,
  )
  const sessionEndAtRef = useRef(initialTimerState.sessionEndAt)
  const sessionLockedRef = useRef(initialTimerState.sessionLocked)
  const modeRef = useRef(initialTimerState.mode)
  const statusRef = useRef(initialTimerState.status)
  const todayStrRef = useRef(todayStr)
  const processedTodayStrRef = useRef(todayStr)
  const timeLeftRef = useRef(initialTimerState.timeLeft)
  const durationSecondsRef = useRef(initialTimerState.totalSeconds)
  const todayCountRef = useRef(initialTimerState.todayCount)
  const completedTomatoesStateRef = useRef(initialTimerState.completedTomatoes)
  const transientTomatoesStateRef = useRef(initialTimerState.transientTomatoes)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    modeRef.current = mode
    statusRef.current = status
    todayStrRef.current = todayStr
    timeLeftRef.current = timeLeft
    durationSecondsRef.current = durationSeconds
    todayCountRef.current = todayCount
    completedTomatoesStateRef.current = completedTomatoes
    transientTomatoesStateRef.current = transientTomatoes
  }, [mode, status, timeLeft, durationSeconds, todayStr, todayCount, completedTomatoes, transientTomatoes])

  function persistTimerState(overrides = {}) {
    const snapshotMode = overrides.mode ?? modeRef.current
    const snapshotStatus = overrides.status ?? statusRef.current
    const snapshotRemaining = overrides.remainingSeconds ?? timeLeftRef.current
    const snapshotTargetEndTime = overrides.targetEndTime ?? sessionEndAtRef.current
    const rawNodes = nodesRef.current.length > 0
      ? nodesRef.current
      : [...completedTomatoesStateRef.current, ...transientTomatoesStateRef.current]
    const sanitizedNodes = rawNodes.map(sanitizeTomatoNode)
    const persistedCompleted = sanitizedNodes.filter(isHistoricalTomato)
    const persistedTransient = sanitizedNodes.filter(node => !isHistoricalTomato(node))

    saveTimerSession({
      date: todayStrRef.current,
      mode: snapshotMode,
      status: snapshotStatus,
      durationSeconds: overrides.durationSeconds ?? durationSecondsRef.current ?? getModeDurationSeconds(snapshotMode, settingsFocusMinutes),
      remainingSeconds: Math.max(0, Math.ceil(Number(snapshotRemaining) || 0)),
      targetEndTime: snapshotStatus === 'running' ? snapshotTargetEndTime : null,
      focusSessionStartedAt: focusSessionStartedAtRef.current?.toISOString() || null,
      todayCount: overrides.todayCount ?? todayCountRef.current,
      tomatoes: sanitizedNodes,
      completedTomatoes: persistedCompleted,
      transientTomatoes: persistedTransient,
      nextTomatoId: nextTomatoIdRef.current,
      activeTomatoId: activeTomatoIdRef.current,
      focusTomatoSpawned: focusTomatoSpawnedRef.current,
      sessionLocked: overrides.sessionLocked ?? sessionLockedRef.current,
    })
  }

  useEffect(() => {
    persistTimerState()
  }, [mode, status, timeLeft, durationSeconds, todayCount])

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
    if (processedTodayStrRef.current === todayStr) {
      return
    }

    processedTodayStrRef.current = todayStr

    const nextTransientTomatoes = [...completedTomatoesStateRef.current, ...transientTomatoesStateRef.current]
      .filter(node => !isHistoricalTomato(node))
      .map(node => ({ ...node, persistAfterReset: false, removableOnReset: true }))

    nodesRef.current = nextTransientTomatoes.map(node => ({ ...node }))
    setCompletedTomatoes([])
    setTransientTomatoes(nextTransientTomatoes)
    setTodayCount(0)
    persistTimerState({ todayCount: 0 })

    if (nextTransientTomatoes.length > 0) {
      refreshSimulation(0.4)
    }
  }, [todayStr])

  useEffect(() => {
    function syncIdleSettingsDuration() {
      if (statusRef.current !== 'idle' || sessionLockedRef.current) return

      const nextFocusMinutes = normalizeFocusMinutes(load(FOCUS_MINUTES_KEY, DEFAULT_FOCUS_MINUTES))
      setSettingsFocusMinutes(nextFocusMinutes)

      if (modeRef.current !== 'focus') return

      const nextSeconds = nextFocusMinutes * 60
      setDurationSeconds(nextSeconds)
      setTimeLeft(nextSeconds)
      persistTimerState({
        mode: 'focus',
        status: 'idle',
        durationSeconds: nextSeconds,
        remainingSeconds: nextSeconds,
        targetEndTime: null,
        sessionLocked: false,
      })
    }

    syncIdleSettingsDuration()
    window.addEventListener('focus', syncIdleSettingsDuration)
    window.addEventListener('storage', syncIdleSettingsDuration)
    return () => {
      window.removeEventListener('focus', syncIdleSettingsDuration)
      window.removeEventListener('storage', syncIdleSettingsDuration)
    }
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


  useEffect(() => {
    nodesRef.current = [...completedTomatoesStateRef.current, ...transientTomatoesStateRef.current].map(node => ({ ...node }))

    const simulation = forceSimulation(nodesRef.current)
      .alphaDecay(0)
      .alphaMin(0)
      .velocityDecay(0.12)
      .force('collide', forceCollide().radius(node => node.collisionRadius || TOMATO_RADIUS).iterations(5))
      .force('physics', createTomatoPhysicsForce())
      .on('tick', () => {
        if (animationFrameRef.current) return

        animationFrameRef.current = requestAnimationFrame(() => {
          animationFrameRef.current = null

          const filteredNodes = nodesRef.current.filter(node => !node.remove)
          if (filteredNodes.length !== nodesRef.current.length) {
            nodesRef.current = filteredNodes
            simulation.nodes(nodesRef.current.filter(node => node.state !== 'exploding'))
          }

          // 单独处理 exploding 节点
          nodesRef.current.forEach(node => {
            if (node.state === 'exploding') {
              node.vx *= 0.9
              node.vy *= 0.9
              node.explosionProgress = Math.min(1, (node.explosionProgress || 0) + 0.038)
              const SWELL_END = 0.38
              const isBursting = node.explosionProgress > SWELL_END
              if (isBursting) {
                node.stainFade = Math.max(0, (node.stainFade ?? 1) - 0.008)
              } else {
                node.stainFade = 1
              }
              node.opacity = isBursting ? 0 : 1
              node.rotation *= 0.97
              node.squashPhase = 0
              if (isBursting && node.stainFade <= 0.02) {
                node.remove = true
              }
            }
          })

          // 再次过滤掉新标记为 remove 的节点
          const finalRenderedNodes = nodesRef.current.filter(node => !node.remove)
          setCompletedTomatoes(
            finalRenderedNodes
              .filter(isHistoricalTomato)
              .map(node => ({ ...node })),
          )
          setTransientTomatoes(
            finalRenderedNodes
              .filter(node => !isHistoricalTomato(node))
              .map(node => ({ ...node })),
          )

          // stop when nothing is moving; restart on spawn/drag
          const hasMoving = nodesRef.current.some(
            n => n.state === 'active' || n.state === 'fading' || n.state === 'dragging' || n.state === 'exploding'
          )
          if (!hasMoving) {
            simulation.stop()
          }
        })
      })

    simulationRef.current = simulation

    return () => {
      persistTimerState()
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      simulation.stop()
    }
  }, [])


  // Effect 1：status 为 running 时每秒递减
  useEffect(() => {
    if (status !== 'running') return

    function syncRemainingTime() {
      const targetEndTime = sessionEndAtRef.current
      if (!targetEndTime) return
      setTimeLeft(Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000)))
    }

    syncRemainingTime()
    const id = setInterval(syncRemainingTime, 1000)
    return () => clearInterval(id)
  }, [status])

  // Effect 2：timeLeft 到 0 时处理倒计时结束逻辑
  useEffect(() => {
    if (status !== 'running' || timeLeft !== 0) return

    setStatus('idle')
    sessionEndAtRef.current = null

    if (mode === 'focus') {
      const endedAt = new Date()
      const startedAt = focusSessionStartedAtRef.current || new Date(endedAt.getTime() - durationSeconds * 1000)
      focusSessionStartedAtRef.current = null
      const completedEmojiFontSize = settleActiveTomato() || currentTomatoEmojiFontSize
      focusTomatoSpawnedRef.current = false
      setTodayCount(prev => {
        const next = prev + 1
        saveTodayCompletion(next, completedEmojiFontSize, todayStrRef.current)
        return next
      })
      if (user) {
        savePomodoroSession({
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationSeconds,
        })
          .catch(error => showNotification(`番茄已完成，但云端保存失败：${error.message || '未知错误'}`))
      }
      setMode('break')
      setTimeLeft(BREAK_MINUTES * 60)
      setDurationSeconds(BREAK_MINUTES * 60)
      showNotification('专注结束！去休息 5 分钟吧')
      triggerPomodoroReminder('番茄钟提醒', '专注结束！去休息 5 分钟吧')
    } else {
      focusTomatoSpawnedRef.current = false
      setMode('focus')
      setTimeLeft(settingsFocusMinutes * 60)
      setDurationSeconds(settingsFocusMinutes * 60)
      showNotification('休息结束！开始下一个番茄')
      triggerPomodoroReminder('番茄钟提醒', '休息结束！开始下一个番茄')
    }
  }, [
    timeLeft,
    status,
    mode,
    durationSeconds,
    settingsFocusMinutes,
    user,
    currentTomatoEmojiFontSize,
    alarmSoundEnabled,
  ])

  function showNotification(msg) {
    setNotification(msg)
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current)
    }
    notificationTimeoutRef.current = setTimeout(() => setNotification(null), 4000)
  }

  function triggerPomodoroReminder(title, message) {
    triggerWebAlarm(alarmAudioRef.current, alarmSoundEnabled, title, message)
  }

  function refreshSimulation(alpha = 0.7) {
    const simulation = simulationRef.current
    if (!simulation) return
    // 始终过滤掉 exploding 节点，确保它们不再参与物理系统
    simulation.nodes(nodesRef.current.filter(node => node.state !== 'exploding'))
    simulation.alpha(alpha).restart()
  }

  function spawnFallingTomato() {
    if (activeTomatoIdRef.current) return

    const id = `active-${nextTomatoIdRef.current++}`
    const tomatoMetrics = getTomatoPhysicsMetrics(currentTomatoEmojiFontSize)
    const nextNode = {
      id,
      x: TOMATO_SCENE.width / 2 + (Math.random() - 0.5) * 24,
      y: -120,
      vx: (Math.random() - 0.5) * 2,
      vy: 0,
      radius: tomatoMetrics.radius,
      collisionRadius: tomatoMetrics.collisionRadius,
      visualSizePx: tomatoMetrics.visualSizePx,
      rotation: (Math.random() - 0.5) * 10,
      opacity: 1,
      squashPhase: 0,
      state: 'active',
      emojiFontSize: currentTomatoEmojiFontSize,
      persistAfterReset: false,
      removableOnReset: true,
      createdAt: new Date().toISOString(),
    }

    activeTomatoIdRef.current = id
    nodesRef.current = [...nodesRef.current, nextNode]
    setTransientTomatoes(prev => [...prev, { ...nextNode }])
    refreshSimulation(0.95)
  }

  function settleActiveTomato() {
    const activeId = activeTomatoIdRef.current
    if (!activeId) return null

    const activeNode = nodesRef.current.find(node => node.id === activeId)
    if (!activeNode) {
      activeTomatoIdRef.current = null
      return null
    }

    const completedEmojiFontSize = activeNode.emojiFontSize || currentTomatoEmojiFontSize
    const tomatoMetrics = getTomatoPhysicsMetrics(completedEmojiFontSize)
    activeNode.state = 'settled'
    activeNode.vx = 0
    activeNode.vy = 0
    activeNode.radius = activeNode.radius || tomatoMetrics.radius
    activeNode.collisionRadius = activeNode.collisionRadius || tomatoMetrics.collisionRadius
    activeNode.visualSizePx = activeNode.visualSizePx || tomatoMetrics.visualSizePx
    activeNode.fx = activeNode.x
    activeNode.fy = Math.min(
      activeNode.y,
      TOMATO_SCENE.height - TOMATO_SCENE.floorPadding - activeNode.radius,
    )
    activeNode.x = activeNode.fx
    activeNode.y = activeNode.fy
    activeNode.opacity = 1
    activeNode.squashPhase = 0.12
    activeNode.emojiFontSize = completedEmojiFontSize
    activeNode.persistAfterReset = true
    activeNode.removableOnReset = false
    activeNode.completedAt = new Date().toISOString()

    activeTomatoIdRef.current = null
    setCompletedTomatoes(prev => [...prev, { ...activeNode }])
    setTransientTomatoes(prev => prev.filter(node => node.id !== activeNode.id))
    refreshSimulation(0.32)
    return completedEmojiFontSize
  }

  function fadeActiveTomato() {
    const activeId = activeTomatoIdRef.current
    if (!activeId) return

    const activeNode = nodesRef.current.find(node => node.id === activeId)
    if (!activeNode) {
      activeTomatoIdRef.current = null
      return
    }
    if (isHistoricalTomato(activeNode)) {
      activeTomatoIdRef.current = null
      return
    }

    activeNode.state = 'fading'
    activeNode.vx *= 0.25
    activeNode.vy = Math.min(activeNode.vy, -0.4)
    activeNode.squashPhase = Math.max(activeNode.squashPhase, 0.08)
    activeTomatoIdRef.current = null
    refreshSimulation(0.45)
  }

  function explodeActiveTomato() {
    const activeId = activeTomatoIdRef.current
    if (!activeId) return

    const activeNode = nodesRef.current.find(node => node.id === activeId)
    if (!activeNode) {
      activeTomatoIdRef.current = null
      return
    }
    if (isHistoricalTomato(activeNode)) {
      activeTomatoIdRef.current = null
      return
    }

    activeNode.state = 'exploding'
    activeNode.vx *= 0.08
    activeNode.vy *= 0.08
    activeNode.fx = null
    activeNode.fy = null
    activeNode.explosionProgress = 0
    activeNode.burstScale = 0.9
    activeNode.opacity = 1
    activeNode.squashPhase = 0.16

    activeTomatoIdRef.current = null
    refreshSimulation(0.6)
  }

  function cancelActiveSessionTomato() {
    const activeId = activeTomatoIdRef.current
    if (!activeId) return

    const activeNode = nodesRef.current.find(node => node.id === activeId)
    if (!activeNode) {
      activeTomatoIdRef.current = null
      return
    }

    if (!isHistoricalTomato(activeNode)) {
      activeNode.state = 'exploding'
      activeNode.vx *= 0.08
      activeNode.vy *= 0.08
      activeNode.fx = null
      activeNode.fy = null
      activeNode.explosionProgress = 0
      activeNode.burstScale = 0.9
      activeNode.opacity = 1
      activeNode.squashPhase = 0.16
      activeNode.removeAfterExplosion = true
    }

    activeTomatoIdRef.current = null
    setCompletedTomatoes(nodesRef.current.filter(isHistoricalTomato).map(node => ({ ...node })))
    setTransientTomatoes(nodesRef.current.filter(node => !isHistoricalTomato(node)).map(node => ({ ...node })))
    refreshSimulation(0.6)
  }

  // ---- 鼠标交互 ----
  function getSceneCoords(clientX, clientY) {
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return null
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  function handleSceneMouseDown(e) {
    const pos = getSceneCoords(e.clientX, e.clientY)
    if (!pos) return
    for (const node of nodesRef.current) {
      if (node.state === 'fading' || node.state === 'exploding') continue
      const nx = node.fx ?? node.x
      const ny = node.fy ?? node.y
      const dist = Math.sqrt((pos.x - nx) ** 2 + (pos.y - ny) ** 2)
      if (dist < (node.radius || TOMATO_RADIUS) * 1.2) {
        dragNodeRef.current = node.id
        node.state = 'dragging'
        node.fx = pos.x
        node.fy = pos.y
        node._dragVx = 0
        node._dragVy = 0
        prevMouseRef.current = pos
        setIsDragging(true)
        refreshSimulation(0.5)

        function onWindowMove(ev) {
          const p = getSceneCoords(ev.clientX, ev.clientY)
          if (!p) return
          const prev = prevMouseRef.current
          prevMouseRef.current = p
          const n = nodesRef.current.find(nd => nd.id === dragNodeRef.current)
          if (n) {
            n.fx = p.x
            n.fy = p.y
            if (prev) {
              n._dragVx = (p.x - prev.x) * 0.75
              n._dragVy = (p.y - prev.y) * 0.75
            }
          }
          refreshSimulation(0.4)
        }

        function onWindowUp() {
          const id = dragNodeRef.current
          if (id) {
            const n = nodesRef.current.find(nd => nd.id === id)
            if (n) {
              n.state = 'active'
              n.vx = n._dragVx ?? 0
              n.vy = n._dragVy ?? 0
              n.fx = null
              n.fy = null
              delete n._dragVx
              delete n._dragVy
            }
          }
          dragNodeRef.current = null
          prevMouseRef.current = null
          setIsDragging(false)
          refreshSimulation(0.8)
          window.removeEventListener('mousemove', onWindowMove)
          window.removeEventListener('mouseup', onWindowUp)
        }

        window.addEventListener('mousemove', onWindowMove)
        window.addEventListener('mouseup', onWindowUp)
        e.preventDefault()
        return
      }
    }
  }

  function handleStart() {
    const nextDuration = status === 'paused'
      ? durationSeconds
      : getModeDurationSeconds(mode, settingsFocusMinutes)
    const nextRemaining = status === 'paused'
      ? timeLeft
      : nextDuration
    const targetEndTime = Date.now() + nextRemaining * 1000

    if (mode === 'focus' && !focusSessionStartedAtRef.current) {
      focusSessionStartedAtRef.current = new Date()
    }
    if (mode === 'focus' && !focusTomatoSpawnedRef.current) {
      spawnFallingTomato()
      focusTomatoSpawnedRef.current = true
    }
    sessionEndAtRef.current = targetEndTime
    sessionLockedRef.current = true
    setDurationSeconds(nextDuration)
    setTimeLeft(nextRemaining)
    setStatus('running')
    persistTimerState({
      status: 'running',
      durationSeconds: nextDuration,
      remainingSeconds: nextRemaining,
      targetEndTime,
      sessionLocked: true,
    })
  }

  function handlePause() {
    const remaining = sessionEndAtRef.current
      ? Math.max(0, Math.ceil((sessionEndAtRef.current - Date.now()) / 1000))
      : timeLeft
    sessionEndAtRef.current = null
    setTimeLeft(remaining)
    setStatus('paused')
    persistTimerState({
      status: 'paused',
      remainingSeconds: remaining,
      targetEndTime: null,
    })
  }

  function handleReset() {
    sessionEndAtRef.current = null
    sessionLockedRef.current = false
    cancelActiveSessionTomato()
    focusTomatoSpawnedRef.current = false
    focusSessionStartedAtRef.current = null
    const resetSeconds = settingsFocusMinutes * 60
    setMode('focus')
    setStatus('idle')
    setDurationSeconds(resetSeconds)
    setTimeLeft(resetSeconds)
    persistTimerState({
      status: 'idle',
      mode: 'focus',
      durationSeconds: resetSeconds,
      remainingSeconds: resetSeconds,
      targetEndTime: null,
      sessionLocked: false,
    })
  }

  function handleSwitchMode(newMode) {
    if (newMode === mode) return
    sessionEndAtRef.current = null
    if (mode === 'focus') {
      fadeActiveTomato()
      focusTomatoSpawnedRef.current = false
      focusSessionStartedAtRef.current = null
    }
    if (newMode === 'focus') {
      focusTomatoSpawnedRef.current = false
      focusSessionStartedAtRef.current = null
    }
    const nextSeconds = newMode === 'focus' ? settingsFocusMinutes * 60 : BREAK_MINUTES * 60
    setMode(newMode)
    setStatus('idle')
    setDurationSeconds(nextSeconds)
    setTimeLeft(nextSeconds)
    persistTimerState({
      mode: newMode,
      status: 'idle',
      durationSeconds: nextSeconds,
      remainingSeconds: nextSeconds,
      targetEndTime: null,
    })
  }

  const isFocus = mode === 'focus'
  const totalSeconds = durationSeconds
  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0
  const ringRadius = 72
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset = ringCircumference * (1 - Math.min(1, Math.max(0, progress)))
  const activeModeClass = isFocus ? 'pomodoro-mode-focus' : 'pomodoro-mode-break'

  return (
    <div className="pomodoro-page space-y-4">
      <audio ref={alarmAudioRef} src={getAlarmAudioSrc()} preload="auto" className="hidden" />

      <h1 className="pomodoro-title text-2xl font-bold">番茄钟</h1>

      {/* 倒计时结束通知 */}
      {notification && (
        <div className="pomodoro-notification text-sm px-4 py-3 rounded-xl">
          {notification}
        </div>
      )}

      <div
        ref={sceneRef}
        className="pomodoro-scene relative overflow-hidden rounded-[2rem] h-[680px] select-none"
        style={{ cursor: isDragging ? 'grabbing' : 'default' }}
        onMouseDown={handleSceneMouseDown}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="pomodoro-top-glow absolute inset-x-0 top-0 h-32" />
          <div className="pomodoro-floor-glow absolute inset-x-10 bottom-10 h-20 rounded-full blur-3xl" />
          <div className="pomodoro-kicker absolute left-6 top-6 text-xs font-semibold uppercase tracking-[0.32em]">
            Focus Gravity
          </div>
          <div className="pomodoro-scene-hint absolute right-6 top-6 text-sm">
            开始专注时会掉下一颗新番茄
          </div>

          {tomatoNodes.map(node => {
            const shadowScale = 0.72 + (node.squashPhase || 0) * 1.6
            const shadowOpacity = Math.max(0.16, node.opacity * (0.44 - Math.min(node.y, 240) / 1000))

            return (
              <div
                key={node.id}
                className="absolute top-0 left-0"
                style={{
                  transform: `translate(${node.x - 34}px, ${TOMATO_SCENE.height - TOMATO_SCENE.floorPadding + 8}px)`,
                  opacity: shadowOpacity,
                }}
              >
                <div
                  className="pomodoro-tomato-shadow h-7 rounded-full blur-md"
                  style={{
                    width: `${node.radius * 1.45}px`,
                    transform: `scaleX(${shadowScale})`,
                  }}
                />
              </div>
            )
          })}

          {tomatoNodes
            .filter(node => node.state === 'exploding')
            .map(node => {
              const rawProgress = node.explosionProgress || 0
              const SWELL_END = 0.38
              // nothing to draw during swell phase
              if (rawProgress <= SWELL_END) return null
              // remap burst phase (0.38→1) to progress (0→1) so all math below starts from 0
              const progress = (rawProgress - SWELL_END) / (1 - SWELL_END)
              const stainOpacity = Math.max(0, (node.stainFade ?? 1) * 0.92)
              const fragmentOpacity = Math.max(0, 1.0 - progress * 1.15)
              const fragmentCount = 18

              return (
                <div
                  key={`${node.id}-burst`}
                  className="absolute top-0 left-0 will-change-transform"
                  style={{
                    transform: `translate(${node.x}px, ${node.y}px)`,
                    zIndex: 0,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    className="absolute rounded-full blur-2xl"
                    style={{
                      width: `${120 + progress * 110}px`,
                      height: `${70 + progress * 56}px`,
                      left: `${-60 - progress * 55}px`,
                      top: `${-34 - progress * 28}px`,
                      background: 'radial-gradient(circle, rgba(239,68,68,0.9) 0%, rgba(249,115,22,0.66) 48%, rgba(255,255,255,0) 78%)',
                    }}
                  />
                  <div
                    className="absolute rounded-full blur-xl"
                    style={{
                      width: `${74 + progress * 76}px`,
                      height: `${74 + progress * 52}px`,
                      left: `${-44 - progress * 26}px`,
                      top: `${-44 - progress * 14}px`,
                      background: 'radial-gradient(circle, rgba(220,38,38,0.84) 0%, rgba(248,113,113,0.52) 62%, rgba(255,255,255,0) 100%)',
                    }}
                  />
                  <div
                    className="absolute rounded-full blur-lg"
                    style={{
                      width: `${32 + progress * 44}px`,
                      height: `${24 + progress * 20}px`,
                      left: `${18 + progress * 42}px`,
                      top: `${-22 - progress * 20}px`,
                      background: 'rgba(239,68,68,0.9)',
                    }}
                  />
                  <div
                    className="absolute rounded-full blur-lg"
                    style={{
                      width: `${26 + progress * 30}px`,
                      height: `${18 + progress * 16}px`,
                      left: `${-52 - progress * 24}px`,
                      top: `${6 + progress * 14}px`,
                      background: 'rgba(220,38,38,0.84)',
                    }}
                  />

                  <div
                    className="absolute blur-[18px]"
                    style={{
                      left: `${-88 - progress * 18}px`,
                      top: `${28 + progress * 10}px`,
                      width: `${180 + progress * 80}px`,
                      height: `${82 + progress * 28}px`,
                      opacity: stainOpacity,
                      borderRadius: '58% 42% 54% 46% / 46% 58% 42% 54%',
                      background: 'radial-gradient(circle at 38% 42%, rgba(185,28,28,0.58) 0%, rgba(220,38,38,0.5) 34%, rgba(239,68,68,0.26) 65%, rgba(255,255,255,0) 100%)',
                      transform: `rotate(${-8 + progress * 7}deg) scale(${1 + progress * 0.12}, ${0.92 + progress * 0.06})`,
                    }}
                  />
                  <div
                    className="absolute blur-[14px]"
                    style={{
                      left: `${-28 + progress * 18}px`,
                      top: `${42 + progress * 10}px`,
                      width: `${92 + progress * 34}px`,
                      height: `${42 + progress * 16}px`,
                      opacity: stainOpacity * 0.92,
                      borderRadius: '43% 57% 48% 52% / 56% 40% 60% 44%',
                      background: 'radial-gradient(circle at 48% 40%, rgba(153,27,27,0.52) 0%, rgba(220,38,38,0.38) 55%, rgba(255,255,255,0) 100%)',
                      transform: `rotate(${12 - progress * 10}deg)`,
                    }}
                  />
                  <div
                    className="absolute blur-[12px]"
                    style={{
                      left: `${-104 - progress * 12}px`,
                      top: `${52 + progress * 8}px`,
                      width: `${54 + progress * 22}px`,
                      height: `${28 + progress * 12}px`,
                      opacity: stainOpacity * 0.8,
                      borderRadius: '62% 38% 51% 49% / 40% 56% 44% 60%',
                      background: 'rgba(185,28,28,0.42)',
                      transform: `rotate(${-26 + progress * 8}deg)`,
                    }}
                  />

                  {Array.from({ length: fragmentCount }, (_, index) => {
                    const angle = (Math.PI * 2 * index) / fragmentCount
                    const distance = 30 + progress * (64 + (index % 5) * 14)
                    const x = Math.cos(angle) * distance
                    const y = Math.sin(angle) * distance * 0.76 - (index % 4 === 0 ? 10 : 0)
                    const sizePattern = [9, 14, 22, 12, 28, 16]
                    const size = sizePattern[index % sizePattern.length] + progress * (8 + (index % 3) * 4)
                    const opacity = fragmentOpacity
                    const colors = [
                      'rgba(185,28,28,0.96)',
                      'rgba(220,38,38,0.94)',
                      'rgba(239,68,68,0.92)',
                      'rgba(248,113,113,0.88)',
                      'rgba(249,115,22,0.86)',
                    ]
                    const rotate = index % 2 === 0 ? index * 17 : -index * 13

                    return (
                      <div
                        key={`${node.id}-fragment-${index}`}
                        className="absolute blur-[5px]"
                        style={{
                          width: `${size}px`,
                          height: `${Math.max(7, size * (index % 3 === 0 ? 0.58 : 0.82))}px`,
                          left: `${x - size / 2}px`,
                          top: `${y - size / 2}px`,
                          opacity,
                          borderRadius: index % 4 === 0 ? '62% 38% 55% 45% / 44% 61% 39% 56%' : '999px',
                          transform: `rotate(${rotate}deg) scale(${1 + progress * (0.12 + (index % 4) * 0.03)})`,
                          background: colors[index % colors.length],
                          boxShadow: '0 0 22px rgba(239,68,68,0.42)',
                        }}
                      />
                    )
                  })}
                </div>
              )
            })}

          {tomatoNodes
            .filter(node => node.state !== 'exploding')
            .map(node => (
            <div
              key={`${node.id}-emoji`}
              className="absolute select-none leading-none will-change-transform"
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                opacity: node.opacity,
                transform: getTomatoTransform(node),
                filter: 'var(--pomodoro-tomato-drop-shadow)',
                fontSize: node.emojiFontSize || getTomatoEmojiFontSize(DEFAULT_FOCUS_MINUTES),
                textShadow: 'var(--pomodoro-tomato-text-shadow)',
              }}
            >
              🍅
            </div>
          ))}
        </div>

        <div className="relative z-10 flex h-full items-center justify-center pointer-events-none">
          <div className="pomodoro-panel w-full max-w-[22rem] rounded-[2rem] px-5 py-6 text-center backdrop-blur-md sm:px-7 sm:py-8 pointer-events-none">
            <div className="flex justify-center">
              <div className="pomodoro-mode-switch flex gap-2 rounded-lg p-1 pointer-events-auto">
                <button
                  onClick={() => handleSwitchMode('focus')}
                  className={`pomodoro-mode-button px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isFocus ? 'is-active is-focus' : ''
                  }`}
                >
                  专注模式
                </button>
                <button
                  onClick={() => handleSwitchMode('break')}
                  className={`pomodoro-mode-button px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    !isFocus ? 'is-active is-break' : ''
                  }`}
                >
                  休息模式
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <div className="relative h-44 w-44">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 176 176" aria-hidden="true">
                  <circle
                    cx="88"
                    cy="88"
                    r={ringRadius}
                    fill="none"
                    stroke={isFocus ? 'var(--pomodoro-focus-track)' : 'var(--pomodoro-break-track)'}
                    strokeWidth="12"
                  />
                  <circle
                    cx="88"
                    cy="88"
                    r={ringRadius}
                    fill="none"
                    stroke={isFocus ? 'var(--pomodoro-focus-accent)' : 'var(--pomodoro-break-accent)'}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                  />
                </svg>

                <div className="pomodoro-timer-core absolute inset-[16px] flex items-center justify-center rounded-full">
                  <span
                    className={`pomodoro-time-text ${activeModeClass} text-[2.7rem] font-bold font-mono tracking-tight`}
                  >
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-center gap-3 pointer-events-auto">
              {status === 'running' ? (
                <button
                  onClick={handlePause}
                  className={`pomodoro-action-button ${activeModeClass} px-7 py-2.5 rounded-full font-medium transition-colors`}
                >
                  暂停
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  className={`pomodoro-action-button ${activeModeClass} px-7 py-2.5 rounded-full font-medium transition-colors`}
                >
                  {status === 'paused' ? '继续' : '开始'}
                </button>
              )}
              <button
                onClick={handleReset}
                className="pomodoro-reset-button px-7 py-2.5 rounded-full font-medium transition-colors"
              >
                重置
              </button>
            </div>

            <p className="pomodoro-count-text mt-5 text-sm">
              今日已完成{' '}
              <span className="pomodoro-count-number font-bold text-base">{todayCount}</span>{' '}
              个番茄
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Pomodoro
