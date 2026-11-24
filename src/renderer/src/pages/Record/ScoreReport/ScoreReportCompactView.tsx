import { Badge } from '@ui/badge'
import { Card } from '@ui/card'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import AutoSizer from 'react-virtualized-auto-sizer'
import { FixedSizeList } from 'react-window'
import { useDragScroll } from '~/hooks/useDragScroll'
import { cn } from '~/utils'
import { GameScoreCard } from './GameScoreCard'
import { ScoreCategoryHeader } from './ScoreCategoryHeader'
import { ScoreCategoryData, ScoreReportViewProps } from './types'

interface CompactScoreCategoryProps {
  category: ScoreCategoryData
}

function CompactScoreCategory({ category }: CompactScoreCategoryProps): React.JSX.Element | null {
  const { t } = useTranslation('record')
  const { games, className } = category
  const listOuterRef = useRef<HTMLDivElement>(null)
  const dragHandlers = useDragScroll(() => listOuterRef.current, 'x')

  if (games.length === 0) {
    return null
  }

  return (
    <Card
      className={cn(`w-full mb-6 overflow-hidden border-0 shadow-md border-l-4 p-0`, className)}
    >
      <div className="flex flex-col lg:flex-row">
        <div className="p-6 lg:w-1/5 bg-muted/30 group/scorecat">
          <ScoreCategoryHeader category={category} className="mb-3" />
          <Badge className="font-normal bg-accent text-accent-foreground">
            {t('score.categories.gamesCount', { count: games.length })}
          </Badge>
        </div>
        <div
          className="h-[280px] 3xl:h-[325px] p-6 pt-0 pb-4 lg:w-4/5 lg:pt-6 cursor-grab active:cursor-grabbing"
          {...dragHandlers}
        >
          <AutoSizer>
            {({ height, width }) => {
              const itemSize = height <= 250 ? 150 : 180
              return (
                <FixedSizeList
                  outerRef={listOuterRef}
                  height={height}
                  itemCount={games.length}
                  itemSize={itemSize}
                  className={cn(
                    'overflow-auto scrollbar-base',
                    '!scrollbar-h-[10px] scrollbar-hover:!scrollbar-thumb-primary'
                  )}
                  width={width}
                  layout="horizontal"
                >
                  {({ index, style }) => (
                    <div style={style} className={cn('pt-1', index === 0 && 'pl-1')}>
                      <GameScoreCard gameId={games[index]} />
                    </div>
                  )}
                </FixedSizeList>
              )
            }}
          </AutoSizer>
        </div>
      </div>
    </Card>
  )
}

export function ScoreReportCompactView({ categories }: ScoreReportViewProps): React.JSX.Element {
  return (
    <>
      {categories.map((category) => (
        <CompactScoreCategory key={category.id} category={category} />
      ))}
    </>
  )
}
