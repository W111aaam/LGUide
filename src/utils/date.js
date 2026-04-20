const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

function toShiftedBeijingDate(date = new Date()) {
  return new Date(date.getTime() + BEIJING_OFFSET_MS)
}

export function getBeijingDateString(date = new Date()) {
  const shiftedDate = toShiftedBeijingDate(date)
  const year = shiftedDate.getUTCFullYear()
  const month = String(shiftedDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shiftedDate.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getBeijingYear(date = new Date()) {
  return Number(getBeijingDateString(date).slice(0, 4))
}

export function getBeijingDayOfWeek(date = new Date()) {
  return toShiftedBeijingDate(date).getUTCDay()
}

export function getMillisecondsUntilNextBeijingMidnight(date = new Date()) {
  const shiftedDate = toShiftedBeijingDate(date)
  const nextMidnightUtcMs = Date.UTC(
    shiftedDate.getUTCFullYear(),
    shiftedDate.getUTCMonth(),
    shiftedDate.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  )

  return Math.max(1, nextMidnightUtcMs - shiftedDate.getTime())
}