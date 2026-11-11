export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly'
export type OccurrenceStatus = 'pending' | 'in_progress' | 'done' | 'skipped'

export interface Task {
  id: string
  user_id: string
  title: string
  description: string | null
  color: string
  priority: 1 | 2 | 3
  start_date: string // yyyy-MM-dd
  start_time: string | null // HH:mm:ss
  end_time: string | null
  recurrence_type: RecurrenceType
  recurrence_interval: number
  recurrence_days: number[] // ISO weekday 1..7
  recurrence_end: string | null
  notify: boolean
  created_at: string
  updated_at: string
}

export type TaskInput = Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>

export interface Occurrence {
  id: string
  task_id: string
  user_id: string
  occurrence_date: string
  status: OccurrenceStatus
  progress: number
  result_note: string | null
  rating: number | null
  completed_at: string | null
}

export type OccurrencePatch = Partial<
  Pick<Occurrence, 'status' | 'progress' | 'result_note' | 'rating'>
>

export interface Profile {
  id: string
  telegram_chat_id: string | null
  timezone: string
  notify_enabled: boolean
}

/** Một công việc tại một ngày cụ thể, kèm kết quả (nếu đã ghi nhận). */
export interface DayItem {
  task: Task
  date: string
  occurrence: Occurrence | undefined
  status: OccurrenceStatus
  progress: number
}
