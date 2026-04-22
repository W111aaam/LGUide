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
  const durationSeconds = 1.6
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
    const phaseTime = time % 0.4
    const frequency = Math.floor(time / 0.4) % 2 === 0 ? 880 : 660
    const gate = phaseTime < 0.24 ? 1 : 0
    const envelope = Math.max(0, 1 - time / durationSeconds)
    const sample = gate * Math.sin(2 * Math.PI * frequency * time) * envelope * 0.45
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

export function playAlarmSound(audioElement, enabled) {
  if (!enabled || !audioElement) {
    return
  }

  try {
    audioElement.currentTime = 0
    const playResult = audioElement.play()
    if (playResult?.catch) {
      playResult.catch(() => {})
    }
  } catch {
    // Ignore autoplay failures and keep popup reminders working.
  }
}

export function showWebPopup(title, message) {
  if (typeof window === 'undefined') {
    return
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      tag: `lguide-${title}`,
    })
    return
  }

  window.alert(message ? `${title}\n${message}` : title)
}