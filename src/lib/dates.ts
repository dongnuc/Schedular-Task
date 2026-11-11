import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { vi } from 'date-fns/locale'

export const toKey = (d: Date) => format(d, 'yyyy-MM-dd')
export const fromKey = (s: string) => parseISO(s)
export const todayKey = () => toKey(new Date())
export const shiftKey = (s: string, days: number) => toKey(addDays(fromKey(s), days))

export const weekStart = (d: Date) => startOfWeek(d, { weekStartsOn: 1 })
export const weekEnd = (d: Date) => endOfWeek(d, { weekStartsOn: 1 })

export function daysBetween(from: Date, to: Date): string[] {
  return eachDayOfInterval({ start: from, end: to }).map(toKey)
}

export const weekDays = (d: Date) => daysBetween(weekStart(d), weekEnd(d))

/** Lưới lịch tháng (đủ tuần, bắt đầu từ thứ 2). */
export const monthGrid = (d: Date) =>
  daysBetween(weekStart(startOfMonth(d)), weekEnd(endOfMonth(d)))

export const monthDays = (d: Date) => daysBetween(startOfMonth(d), endOfMonth(d))

export const fmt = (d: Date | string, pattern: string) =>
  format(typeof d === 'string' ? fromKey(d) : d, pattern, { locale: vi })

export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')

export function timeRange(start: string | null, end: string | null): string {
  if (!start) return 'Cả ngày'
  return end ? `${hhmm(start)} – ${hhmm(end)}` : hhmm(start)
}
