import { load, save } from './storage'

export const ALARM_SOUND_ENABLED_KEY = 'alarmSoundEnabled'

let cachedAlarmAudioSrc = null

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function createAlarmAudioSrc() {
  const sampleRate = 22050
  const durationSeconds = 2.1
  const sampleCount = Math.floor(sampleRate * durationSeconds)
  const wavBuffer = new ArrayBuffer(44 + sampleCount * 2)
  const view = new DataView(wavBuffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + sampleCount * 2, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, sampleCount * 2, true)

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate
    const burstIndex = Math.floor(time / 0.7)
    const burstTime = time % 0.7
    const pulseIndex = Math.floor(burstTime / 0.12)
    const pulseTime = burstTime % 0.12
    const isActiveBurst = burstIndex < 3
    const isActivePulse = pulseIndex < 5 && pulseTime < 0.055
    const gate = isActiveBurst && isActivePulse ? 1 : 0
    const frequency = 1240
    const attack = Math.min(1, pulseTime / 0.006)
    const release = pulseTime < 0.04 ? 1 : Math.max(0, 1 - (pulseTime - 0.04) / 0.015)
    const envelope = Math.max(0.55, 1 - time / durationSeconds) * attack * release
    const sample = gate * Math.sin(2 * Math.PI * frequency * time) * envelope * 0.7
    view.setInt16(44 + index * 2, Math.round(sample * 0x7fff), true)
  }

  return `data:audio/wav;base64,${arrayBufferToBase64(wavBuffer)}`
}

export function getAlarmAudioSrc() {
  if (!cachedAlarmAudioSrc) {
    cachedAlarmAudioSrc = createAlarmAudioSrc()
  }
  return cachedAlarmAudioSrc
}

export function loadAlarmSoundEnabled() {
  return load(ALARM_SOUND_ENABLED_KEY, true) !== false
}

export function saveAlarmSoundEnabled(enabled) {
  const nextValue = Boolean(enabled)
  save(ALARM_SOUND_ENABLED_KEY, nextValue)
  return nextValue
}

function playAlarmSound(audioElement, enabled) {
  if (!enabled || !audioElement) {
    return () => {}
  }

  try {
    audioElement.loop = true
    audioElement.currentTime = 0
    const playResult = audioElement.play()
    if (playResult?.catch) {
      playResult.catch(() => {})
    }
  } catch {
    // Ignore autoplay failures and keep popup reminders working.
  }

  return () => {
    try {
      audioElement.pause()
      audioElement.currentTime = 0
      audioElement.loop = false
    } catch {
      // Ignore audio shutdown failures.
    }
  }
}

export function triggerWebAlarm(audioElement, enabled, title, message) {
  if (typeof window === 'undefined') {
    return
  }

  const stopAlarmSound = playAlarmSound(audioElement, enabled)
  const popupText = message ? `${title}\n${message}` : title

  function stopAfterTimeout() {
    window.setTimeout(() => {
      stopAlarmSound()
    }, 10000)
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      tag: `lguide-${title}`,
    })
    stopAfterTimeout()
    return
  }

  try {
    window.alert(popupText)
    stopAlarmSound()
  } catch {
    stopAfterTimeout()
  }
}