/**
 * 解析 .ics 文件文本，返回符合本项目 course 数据结构的数组。
 *
 * 当前限制：
 * - 不处理 RRULE 重复规则：每条 VEVENT 对应一门课（一个时间点），
 *   若学校将"每周循环"导出为带 RRULE 的单条事件，只会取 DTSTART 的那一天。
 * - 假定时间使用中国本地时间（UTC+8），带 Z 后缀的时间也按本地处理。
 * - 全天事件（无 T 时间分量的 DTSTART）会被跳过。
 * - 假定文件为 UTF-8 编码；GBK 编码的中文会出现乱码。
 */

// ICS 规范允许折行：CRLF + 行首空白字符表示续行，先展开
function unfold(text) {
  return text
    .replace(/\r\n[ \t]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

// 将 ICS 时间值（如 20250901T080000 或 20250901T080000Z）解析为 Date
function parseDTValue(valueStr) {
  const s = valueStr.trim().replace('Z', '') // 去掉 UTC 标记，按本地时间处理
  if (!s.includes('T')) return null          // 全天事件，跳过
  const [datePart, timePart] = s.split('T')
  if (!datePart || !timePart || datePart.length < 8) return null
  const year  = parseInt(datePart.slice(0, 4))
  const month = parseInt(datePart.slice(4, 6)) - 1 // Date 月份 0-indexed
  const day   = parseInt(datePart.slice(6, 8))
  const hour  = parseInt(timePart.slice(0, 2))
  const min   = parseInt(timePart.slice(2, 4))
  if ([year, month, day, hour, min].some(isNaN)) return null
  return new Date(year, month, day, hour, min)
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

// 从 DESCRIPTION 字段尝试提取教师姓名
function extractTeacher(desc) {
  if (!desc) return ''
  const m = desc.match(
    /(?:教师|任课教师|主讲教师|老师)[：:]\s*([^\n\r,，；;/\\、]+)/
  )
  return m ? m[1].trim() : ''
}

/**
 * @param {string} icsText - 单个 .ics 文件的文本内容
 * @returns {Array} course 对象数组（结构与 localStorage 中的课程一致）
 */
export function parseIcsEvents(icsText) {
  const lines = unfold(icsText).split('\n')
  const courses = []
  let inEvent = false
  let cur = {}

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      cur = {}
      continue
    }

    if (line === 'END:VEVENT') {
      inEvent = false
      const startDate = cur.dtstart ? parseDTValue(cur.dtstart) : null
      if (startDate) {
        const endDate = cur.dtend ? parseDTValue(cur.dtend) : null
        courses.push({
          id: crypto.randomUUID(),
          courseName: (cur.summary || '未命名课程').trim(),
          dayOfWeek: startDate.getDay(), // 0=周日 … 6=周六，与 Date.getDay() 一致
          startTime: `${pad2(startDate.getHours())}:${pad2(startDate.getMinutes())}`,
          endTime: endDate
            ? `${pad2(endDate.getHours())}:${pad2(endDate.getMinutes())}`
            : '',
          location: (cur.location || '').trim(),
          teacher: extractTeacher(cur.description),
          note: '',
        })
      }
      continue
    }

    if (!inEvent) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx < 0) continue

    // 属性名取冒号前、首个分号前的部分（忽略 ;TZID= 等参数）
    const propName  = line.slice(0, colonIdx).split(';')[0].toUpperCase()
    const propValue = line.slice(colonIdx + 1)

    if      (propName === 'SUMMARY')     cur.summary     = propValue
    else if (propName === 'DTSTART')     cur.dtstart     = propValue
    else if (propName === 'DTEND')       cur.dtend       = propValue
    else if (propName === 'LOCATION')    cur.location    = propValue
    else if (propName === 'DESCRIPTION') cur.description = propValue
  }

  return courses
}
