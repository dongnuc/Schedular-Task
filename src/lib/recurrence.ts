import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  getDate,
  getDaysInMonth,
  getISODay,
  parseISO,
} from 'date-fns'
import type { Task } from './types'

/**
 * Công việc có diễn ra vào ngày `dateStr` (yyyy-MM-dd) không?
 * Logic phải khớp với hàm SQL public.task_occurs_on (dùng cho thông báo Telegram).
 */
export function occursOn(task: Task, dateStr: string): boolean {
  if (dateStr < task.start_date) return false
  if (task.recurrence_end && dateStr > task.recurrence_end) return false

  const start = parseISO(task.start_date)
  const d = parseISO(dateStr)
  const interval = Math.max(1, task.recurrence_interval)

  switch (task.recurrence_type) {
    case 'none':
      return dateStr === task.start_date
    case 'daily':
      return differenceInCalendarDays(d, start) % interval === 0
    case 'weekly': {
      const days = task.recurrence_days.length ? task.recurrence_days : [getISODay(start)]
      if (!days.includes(getISODay(d))) return false
      return differenceInCalendarWeeks(d, start, { weekStartsOn: 1 }) % interval === 0
    }
    case 'monthly': {
      const targetDay = Math.min(getDate(start), getDaysInMonth(d))
      if (getDate(d) !== targetDay) return false
      return differenceInCalendarMonths(d, start) % interval === 0
    }
    default:
      return false
  }
}

const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export function describeRecurrence(task: Task): string | null {
  const n = task.recurrence_interval
  switch (task.recurrence_type) {
    case 'daily':
      return n === 1 ? 'Hằng ngày' : `Mỗi ${n} ngày`
    case 'weekly': {
      const days = (task.recurrence_days.length
        ? [...task.recurrence_days].sort()
        : [getISODay(parseISO(task.start_date))]
      )
        .map((d) => WEEKDAY_SHORT[d - 1])
        .join(', ')
      return `${n === 1 ? 'Hằng tuần' : `Mỗi ${n} tuần`} (${days})`
    }
    case 'monthly':
      return `${n === 1 ? 'Hằng tháng' : `Mỗi ${n} tháng`} (ngày ${getDate(parseISO(task.start_date))})`
    default:
      return null
  }
}
