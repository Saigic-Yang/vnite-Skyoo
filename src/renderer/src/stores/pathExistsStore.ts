import { create } from 'zustand'
import { ipcManager } from '~/app/ipc'

export interface GamePathState {
  /** 是否设置过本地路径 */
  hasPath: boolean
  /** 本地文件是否仍然存在 */
  exists: boolean
}

const STORAGE_KEY = 'skyoo:game-paths'

function loadPersisted(): Record<string, GamePathState> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, GamePathState>) : {}
  } catch {
    return {}
  }
}

function persist(map: Record<string, GamePathState>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // 忽略存储失败
  }
}

interface PathExistsState {
  /** 游戏 id → 本地文件状态（点击时检查并记忆，不做全局遍历） */
  gamePaths: Record<string, GamePathState>
  /** 重新检查某个游戏并把结果记住 */
  recheck: (gameId: string) => Promise<boolean>
}

export const usePathExistsStore = create<PathExistsState>((set, get) => ({
  gamePaths: loadPersisted(),

  async recheck(gameId: string): Promise<boolean> {
    try {
      const result = await ipcManager.invoke('system:check-game-paths', [gameId])
      const state = result[gameId]
      const next = { ...get().gamePaths, ...result }
      set({ gamePaths: next })
      persist(next)
      return Boolean(state?.exists)
    } catch {
      return true
    }
  }
}))
