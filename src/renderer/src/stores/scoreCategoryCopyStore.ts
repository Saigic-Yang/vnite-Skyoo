import { create } from 'zustand'

export interface CategoryCopy {
  title?: string
  description?: string
  titleHistory: string[]
  descriptionHistory: string[]
}

const STORAGE_KEY = 'skyoo:score-category-copy'
const HISTORY_LIMIT = 4

function load(): Record<string, CategoryCopy> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, CategoryCopy>) : {}
  } catch {
    return {}
  }
}

function persist(map: Record<string, CategoryCopy>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function pushHistory(history: string[], value: string): string[] {
  if (!value) return history
  return [value, ...history.filter((item) => item !== value)].slice(0, HISTORY_LIMIT)
}

interface State {
  copies: Record<string, CategoryCopy>
  getCopy: (id: string) => CategoryCopy | undefined
  /** 保存自定义标题与说明，并把旧值压入历史（各自最多保留 4 条） */
  saveCopy: (id: string, next: { title: string; description: string }, current: { title: string; description: string }) => void
}

export const useScoreCategoryCopyStore = create<State>((set, get) => ({
  copies: load(),

  getCopy: (id) => get().copies[id],

  saveCopy: (id, next, current) => {
    const prev = get().copies[id] ?? {
      titleHistory: [],
      descriptionHistory: []
    }

    const titleHistory =
      next.title !== current.title
        ? pushHistory(prev.titleHistory, current.title)
        : prev.titleHistory
    const descriptionHistory =
      next.description !== current.description
        ? pushHistory(prev.descriptionHistory, current.description)
        : prev.descriptionHistory

    const nextCopies: Record<string, CategoryCopy> = {
      ...get().copies,
      [id]: {
        title: next.title || undefined,
        description: next.description || undefined,
        titleHistory,
        descriptionHistory
      }
    }
    set({ copies: nextCopies })
    persist(nextCopies)
  }
}))
