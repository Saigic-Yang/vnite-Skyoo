import { SeparatorDashed } from '@ui/separator-dashed'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDragScroll } from '~/hooks/useDragScroll'
import { useEffectiveLibraryBarWidth } from '~/hooks/useShowLibrarybar'
import { getGameStore, useGameRegistry } from '~/stores/game'
import { cn } from '~/utils'
import { GamePoster } from './posters/GamePoster'

const COUNT = 9

/** 最爱玩：按累计游玩时长取前 10 个游戏，单行 + 可拖动导航条 */
export function RecentlyPlayed(): React.JSX.Element {
  const { t } = useTranslation('game')
  const gameIds = useGameRegistry((state) => state.gameIds)
  const gamesLoaded = useGameRegistry((state) => state.gamesLoaded)
  const libraryBarWidth = useEffectiveLibraryBarWidth()

  const ids = useMemo(() => {
    if (!gamesLoaded) return []
    return gameIds
      .map((gameId) => ({
        gameId,
        playTime: Number(getGameStore(gameId).getState().getValue('record.playTime')) || 0
      }))
      .filter((item) => item.playTime > 0)
      .sort((a, b) => b.playTime - a.playTime)
      .slice(0, COUNT)
      .map((item) => item.gameId)
  }, [gameIds, gamesLoaded])

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
        <div className="text-accent-foreground shrink-0">{t('showcase.sections.recentlyPlayed')}</div>
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

    </div>
  )
}
