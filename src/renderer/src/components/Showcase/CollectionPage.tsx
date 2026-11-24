
import { NSFWFilterMode } from '@appTypes/models'
import { SeparatorDashed } from '@ui/separator-dashed'
import { ScrollArea } from '@ui/scroll-area'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDragScroll } from '~/hooks/useDragScroll'
import { useGameBatchEditorStore } from '~/components/GameBatchEditor/store'
import { useConfigState } from '~/hooks'
import { useEffectiveLibraryBarWidth } from '~/hooks/useShowLibrarybar'
import { useGameDetailTabStore } from '~/components/Game/store'
import { useGameCollectionStore } from '~/stores'
import { useInlineDetailStore } from '~/stores/inlineDetailStore'
import { useVisibleGameIds } from '~/stores/game'
import { cn } from '~/utils'
import { CollectionGamesComponent } from './CollectionGames'
import { InlineGameDetail } from './InlineGameDetail'
import { CollectionPoster } from './posters/CollectionPoster'

/** 收藏页：左侧收藏列表（两列）+ 右侧该收藏的游戏列表，点击游戏以悬浮层显示详情 */
export function CollectionPage(): React.JSX.Element {
  const { t } = useTranslation('game')
  const [nsfwFilterMode] = useConfigState('appearances.nsfwFilterMode')
  const collections = useGameCollectionStore((state) => state.documents)
  const visibleGameIds = useVisibleGameIds()
  const selectGames = useGameBatchEditorStore((state) => state.selectGames)

  const libraryBarWidth = useEffectiveLibraryBarWidth()
  const [configSidebarWidth] = useConfigState('appearances.sidebar.width')
  const sidebarWidth = Math.max(56, Number(configSidebarWidth) || 56)

  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('')
  // 搜索下拉选中的游戏：只在右栏内联展示，不覆盖左侧收藏列
  const inlineGameId = useInlineDetailStore((state) => state.gameId)
  const setInlineGameId = useInlineDetailStore((state) => state.setGameId)
  // 离开收藏页时关闭内联详情
  useEffect(() => () => setInlineGameId(null), [setInlineGameId])

  // 内联打开时强制回到「概览」标签（避免沿用上次停留的存档/记录页）
  const setLastDetailTab = useGameDetailTabStore((state) => state.setLastDetailTab)
  useEffect(() => {
    if (inlineGameId) setLastDetailTab('overview')
  }, [inlineGameId, setLastDetailTab])

  const visibleGameIdSet = useMemo(() => new Set(visibleGameIds), [visibleGameIds])
  const sortedCollectionIds = useMemo(
    () =>
      Object.values(collections)
        .sort((a, b) => a.sort - b.sort)
        .map((collection) => collection._id)
        .filter((id) => collections[id]?.games.some((gameId) => visibleGameIdSet.has(gameId))),
    [collections, visibleGameIdSet]
  )

  // 默认选中第一个收藏；收藏被删除后自动落到新的第一个
  useEffect(() => {
    if (sortedCollectionIds.length === 0) {
      setSelectedCollectionId('')
      return
    }
    if (!selectedCollectionId || !sortedCollectionIds.includes(selectedCollectionId)) {
      setSelectedCollectionId(sortedCollectionIds[0])
    }
  }, [sortedCollectionIds, selectedCollectionId])

  // Ctrl+A 全选（详情悬浮层打开时不响应）
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const dialogActive = document.querySelector('[role="dialog"]') !== null
      if (dialogActive) return
      if (event.ctrlKey && event.key === 'a') {
        event.preventDefault()
        selectGames(visibleGameIds)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectGames, visibleGameIds])

  // 左侧列表：拖动排序交给 dnd-kit（pointer 拖动会与之冲突，故此层不接管）
  const leftScrollRef = useRef<HTMLDivElement>(null)
  const rightColumnRef = useRef<HTMLDivElement>(null)
  useWindowDragScroll(rightColumnRef, 'y')

  return (
    <div
      className={cn('flex flex-row gap-5 h-full bg-transparent select-none')}
      style={{
        width: `calc(100vw - ${libraryBarWidth + sidebarWidth + 4 - (libraryBarWidth === 0 ? 1 : 0)}px)`
      }}
    >
      {/* 左：我的收藏（两列正方形卡片，可滚动 / 拖动） */}
      <div className="flex flex-col w-[340px] shrink-0 h-full pt-4 pb-2">
        <div className="flex flex-row items-center gap-4 px-5 mb-2">
          <div className="text-accent-foreground shrink-0">{t('showcase.sections.collections')}</div>
          <SeparatorDashed className="border-border" />
        </div>
        <div ref={leftScrollRef} className="flex-1 min-h-0">
          <ScrollArea className="h-full w-full">
            <div className="grid grid-cols-2 gap-4 px-5 pb-6 pt-2">
              {sortedCollectionIds.map((collectionId) => (
                <div key={`${collectionId}_${nsfwFilterMode}`} className="rounded-lg">
                  <CollectionPoster
                    collectionId={collectionId}
                    square
                    active={selectedCollectionId === collectionId}
                    onOpen={(id) => {
                      // 无论右栏是否正在显示详情，点左侧分类都直接切到该分类的游戏网格
                      setInlineGameId(null)
                      setSelectedCollectionId(id)
                    }}
                    // 恢复「拖动卡片改变收藏顺序」
                    dragScenario={
                      nsfwFilterMode === NSFWFilterMode.All ? 'reorder-collections' : undefined
                    }
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* 右：所选收藏里的游戏（不跳页）。window 捕获监听保证卡片区也能长按拖动 */}
      <div ref={rightColumnRef} className="relative flex flex-col flex-1 min-w-0 h-full pt-4 pb-2">
        {/* 右栏内容：选中游戏时直接在这里渲染原详情页（替换内容，不叠浮层） */}
        <div className="flex-1 min-h-0 relative">
          {inlineGameId ? (
            <InlineGameDetail gameId={inlineGameId} onClose={() => setInlineGameId(null)} />
          ) : selectedCollectionId ? (
            <CollectionGamesComponent
              collectionId={selectedCollectionId}
              scrollPosition={{ x: 0, y: 0 }}
              onOpenGame={(gameId) => setInlineGameId(gameId)}
            />
          ) : (
            <div className="text-sm text-muted-foreground px-5">暂无收藏</div>
          )}
        </div>
      </div>
    </div>
  )
}
