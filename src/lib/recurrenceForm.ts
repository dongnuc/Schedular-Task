import { getISODay } from 'date-fns'
import { fromKey } from './dates'
import type { RecurrenceType, Task, TaskInput } from './types'

/** Trạng thái form của khối "Lặp lại" (dùng chung cho thêm/sửa/thêm nhiều/lặp lại trong tương lai). */
export interface RecurrenceValue {
  type: RecurrenceType
  interval: number
  /** ISO weekday 1=T2 … 7=CN (dùng khi type = weekly). */
  days: number[]
  /** yyyy-MM-dd, '' = lặp mãi mãi. */
  end: string
}

export const emptyRecurrence = (): RecurrenceValue => ({ type: 'none', interval: 1, days: [], end: '' })

export const recurrenceFromTask = (t: Task): RecurrenceValue => ({
  type: t.recurrence_type,
  interval: t.recurrence_interval,
  days: t.recurrence_days,
  end: t.recurrence_end ?? '',
})

type RecurrenceFields = Pick<
  TaskInput,
  'recurrence_type' | 'recurrence_interval' | 'recurrence_days' | 'recurrence_end'
>

/** Chuyển sang cột DB. Weekly mà chưa chọn thứ nào → lặp theo thứ của ngày bắt đầu. */
export function toRecurrenceFields(v: RecurrenceValue, startDate: string): RecurrenceFields {
  if (v.type === 'none') {
    return { recurrence_type: 'none', recurrence_interval: 1, recurrence_days: [], recurrence_end: null }
  }
  const days =
    v.type === 'weekly'
      ? [...(v.days.length ? v.days : [getISODay(fromKey(startDate))])].sort((a, b) => a - b)
      : []
  return {
    recurrence_type: v.type,
    recurrence_interval: Math.max(1, Math.floor(v.interval) || 1),
    recurrence_days: days,
    recurrence_end: v.end || null,
  }
}

export function validateRecurrence(v: RecurrenceValue, startDate: string): string | null {
  if (v.type !== 'none' && v.end && v.end < startDate) {
    return 'Ngày kết thúc lặp phải sau ngày bắt đầu.'
  }
  return null
}
