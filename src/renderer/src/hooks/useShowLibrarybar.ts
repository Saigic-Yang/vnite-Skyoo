import { useRouterState } from '@tanstack/react-router'
import { useLibraryStore } from '~/pages/Library/store'

/**
 * 左侧游戏列表侧栏是否显示。
 * 只在「所有游戏」页与游戏详情页显示；主页、收藏页隐藏，把空间让给卡片。
 */
export function useShowLibrarybar(): boolean {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  if (pathname.startsWith('/library/home')) return false
  if (pathname.startsWith('/library/collections')) return false
  // 游戏详情页也不显示左侧列表，把整屏让给详情内容
  if (pathname.includes('/library/games/')) return false
  return true
}

/** 布局用的有效侧栏宽度（隐藏时为 0，避免内容被减窄） */
export function useEffectiveLibraryBarWidth(): number {
  const width = useLibraryStore((state) => state.libraryBarWidth)
  const show = useShowLibrarybar()
  return show ? width : 0
}
