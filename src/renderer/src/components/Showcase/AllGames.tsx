import { GAME_SORT_FIELDS } from '@appTypes/models'
import { observeElementOffset, useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { SeparatorDashed } from '@ui/separator-dashed'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GameNavCM } from '~/components/contextMenu/GameNavCM'
import { useWindowDragScroll } from '~/hooks/useDragScroll'
import { useEffectiveLibraryBarWidth } from '~/hooks/useShowLibrarybar'
import { useInlineDetailStore } from '~/stores/inlineDetailStore'
import { InlineGameDetail } from './InlineGameDetail'
import { ScrollNavButtons } from './ScrollNavButtons'
import { AddCollectionDialog } from '~/components/dialog/AddCollectionDialog'
import { PlayTimeEditorDialog } from '~/components/Game/Config/ManageMenu/PlayTimeEditorDialog'
import { GamePropertiesDialog } from '~/components/Game/Config/Properties'
import {
  GameSortFieldSelect,
  SecondarySortControl,
  SortDirectionButton
} from '~/components/Game/GameSortControl'
import { InformationDialog } from '~/components/Game/Overview/Information/InformationDialog'
import { CalculateStorageSizeDialog } from '~/components/Game/Overview/Record/CalculateStorageSizeDialog'
import { BatchGameNavCM } from '~/components/GameBatchEditor/BatchGameNavCM'
import { useGameBatchEditorStore } from '~/components/GameBatchEditor/store'
import { ContextMenu, ContextMenuTrigger } from '~/components/ui/context-menu'
import { useConfigState } from '~/hooks'
import { sortGames, useVisibleGameIds } from '~/stores/game'
import { cn } from '~/utils'
import {
  SHOWCASE_POSTER_CARD_WIDTH,
  SHOWCASE_POSTER_ITEM_OUTER_HEIGHT,
  SHOWCASE_POSTER_MIN_COLUMN_GAP,
  SHOWCASE_POSTER_ROW_GAP
} from './posterGridMetrics'
import { GamePoster } from './posters/GamePoster'

function getScrollViewport(element: HTMLElement | null): HTMLDivElement | null {
  const viewport = element?.closest('[data-slot="scroll-area-viewport"]')
  return viewport instanceof HTMLDivElement ? viewport : null
}

function chunkGamesByRow(gameIds: string[], columnCount: number): string[][] {
  const rows: string[][] = []

  for (let index = 0; index < gameIds.length; index += columnCount) {
    rows.push(gameIds.slice(index, index + columnCount))
  }

  return rows
}

// TanStack Router may restore the outer viewport scroll position before the virtualizer
// attaches. Emit the current offset once on attach so the first visible range matches the
// restored route position, then fall back to TanStack Virtual's normal scroll observer.
function observeScrollViewportOffset(
  instance: Virtualizer<HTMLDivElement, HTMLDivElement>,
  cb: (offset: number, isScrolling: boolean) => void
): void | (() => void) {
  const element = instance.scrollElement

  if (element) {
    const offset = instance.options.horizontal
      ? element.scrollLeft * ((instance.options.isRtl && -1) || 1)
      : element.scrollTop
    cb(offset, false)
  }

  return observeElementOffset(instance, cb)
}

export function AllGames(): React.JSX.Element {
  const [sort, setSort] = useConfigState('game.showcase.sort')
  const visibleGameIds = useVisibleGameIds()
  const games = sortGames(sort, visibleGameIds)
  const { t } = useTranslation('game')

  const [gridLayoutState, setGridLayoutState] = useState<{
    contentWidth: number
    scrollMargin: number
  }>({
    contentWidth: 0,
    scrollMargin: 0
  })
  const [scrollViewport, setScrollViewport] = useState<HTMLDivElement | null>(null)
  const [contextMenuGameId, setContextMenuGameId] = useState<string | null>(null)
  const [isAddCollectionDialogOpen, setIsAddCollectionDialogOpen] = useState(false)
  const [isPlayTimeEditorDialogOpen, setIsPlayTimeEditorDialogOpen] = useState(false)
  const [isInformationDialogOpen, setIsInformationDialogOpen] = useState(false)
  const [isPropertiesDialogOpen, setIsPropertiesDialogOpen] = useState(false)
  const [isStorageSizeDialogOpen, setIsStorageSizeDialogOpen] = useState(false)
  const isBatchMode = useGameBatchEditorStore((state) => state.isBatchMode)
  const measureFrameRef = useRef<number | null>(null)
  const pendingContextMenuGameIdRef = useRef<string | null>(null)
  const gridOuterRef = useRef<HTMLDivElement>(null)
  useWindowDragScroll(gridOuterRef, 'y')

  // 内联详情（不跳页）
  const inlineGameId = useInlineDetailStore((state) => state.gameId)
  const setInlineGameId = useInlineDetailStore((state) => state.setGameId)
  useEffect(() => () => setInlineGameId(null), [setInlineGameId])

  // 详情面板需要避开左侧列表，按可视区域定位
  const libraryBarWidth = useEffectiveLibraryBarWidth()
  const [configSidebarWidth] = useConfigState('appearances.sidebar.width')
  const sidebarWidth = Math.max(56, Number(configSidebarWidth) || 56)
  const rowsHostRef = useRef<HTMLDivElement>(null)
  const measureGridRef = useRef<() => void>(() => {})

  const columnCount = Math.max(
    1,
    Math.floor(
      (gridLayoutState.contentWidth + SHOWCASE_POSTER_MIN_COLUMN_GAP) /
        (SHOWCASE_POSTER_CARD_WIDTH + SHOWCASE_POSTER_MIN_COLUMN_GAP)
    )
  )
  const rows = useMemo(() => chunkGamesByRow(games, columnCount), [columnCount, games])
  const rowCount = rows.length

  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rowCount,
    estimateSize: () => SHOWCASE_POSTER_ITEM_OUTER_HEIGHT,
    gap: SHOWCASE_POSTER_ROW_GAP,
    getScrollElement: () => scrollViewport,
    observeElementOffset: observeScrollViewportOffset,
    overscan: 3,
    scrollMargin: gridLayoutState.scrollMargin,
    useFlushSync: false
  })

  measureGridRef.current = () => {
    const gridOuter = gridOuterRef.current
    const rowsHost = rowsHostRef.current

    if (!scrollViewport || !gridOuter || !rowsHost) {
      return
    }

    const gridStyle = window.getComputedStyle(gridOuter)
    const paddingLeft = parseFloat(gridStyle.paddingLeft) || 0
    const paddingRight = parseFloat(gridStyle.paddingRight) || 0
    const contentWidth = Math.max(0, gridOuter.clientWidth - paddingLeft - paddingRight)
    const rowsHostRect = rowsHost.getBoundingClientRect()
    const ancestorTop = scrollViewport.getBoundingClientRect().top
    const nextState = {
      contentWidth,
      scrollMargin: scrollViewport.scrollTop + (rowsHostRect.top - ancestorTop)
    }

    setGridLayoutState((prevState) => {
      if (
        prevState.contentWidth === nextState.contentWidth &&
        prevState.scrollMargin === nextState.scrollMargin
      ) {
        return prevState
      }

      return nextState
    })
  }

  // Resolve the outer scroll viewport once, then remeasure when container geometry changes.
  useLayoutEffect(() => {
    const gridOuter = gridOuterRef.current
    if (!gridOuter) return

    const scrollViewport = getScrollViewport(gridOuter)
    if (!scrollViewport) return
    setScrollViewport(scrollViewport)

    const scheduleMeasure = (): void => {
      if (measureFrameRef.current !== null) {
        cancelAnimationFrame(measureFrameRef.current)
      }

      measureFrameRef.current = requestAnimationFrame(() => {
        measureFrameRef.current = null
        measureGridRef.current()
      })
    }

    scheduleMeasure()
    const resizeObserver = new ResizeObserver(() => scheduleMeasure())
    resizeObserver.observe(gridOuter)
    resizeObserver.observe(scrollViewport)

    return (): void => {
      resizeObserver.disconnect()

      if (measureFrameRef.current !== null) {
        cancelAnimationFrame(measureFrameRef.current)
        measureFrameRef.current = null
      }
    }
  }, [])

  // After row/column structure changes, remeasure on the next frame to refresh layout offsets.
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => measureGridRef.current())

    return (): void => cancelAnimationFrame(frame)
  }, [columnCount, rowCount])

  const virtualRows = rowVirtualizer.getVirtualItems()

  // The shared trigger covers the whole grid area, so only allow the native
  // contextmenu event to reach Radix when a poster cell captured a game id.
  // Gap/blank-space right clicks are swallowed here instead of opening a menu.
  const handleGridContextMenu = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!pendingContextMenuGameIdRef.current) {
      event.preventDefault()
    }
  }

  return (
    <div className={cn('relative w-full flex flex-col gap-1')}>
      <div className={cn('flex flex-row items-center gap-5 justify-center px-5')}>
        <div className={cn('flex flex-row gap-5 items-center justify-center')}>
          <div className={cn('text-accent-foreground select-none flex-shrink-0')}>
            {t('showcase.sections.allGames')}
          </div>
          <div className={cn('flex flex-row gap-1 items-center justify-center select-none')}>
            <div className={cn('text-sm')}>{t('showcase.sorting.title')}</div>
            {/* Sort By */}
            <GameSortFieldSelect
              value={sort.by}
              fields={GAME_SORT_FIELDS}
              triggerClassName={cn('w-[130px] h-[26px] text-xs border-0')}
              onValueChange={(by) => {
                void setSort({
                  ...sort,
                  by,
                  secondary: sort.secondary?.by === by ? null : sort.secondary
                })
              }}
            />
          </div>
          {/* Toggle Order */}
          <SortDirectionButton
            order={sort.order}
            className={cn('h-[26px] w-[26px] -ml-3')}
            onOrderChange={(order) => {
              void setSort({ ...sort, order })
            }}
          />
          <SecondarySortControl
            primaryBy={sort.by}
            value={sort.secondary}
            fields={GAME_SORT_FIELDS}
            onValueChange={(secondary) => {
              void setSort({ ...sort, secondary })
            }}
          />
        </div>

        <SeparatorDashed className="border-border" />
      </div>

      {/* Game List Container */}
      {/* 上方留出放大空间，避免第一行卡片悬停时被裁掉 */}
      <div
        ref={gridOuterRef}
        className={cn('w-full pt-10 pl-6 pr-6 pb-6 cursor-grab active:cursor-grabbing')}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              ref={rowsHostRef}
              className={cn('w-full relative')}
              style={{ height: rowVirtualizer.getTotalSize() }}
              onContextMenuCapture={() => {
                pendingContextMenuGameIdRef.current = null
              }}
              onContextMenu={handleGridContextMenu}
            >
              {virtualRows.map((virtualRow) => {
                const rowGameIds = rows[virtualRow.index]
                if (!rowGameIds) return null

                const fillerCount = columnCount - rowGameIds.length

                return (
                  <div
                    key={virtualRow.key}
                    className={cn('absolute left-0 top-0 w-full')}
                    style={{
                      height: virtualRow.size,
                      transform: `translateY(${
                        virtualRow.start - rowVirtualizer.options.scrollMargin
                      }px)`
                    }}
                  >
                    <div
                      className={cn('flex items-start justify-between')}
                      style={{ height: SHOWCASE_POSTER_ITEM_OUTER_HEIGHT }}
                    >
                      {rowGameIds.map((gameId) => (
                        <div
                          key={gameId}
                          className={cn('flex-shrink-0')}
                          style={{ width: SHOWCASE_POSTER_CARD_WIDTH }}
                          onContextMenuCapture={() => {
                            pendingContextMenuGameIdRef.current = gameId
                            setContextMenuGameId(gameId)
                          }}
                        >
                          <GamePoster
                            gameId={gameId}
                            disableContextMenu={true}
                            onOpenDetail={(id) => setInlineGameId(id)}
                          />
                        </div>
                      ))}
                      {Array.from({ length: fillerCount }, (_, fillerIndex) => (
                        <div
                          key={`all-games-row-${virtualRow.index}-filler-${fillerIndex}`}
                          className={cn('pointer-events-none flex-shrink-0')}
                          style={{ width: SHOWCASE_POSTER_CARD_WIDTH }}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </ContextMenuTrigger>

          {isBatchMode ? (
            <BatchGameNavCM openAddCollectionDialog={() => setIsAddCollectionDialogOpen(true)} />
          ) : (
            contextMenuGameId && (
              <GameNavCM
                gameId={contextMenuGameId}
                openAddCollectionDialog={() => setIsAddCollectionDialogOpen(true)}
                openInformationEditorDialog={() => setIsInformationDialogOpen(true)}
                openPlayTimeEditorDialog={() => setIsPlayTimeEditorDialogOpen(true)}
                openStorageSizeEditorDialog={() => setIsStorageSizeDialogOpen(true)}
                openPropertiesDialog={() => setIsPropertiesDialogOpen(true)}
              />
            )
          )}
        </ContextMenu>
      </div>

      {contextMenuGameId && isAddCollectionDialogOpen && (
        <AddCollectionDialog
          gameIds={[contextMenuGameId]}
          setIsOpen={setIsAddCollectionDialogOpen}
        />
      )}
      {contextMenuGameId && isInformationDialogOpen && (
        <InformationDialog
          gameId={contextMenuGameId}
          isOpen={isInformationDialogOpen}
          setIsOpen={setIsInformationDialogOpen}
        />
      )}
      {contextMenuGameId && isPlayTimeEditorDialogOpen && (
        <PlayTimeEditorDialog
          gameId={contextMenuGameId}
          setIsOpen={setIsPlayTimeEditorDialogOpen}
        />
      )}
      {contextMenuGameId && isPropertiesDialogOpen && (
        <GamePropertiesDialog
          gameId={contextMenuGameId}
          isOpen={isPropertiesDialogOpen}
          setIsOpen={setIsPropertiesDialogOpen}
        />
      )}
      {contextMenuGameId && isStorageSizeDialogOpen && (
        <CalculateStorageSizeDialog
          gameId={contextMenuGameId}
          isOpen={isStorageSizeDialogOpen}
          setIsOpen={setIsStorageSizeDialogOpen}
        />
      )}
      {/* 游戏详情：用 fixed 锁定到右侧网格的可视区域。
          （用 absolute 会相对整个虚拟列表内容高度，导致面板极高、渐变跑到屏幕外） */}
      {inlineGameId && (
        <div
          className="fixed z-30 overflow-hidden"
          style={{
            left: `${libraryBarWidth + sidebarWidth + 1}px`,
            top: '50px',
            right: 0,
            bottom: 0
          }}
        >
          <InlineGameDetail gameId={inlineGameId} onClose={() => setInlineGameId(null)} />
        </div>
      )}

      {/* 一键到顶 / 到底 */}
      <ScrollNavButtons anchorRef={gridOuterRef} />
    </div>
  )
}
