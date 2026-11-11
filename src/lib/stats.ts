import type { DayItem } from './types'

export interface Summary {
  total: number
  done: number
  inProgress: number
  pending: number
  skipped: number
  /** % công việc hoàn thành trên tổng số (không tính việc đã bỏ qua). */
  completionRate: number
  /** Tiến độ trung bình (0-100) của các việc không bị bỏ qua. */
  avgProgress: number
  avgRating: number | null
}

export function summarize(items: DayItem[]): Summary {
  let done = 0
  let inProgress = 0
  let pending = 0
  let skipped = 0
  let progressSum = 0
  let ratingSum = 0
  let ratingCount = 0

  for (const it of items) {
    if (it.status === 'skipped') {
      skipped++
      continue
    }
    if (it.status === 'done') done++
    else if (it.status === 'in_progress') inProgress++
    else pending++
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
    completionRate: counted ? Math.round((done / counted) * 100) : 0,
    avgProgress: counted ? Math.round(progressSum / counted) : 0,
    avgRating: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
  }
}
