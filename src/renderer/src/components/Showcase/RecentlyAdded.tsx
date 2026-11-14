import { SeparatorDashed } from '@ui/separator-dashed'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfigState } from '~/hooks'
import { useLibraryStore } from '~/pages/Library/store'
import { useGameRegistry, useVisibleGameIds } from '~/stores/game'
import { getRecentlyAddedGames } from '~/stores/game/recordUtils'
import { cn } from '~/utils'
import { GamePoster } from './posters/GamePoster'
import { TwoRowStrip } from './TwoRowStrip'

const COUNT = 14

/** 最近入库：固定显示最近添加的 14 个游戏，两行 + 可拖动导航条 */
export function RecentlyAdded(): React.JSX.Element {
  const visibleGameIds = useVisibleGameIds()
  const gameIds = useGameRegistry((state) => state.gameIds)
  const libraryBarWidth = useLibraryStore((state) => state.libraryBarWidth)
  const [configSidebarWidth] = useConfigState('appearances.sidebar.width')
  const sidebarWidth = Math.max(56, Number(configSidebarWidth) || 56)
  const { t } = useTranslation('game')

  const ids = useMemo(() => {
    const visible = new Set(visibleGameIds)
    return getRecentlyAddedGames(300)
      .filter((id) => visible.has(id))
      .slice(0, COUNT)
  }, [visibleGameIds, gameIds])

  return (
    <div
      className={cn('flex flex-col gap-1')}
      style={{
        width: `calc(100vw - ${libraryBarWidth + sidebarWidth + 4 - (libraryBarWidth === 0 ? 1 : 0)}px)`
      }}
    >
      <div className={cn('flex flex-row items-center gap-5 justify-center pl-10')}>
        <div className={cn('text-accent-foreground select-none flex-shrink-0')}>
          {t('showcase.sections.recentlyAdded')}
        </div>
        <SeparatorDashed className="border-border" />
      </div>

      {ids.length === 0 ? (
        <div className="text-muted-foreground text-sm pl-5">
          {t('showcase.recentlyAdded.empty')}
        </div>
      ) : (
        // itemGap 与「我的收藏」保持一致（32），保证两处第 N 张卡在同一条竖线上
        <TwoRowStrip ids={ids} renderItem={(id) => <GamePoster gameId={id} />} />
      )}
    </div>
  )
}
