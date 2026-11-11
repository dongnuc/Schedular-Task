import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { todayKey } from './dates'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Ngày đang xem, lưu trên URL (?d=yyyy-MM-dd) để dùng chung giữa các trang. */
export function useDateParam(): [string, (d: string) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('d')
  const date = raw && DATE_RE.test(raw) && !Number.isNaN(Date.parse(raw)) ? raw : todayKey()
  const setDate = useCallback(
    (d: string) => setParams(d === todayKey() ? {} : { d }, { replace: true }),
    [setParams],
  )
  return [date, setDate]
}
