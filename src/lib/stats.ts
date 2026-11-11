import { format } from 'date-fns'
import type { DayItem } from './types'

/** Việc chưa xong mà đã quá hạn (ngày trước hôm nay, hoặc hôm nay đã qua giờ kết thúc/bắt đầu). */
export function isOverdue(it: DayItem, now = new Date()): boolean {
  if (it.status === 'done' || it.status === 'skipped') return false
  const today = format(now, 'yyyy-MM-dd')
  if (it.date < today) return true
  if (it.date > today) return false
  const t = it.task.end_time ?? it.task.start_time
  if (!t) return false
  return `${it.date}T${t}` < format(now, "yyyy-MM-dd'T'HH:mm:ss")
}

/** Hoàn thành trước giờ kết thúc (hoặc trong ngày nếu không có giờ kết thúc). */
function isOnTime(it: DayItem): boolean {
  const done = it.occurrence?.completed_at
  if (!done) return true
  const deadline = new Date(`${it.date}T${it.task.end_time ?? '23:59:59'}`)
  return new Date(done) <= deadline
}

export interface Summary {
  total: number
  done: number
  inProgress: number
  pending: number
  skipped: number
  overdue: number
  /** Số việc hoàn thành đúng hạn. */
  onTime: number
  /** % công việc hoàn thành trên tổng số (không tính việc đã bỏ qua). */
  completionRate: number
  /** Tiến độ trung bình (0-100) của các việc không bị bỏ qua. */
  avgProgress: number
  avgRating: number | null
  /** % việc hoàn thành đúng hạn trên số việc đã hoàn thành. */
  onTimeRate: number | null
}

export function summarize(items: DayItem[], now = new Date()): Summary {
  let done = 0
  let inProgress = 0
  let pending = 0
  let skipped = 0
  let overdue = 0
  let onTime = 0
  let progressSum = 0
  let ratingSum = 0
  let ratingCount = 0

  for (const it of items) {
    if (it.status === 'skipped') {
      skipped++
      continue
    }
    if (it.status === 'done') {
      done++
      if (isOnTime(it)) onTime++
    } else {
      if (it.status === 'in_progress') inProgress++
      else pending++
      if (isOverdue(it, now)) overdue++
    }
    progressSum += it.progress
    if (it.occurrence?.rating) {
      ratingSum += it.occurrence.rating
      ratingCount++
    }
  }

  const counted = items.length - skipped
  return {
    total: items.length,
    done,
    inProgress,
    pending,
    skipped,
    overdue,
    onTime,
    completionRate: counted ? Math.round((done / counted) * 100) : 0,
    avgProgress: counted ? Math.round(progressSum / counted) : 0,
    avgRating: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    onTimeRate: done ? Math.round((onTime / done) * 100) : null,
  }
}

/** Chênh lệch % giữa hai giá trị; null nếu kỳ trước không có dữ liệu. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 100)
}
