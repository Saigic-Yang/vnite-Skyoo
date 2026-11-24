import { create } from 'zustand'

interface InlineDetailState {
  /** 在收藏页右栏内联展示的游戏（null = 关闭） */
  gameId: string | null
  setGameId: (gameId: string | null) => void
}

export const useInlineDetailStore = create<InlineDetailState>((set) => ({
  gameId: null,
  setGameId: (gameId) => set({ gameId })
}))
