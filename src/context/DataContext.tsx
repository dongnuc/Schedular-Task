import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { occursOn } from '../lib/recurrence'
import type { DayItem, Occurrence, OccurrencePatch, Task, TaskInput } from '../lib/types'

type OccMap = Record<string, Occurrence>
const occKey = (taskId: string, date: string) => `${taskId}|${date}`

interface DataValue {
  tasks: Task[]
  loading: boolean
  error: string | null
  clearError: () => void
  /** Tải kết quả thực hiện trong khoảng ngày (bỏ qua nếu đã tải). */
  ensureRange: (from: string, to: string) => void
  itemsForDate: (date: string) => DayItem[]
  itemsForDates: (dates: string[]) => DayItem[]
  saveTask: (input: TaskInput, id?: string) => Promise<boolean>
  /** Tạo nhiều công việc trong một lần (một request, tất cả hoặc không). */
  saveTasks: (inputs: TaskInput[]) => Promise<boolean>
  deleteTask: (id: string) => Promise<boolean>
  updateOccurrence: (taskId: string, date: string, patch: OccurrencePatch) => Promise<boolean>
  /** Gia hạn một lần việc sang ngày `target`; tạo việc mới ở ngày đó ghi rõ nguồn gốc. */
  postponeOccurrence: (taskId: string, date: string, target: string) => Promise<boolean>
}

const POSTPONE_ERRORS: Record<string, string> = {
  already_done: 'Việc này đã hoàn thành nên không thể gia hạn.',
  target_must_be_after_date: 'Ngày gia hạn phải sau ngày hiện tại của việc.',
  task_not_on_date: 'Việc này không diễn ra vào ngày đã chọn.',
}

const DataContext = createContext<DataValue | null>(null)

const PAGE = 1000

async function fetchOccurrences(from: string, to: string): Promise<Occurrence[]> {
  const rows: Occurrence[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('task_occurrences')
      .select('*')
      .gte('occurrence_date', from)
      .lte('occurrence_date', to)
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    rows.push(...(data as Occurrence[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

/** Chuẩn hoá status/progress để hai trường luôn nhất quán. */
function normalizePatch(current: Occurrence | undefined, patch: OccurrencePatch): OccurrencePatch {
  const next: OccurrencePatch = { ...patch }
  if (patch.status === 'done') next.progress = 100
  else if (patch.status === 'pending') next.progress = 0
  else if (patch.status === 'in_progress' && patch.progress === undefined) {
    const p = current?.progress ?? 0
    next.progress = p >= 100 ? 50 : p
  } else if (patch.progress !== undefined && patch.status === undefined) {
    if (patch.progress >= 100) next.status = 'done'
    else if (patch.progress > 0) next.status = 'in_progress'
    else next.status = 'pending'
  }
  return next
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [occ, setOcc] = useState<OccMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedRanges = useRef(new Set<string>())

  useEffect(() => {
    supabase
      .from('tasks')
      .select('*')
      .order('start_time', { nullsFirst: true })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setTasks(data as Task[])
        setLoading(false)
      })
  }, [])

  const ensureRange = useCallback((from: string, to: string) => {
    const key = `${from}:${to}`
    if (loadedRanges.current.has(key)) return
    loadedRanges.current.add(key)
    fetchOccurrences(from, to)
      .then((rows) =>
        setOcc((prev) => {
          const next = { ...prev }
          for (const r of rows) next[occKey(r.task_id, r.occurrence_date)] = r
          return next
        }),
      )
      .catch((e: Error) => {
        loadedRanges.current.delete(key)
        setError(e.message)
      })
  }, [])

  const itemsForDate = useCallback(
    (date: string): DayItem[] =>
      tasks
        .filter((t) => occursOn(t, date))
        .map((task) => {
          const occurrence = occ[occKey(task.id, date)]
          return {
            task,
            date,
            occurrence,
            status: occurrence?.status ?? 'pending',
            progress: occurrence?.progress ?? 0,
          }
        })
        .sort((a, b) =>
          (a.task.start_time ?? '').localeCompare(b.task.start_time ?? '') ||
          b.task.priority - a.task.priority,
        ),
    [tasks, occ],
  )

  const itemsForDates = useCallback(
    (dates: string[]) => dates.flatMap(itemsForDate),
    [itemsForDate],
  )

  const saveTask = useCallback(async (input: TaskInput, id?: string) => {
    const query = id
      ? supabase.from('tasks').update(input).eq('id', id).select().single()
      : supabase.from('tasks').insert(input).select().single()
    const { data, error } = await query
    if (error) {
      setError(error.message)
      return false
    }
    const saved = data as Task
    setTasks((prev) => (id ? prev.map((t) => (t.id === id ? saved : t)) : [...prev, saved]))
    return true
  }, [])

  const saveTasks = useCallback(async (inputs: TaskInput[]) => {
    if (inputs.length === 0) return true
    const { data, error } = await supabase.from('tasks').insert(inputs).select()
    if (error) {
      setError(error.message)
      return false
    }
    setTasks((prev) => [...prev, ...(data as Task[])])
    return true
  }, [])

  const postponeOccurrence = useCallback(async (taskId: string, date: string, target: string) => {
    const { error } = await supabase.rpc('postpone_occurrence', {
      p_task_id: taskId,
      p_date: date,
      p_target: target,
    })
    if (error) {
      setError(POSTPONE_ERRORS[error.message.trim()] ?? error.message)
      return false
    }
    // Tải lại danh sách việc (có việc mới ở ngày đích) và trạng thái của khoảng ngày liên quan.
    const [tasksRes, rows] = await Promise.all([
      supabase.from('tasks').select('*').order('start_time', { nullsFirst: true }),
      fetchOccurrences(date, target),
    ])
    if (!tasksRes.error) setTasks(tasksRes.data as Task[])
    setOcc((prev) => {
      const next = { ...prev }
      for (const r of rows) next[occKey(r.task_id, r.occurrence_date)] = r
      return next
    })
    return true
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return false
    }
    setTasks((prev) => prev.filter((t) => t.id !== id))
    return true
  }, [])

  const occRef = useRef(occ)
  occRef.current = occ

  const updateOccurrence = useCallback(
    async (taskId: string, date: string, patch: OccurrencePatch) => {
      const key = occKey(taskId, date)
      const current = occRef.current[key]
      const next = normalizePatch(current, patch)
      const becameDone = next.status === 'done' && current?.status !== 'done'
      const row = {
        task_id: taskId,
        occurrence_date: date,
        ...next,
        ...(next.status !== undefined && {
          completed_at:
            next.status === 'done'
              ? becameDone
                ? new Date().toISOString()
                : current?.completed_at ?? null
              : null,
        }),
      }

      // Cập nhật lạc quan, hoàn tác nếu lỗi.
      const base: Occurrence = current ?? {
        id: `tmp-${key}`,
        task_id: taskId,
        user_id: '',
        occurrence_date: date,
        status: 'pending',
        progress: 0,
        result_note: null,
        rating: null,
        completed_at: null,
        postponed_to: null,
      }
      setOcc((prev) => ({ ...prev, [key]: { ...base, ...row } }))

      const { data, error } = await supabase
        .from('task_occurrences')
        .upsert(row, { onConflict: 'task_id,occurrence_date' })
        .select()
        .single()

      if (error) {
        setError(error.message)
        setOcc((prev) => {
          const reverted = { ...prev }
          if (current) reverted[key] = current
          else delete reverted[key]
          return reverted
        })
        return false
      }
      setOcc((prev) => ({ ...prev, [key]: data as Occurrence }))
      return true
    },
    [],
  )

  const value = useMemo<DataValue>(
    () => ({
      tasks,
      loading,
      error,
      clearError: () => setError(null),
      ensureRange,
      itemsForDate,
      itemsForDates,
      saveTask,
      saveTasks,
      deleteTask,
      updateOccurrence,
      postponeOccurrence,
    }),
    [tasks, loading, error, ensureRange, itemsForDate, itemsForDates, saveTask, saveTasks, deleteTask, updateOccurrence, postponeOccurrence],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
