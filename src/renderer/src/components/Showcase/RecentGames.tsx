import { SeparatorDashed } from '@ui/separator-dashed'
import { throttle } from 'lodash'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { useConfigState } from '~/hooks'
import { useLibraryStore } from '~/pages/Library/store'
import { getRecentGameIds, useVisibleGameIds } from '~/stores/game'
import { cn } from '~/utils'
import { HorizontalDragBar } from './HorizontalDragBar'
import { BigGamePoster } from './posters/BigGamePoster'
import { GamePoster } from './posters/GamePoster'

export function RecentGames(): React.JSX.Element {
  const visibleGameIds = useVisibleGameIds()
  const games = getRecentGameIds(15, visibleGameIds)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showRecentGamesInGameList] = useConfigState('game.gameList.showRecentGames')
  const libraryBarWidth = useLibraryStore((state) => state.libraryBarWidth)
  const [configSidebarWidth] = useConfigState('appearances.sidebar.width')
  const sidebarWidth = Math.max(56, Number(configSidebarWidth) || 56)

  const scroll = throttle((direction: 'left' | 'right'): void => {
    if (!scrollContainerRef.current) return
    const scrollAmount = 872
    const container = scrollContainerRef.current
    container.scrollTo({
      left: container.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount),
      behavior: 'smooth'
    })
  }, 750)

  // —— 按住鼠标直接左右拖动内容 ——
  const pan = useRef({ active: false, startX: 0, startScroll: 0, moved: false })
  const suppressClick = useRef(false)
  const [panning, setPanning] = useState(false)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    const el = scrollContainerRef.current
    if (!el) return
    pan.current = {
      active: true,
      startX: event.clientX,
      startScroll: el.scrollLeft,
      moved: false
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const el = scrollContainerRef.current
    const state = pan.current
    if (!el || !state.active) return
    const dx = event.clientX - state.startX
    if (!state.moved) {
      if (Math.abs(dx) < 6) return
      state.moved = true
      setPanning(true)
      try {
        el.setPointerCapture(event.pointerId)
      } catch {
        // ignore
      }
    }
    el.scrollLeft = state.startScroll - dx
  }

  const endPan = (): void => {
    const state = pan.current
    if (state.moved) {
      // 拖动结束后抑制一次点击，避免误触进入游戏详情
      suppressClick.current = true
      window.setTimeout(() => {
        suppressClick.current = false
      }, 60)
    }
    pan.current = { active: false, startX: 0, startScroll: 0, moved: false }
    setPanning(false)
  }

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
          {t('showcase.sections.recentGames')}
        </div>

        <SeparatorDashed className="border-border" />
        <div className={cn('flex flex-row gap-2 items-center justify-center pr-5')}>
          <Button
            className={cn('hover:bg-transparent p-0 -mt-2 -mb-2')}
            variant={'ghost'}
            size={'icon'}
            onClick={() => scroll('left')}
          >
            <span className={cn('icon-[mdi--keyboard-arrow-left] w-6 h-6')}></span>
          </Button>
          <Button
            className={cn('hover:bg-transparent p-0 -mt-2 -mb-2')}
            variant={'ghost'}
            size={'icon'}
            onClick={() => scroll('right')}
          >
            <span className={cn('icon-[mdi--keyboard-arrow-right] w-6 h-6')}></span>
          </Button>
        </div>
      </div>

      {/* Game List Container */}
      <div
        ref={scrollContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onPointerLeave={endPan}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        className={cn(
          'flex flex-row gap-6 grow',
          // 注意：不要加 scroll-smooth，否则拖动导航条时会被平滑动画拖慢
          'w-full overflow-x-auto scrollbar-none',
          panning ? 'cursor-grabbing select-none' : 'cursor-grab',
          // 四周留足空间，卡片悬停放大（含左侧第一张）时才不会被容器裁掉
          'pt-6 pb-1 pl-10 pr-10',
          'scrollbar-none'
        )}
      >
        {games.length === 0 && (
          <div className="text-muted-foreground text-sm">{t('list.recent.empty')}</div>
        )}
        {games.map((game, index) =>
          index === 0 ? (
            <div key={game} className={cn('flex-shrink-0')}>
              {showRecentGamesInGameList ? (
                <BigGamePoster
                  className=""
                  gameId={game}
                  groupId="recentGames"
                  showRemoveFromRecent
                />
              ) : (
                <BigGamePoster gameId={game} showRemoveFromRecent />
              )}
            </div>
          ) : (
            <div key={game} className={cn('flex-shrink-0')}>
              {index < 5 && showRecentGamesInGameList ? (
                <GamePoster gameId={game} groupId="recentGames" showRemoveFromRecent />
              ) : (
                <GamePoster gameId={game} showRemoveFromRecent />
              )}
            </div>
          )
        )}
      </div>
      {/* 可拖动的横向导航条 */}
      <HorizontalDragBar containerRef={scrollContainerRef} />
    </div>
  )
}
