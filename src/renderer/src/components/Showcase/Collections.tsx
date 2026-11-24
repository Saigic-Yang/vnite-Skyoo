import { NSFWFilterMode } from '@appTypes/models'
import { SeparatorDashed } from '@ui/separator-dashed'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfigState } from '~/hooks'
import { useEffectiveLibraryBarWidth } from '~/hooks/useShowLibrarybar'
import { useGameCollectionStore } from '~/stores'
import { useVisibleGameIds } from '~/stores/game'
import { cn } from '~/utils'
import { CollectionPoster } from './posters/CollectionPoster'
import { TwoRowStrip } from './TwoRowStrip'

/**
 * 我的收藏：两行显示 + 底部可拖动导航条（与「最近游戏」一致）
 */
export function Collections(): React.JSX.Element {
  const [nsfwFilterMode] = useConfigState('appearances.nsfwFilterMode')
  const collections = useGameCollectionStore((state) => state.documents)
  const visibleGameIds = useVisibleGameIds()
  const libraryBarWidth = useEffectiveLibraryBarWidth()
  const [configSidebarWidth] = useConfigState('appearances.sidebar.width')
  const sidebarWidth = Math.max(56, Number(configSidebarWidth) || 56)
  const visibleGameIdSet = useMemo(() => new Set(visibleGameIds), [visibleGameIds])

  const sortedCollectionIds = useMemo(() => {
    return Object.values(collections)
      .sort((a, b) => a.sort - b.sort)
      .map((collection) => collection._id)
      .filter((id) => collections[id]?.games.some((gameId) => visibleGameIdSet.has(gameId)))
  }, [collections, visibleGameIdSet])

  const { t } = useTranslation('game')

  return (
    <div
      className={cn('flex flex-col gap-1')}
      style={{
        width: `calc(100vw - ${libraryBarWidth + sidebarWidth + 4 - (libraryBarWidth === 0 ? 1 : 0)}px)`
      }}
    >
      <div className={cn('flex flex-row items-center gap-5 justify-center pl-10')}>
        <div className={cn('text-accent-foreground select-none flex-shrink-0')}>
          {t('showcase.sections.collections')}
        </div>
        <SeparatorDashed className="border-border" />
      </div>

      {sortedCollectionIds.length === 0 ? (
        <div className="text-muted-foreground text-sm pl-5">
          {t('showcase.collection.noCollections')}
        </div>
      ) : (
        <TwoRowStrip
          ids={sortedCollectionIds}
          renderItem={(collectionId, index) => (
            <CollectionPoster
              collectionId={collectionId}
              parentGap={32}
              position={
                (index === 0 && 'left') ||
                (index === sortedCollectionIds.length - 1 && 'right') ||
                'center'
              }
              dragScenario={
                nsfwFilterMode === NSFWFilterMode.All ? 'reorder-collections' : undefined
              }
            />
          )}
        />
      )}
    </div>
  )
}
