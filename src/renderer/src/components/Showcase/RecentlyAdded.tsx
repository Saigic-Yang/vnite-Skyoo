import { SeparatorDashed } from '@ui/separator-dashed'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfigState } from '~/hooks'
import { useEffectiveLibraryBarWidth } from '~/hooks/useShowLibrarybar'
import { useGameRegistry, useVisibleGameIds } from '~/stores/game'
import { getRecentlyAddedGames } from '~/stores/game/recordUtils'
import { cn } from '~/utils'
import { GamePoster } from './posters/GamePoster'
import { TwoRowStrip } from './TwoRowStrip'

const COUNT = 18

/** 最近入库：固定显示最近添加的 14 个游戏，两行 + 可拖动导航条 */
export function RecentlyAdded(): React.JSX.Element {
  const visibleGameIds = useVisibleGameIds()
  const gameIds = useGameRegistry((state) => state.gameIds)
  const libraryBarWidth = useEffectiveLibraryBarWidth()
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
        // 固定两行（18 个 → 每行 9 个），间距与最爱玩/未收藏一致
        <TwoRowStrip
          ids={ids}
          itemGap={20}
          rowGap={20}
          renderItem={(id) => <GamePoster gameId={id} />}
        />
      )}
    </div>
  )
}
