import { SeparatorDashed } from '@ui/separator-dashed'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDragScroll } from '~/hooks/useDragScroll'
import { useEffectiveLibraryBarWidth } from '~/hooks/useShowLibrarybar'
import { useGameCollectionStore } from '~/stores'
import { useVisibleGameIds } from '~/stores/game'
import { cn } from '~/utils'
import { HorizontalDragBar } from './HorizontalDragBar'
import { GamePoster } from './posters/GamePoster'

/** 未收藏：所有还没加入任何收藏的游戏，单行展示（可拖动 + 导航条） */
export function Uncollected(): React.JSX.Element {
  const { t } = useTranslation('game')
  const collections = useGameCollectionStore((state) => state.documents)
  const visibleGameIds = useVisibleGameIds()
  const libraryBarWidth = useEffectiveLibraryBarWidth()

  const ids = useMemo(() => {
    const collected = new Set<string>()
    for (const collection of Object.values(collections)) {
      for (const gameId of collection.games) collected.add(gameId)
    }
    return visibleGameIds.filter((gameId) => !collected.has(gameId))
  }, [collections, visibleGameIds])

  const scrollRef = useRef<HTMLDivElement>(null)
  const dragHandlers = useDragScroll(() => scrollRef.current, 'x')
  const [panning, setPanning] = useState(false)

  if (ids.length === 0) return <></>

  return (
    <div
      className="flex flex-col w-full"
      style={{
        width: `calc(100vw - ${libraryBarWidth + 4 - (libraryBarWidth === 0 ? 1 : 0)}px)`
      }}
    >
      <div className="flex flex-row items-center gap-5 justify-center pl-10">
        <div className="text-accent-foreground shrink-0">{t('showcase.sections.uncollected')}</div>
        <SeparatorDashed className="border-border" />
      </div>

      <div
        ref={scrollRef}
        className={cn(
          'flex flex-row gap-5 w-full overflow-x-auto scrollbar-none',
          'pt-6 pb-1 pl-10 pr-10',
          panning ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onPointerDown={(event) => {
          dragHandlers.onPointerDown(event)
          setPanning(true)
        }}
        onPointerMove={dragHandlers.onPointerMove}
        onPointerUp={(event) => {
          dragHandlers.onPointerUp(event)
          setPanning(false)
        }}
        onPointerCancel={(event) => {
          dragHandlers.onPointerCancel(event)
          setPanning(false)
        }}
      >
        {ids.map((gameId) => (
          <GamePoster key={gameId} gameId={gameId} />
        ))}
      </div>

      <HorizontalDragBar containerRef={scrollRef} />
    </div>
  )
}
