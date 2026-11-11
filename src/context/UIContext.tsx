import { createContext, useContext } from 'react'
import type { DayItem, Task } from '../lib/types'

export interface UIValue {
  openTaskForm: (opts?: { task?: Task; date?: string }) => void
  openOccurrence: (item: DayItem) => void
}

export const UIContext = createContext<UIValue | null>(null)

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside Layout')
  return ctx
}
