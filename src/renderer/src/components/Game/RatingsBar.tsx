import type { GameRatings, GameSteamRatingRow } from '@appTypes/models'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ipcManager } from '~/app/ipc'
import { Button } from '~/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useGameState } from '~/hooks'
import { cn } from '~/utils'

/** Steam 官方三档评价配色：好评（蓝）/ 褒贬不一（土黄）/ 差评（砖红） */
function steamColor(percent?: number): string {
  if (typeof percent !== 'number') return ''
  if (percent >= 70) return 'text-[#66c0f4]'
  if (percent >= 40) return 'text-[#b9a074]'
  return 'text-[#a34c25]'
}

function StatChip({
  icon,
  label,
  value,
  valueClassName,
  hint,
  onClick,
  className
}: {
  icon: string
  label: string
  value: string
  valueClassName?: string
  hint?: React.ReactNode
  onClick?: () => void
  className?: string
}): React.JSX.Element {
  const chip = (
    <div
      onClick={onClick}
      className={cn(
        'flex h-[40px] items-center gap-2 rounded-lg bg-muted/50 px-3 select-none',
        onClick ? 'cursor-pointer hover:bg-muted' : 'cursor-default',
        className
      )}
    >
      <span className={cn(icon, 'w-[18px] h-[18px] text-muted-foreground shrink-0')} />
      <span className={cn('text-xs text-muted-foreground whitespace-nowrap')}>{label}</span>
      <span className={cn('text-sm font-semibold whitespace-nowrap', valueClassName)}>{value}</span>
    </div>
  )
  if (!hint) return chip
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent className={cn('p-3')}>{hint}</TooltipContent>
    </Tooltip>
  )
}

/**
 * 弹出说明里的一行：范围 / 评价 / 好评率 / 评测数
 * 注意：tooltip 背景是主题的 primary 色，文字必须用 primary-foreground（及其透明度），
 * 不能用 muted-foreground，否则暗色主题下会糊成一片看不清。
 */
function RatingDetailRow({
  scope,
  row,
  showHead = false
}: {
  scope: string
  row?: GameSteamRatingRow
  showHead?: boolean
}): React.JSX.Element {
  const { t } = useTranslation('game')
  return (
    <>
      {showHead && (
        <div
          className={cn(
            'flex items-center gap-4 pb-1 text-[11px] font-medium text-primary-foreground/60'
          )}
        >
          <span className={cn('w-[84px] shrink-0')}>{t('detail.overview.ratings.colScope')}</span>
          <span className={cn('w-[64px] shrink-0')}>{t('detail.overview.ratings.colRating')}</span>
          <span className={cn('w-[56px] shrink-0 text-right')}>
            {t('detail.overview.ratings.colPercent')}
          </span>
          <span className={cn('min-w-[72px] text-right')}>
            {t('detail.overview.ratings.colCount')}
          </span>
        </div>
      )}
      <div className={cn('flex items-center gap-4 text-xs')}>
        <span className={cn('w-[84px] shrink-0 text-primary-foreground/70')}>{scope}</span>
        <span className={cn('w-[64px] shrink-0 font-medium text-primary-foreground')}>
          {row?.summary || '-'}
        </span>
        <span className={cn('w-[56px] shrink-0 text-right text-primary-foreground')}>
          {row ? `${row.percent}%` : '-'}
        </span>
        <span className={cn('min-w-[72px] text-right tabular-nums text-primary-foreground/90')}>
          {row?.total ? row.total.toLocaleString() : '-'}
        </span>
      </div>
    </>
  )
}

const EMPTY = '-'

export function RatingsBar({ gameId }: { gameId: string }): React.JSX.Element {
  const { t } = useTranslation('game')
  const [ratings] = useGameState(gameId, 'ratings')
  const [score, setScore] = useGameState(gameId, 'record.score')
  const [scorePickerOpen, setScorePickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  /** 刷新成功后立刻用返回结果渲染，不等待数据库变更事件（否则会"点了没反应"） */
  const [localRatings, setLocalRatings] = useState<GameRatings | null>(null)

  useEffect(() => {
    setLocalRatings(null)
  }, [gameId])

  const data: GameRatings = localRatings || ratings || {}
  const steam = data.steam
  const metacritic = data.metacritic
  const opencritic = data.opencritic

  // 旧数据可能是 8.5 这类小数，展示与选择都取整数部分
  const scoreValue = score === -1 ? EMPTY : String(Math.trunc(score))

  async function refresh(): Promise<void> {
    if (busy) return
    setBusy(true)
    try {
      const result = (await ipcManager.invoke('ratings:refresh', gameId)) as GameRatings | null
      if (result) setLocalRatings(result)
    } catch (error) {
      // 抓取失败时保留原有数据，并明确告知原因（避免"点了没反应"）
      toast.error((error as Error)?.message || '刷新失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  const openUrl = (url?: string): void => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={cn('flex flex-row items-center gap-2 ml-1')}>
      {/* 我的评分：点击弹出 1~10 选择 */}
      <Popover open={scorePickerOpen} onOpenChange={setScorePickerOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              'flex h-[40px] items-center gap-2 rounded-lg bg-muted/50 px-3 select-none cursor-pointer hover:bg-muted'
            )}
          >
            <span className={cn('icon-[mdi--starburst-outline] w-[18px] h-[18px] text-muted-foreground shrink-0')} />
            <span className={cn('text-xs text-muted-foreground whitespace-nowrap')}>
              {t('detail.overview.ratings.myScore')}
            </span>
            <span className={cn('text-sm font-semibold whitespace-nowrap')}>{scoreValue}</span>
          </div>
        </PopoverTrigger>
        <PopoverContent className={cn('w-[228px] p-2')}>
          <div className={cn('pb-1 text-xs text-muted-foreground')}>
            {t('detail.overview.ratings.scoreTitle')}
          </div>
          <div className={cn('grid grid-cols-5 gap-1')}>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
              <button
                key={value}
                onClick={() => {
                  setScore(value)
                  setScorePickerOpen(false)
                }}
                className={cn(
                  'h-8 rounded-md text-sm transition-colors',
                  Math.trunc(score) === value
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'hover:bg-accent'
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Steam 总评：按钮显示评价文字，明细与百分比放进悬停说明 */}
      {steam && (
        <StatChip
          icon="icon-[mdi--steam]"
          label={t('detail.overview.ratings.steam')}
          value={steam.summary || EMPTY}
          valueClassName={steamColor(steam.percent)}
          onClick={() => openUrl(steam.url)}
          hint={
            <div className={cn('flex flex-col gap-[2px]')}>
              <RatingDetailRow
                scope={t('detail.overview.ratings.rowRecent')}
                row={steam.recent}
                showHead
              />
              <RatingDetailRow
                scope={t('detail.overview.ratings.rowChinese')}
                row={steam.chinese}
              />
              <RatingDetailRow scope={t('detail.overview.ratings.rowAll')} row={steam} />
              <div className={cn('pt-1 text-[11px] text-primary-foreground/60')}>
                {t('detail.overview.ratings.openStore')}
              </div>
            </div>
          }
        />
      )}

      {/* Steam 简中评价 */}
      {steam?.chinese && (
        <StatChip
          icon="icon-[mdi--steam]"
          label={t('detail.overview.ratings.chinese')}
          value={steam.chinese.summary || EMPTY}
          valueClassName={steamColor(steam.chinese.percent)}
          onClick={() => openUrl(steam.url)}
          hint={
            <div className={cn('flex flex-col gap-[2px]')}>
              <RatingDetailRow
                scope={t('detail.overview.ratings.rowChinese')}
                row={steam.chinese}
                showHead
              />
            </div>
          }
        />
      )}

      {/* Metacritic（Steam 有分数才显示） */}
      {metacritic && (
        <StatChip
          icon="icon-[mdi--alpha-m-circle]"
          label={t('detail.overview.ratings.metacritic')}
          value={String(metacritic.score)}
          hint={t('detail.overview.ratings.metacriticHint')}
          onClick={() => openUrl(metacritic.url)}
        />
      )}

      {/* OpenCritic（配了 Key 才有数据） */}
      {opencritic && (
        <StatChip
          icon="icon-[mdi--alpha-o-circle]"
          label={t('detail.overview.ratings.opencritic')}
          value={String(opencritic.score)}
          hint={
            typeof opencritic.reviewCount === 'number'
              ? t('detail.overview.ratings.opencriticHint', { count: opencritic.reviewCount })
              : undefined
          }
          onClick={() => openUrl(opencritic.url)}
        />
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn('h-[40px] w-[40px] shrink-0')}
            disabled={busy}
            onClick={() => {
              void refresh()
            }}
          >
            <span className={cn('icon-[mdi--refresh] w-[18px] h-[18px]', busy && 'animate-spin')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('detail.overview.ratings.refresh')}</TooltipContent>
      </Tooltip>
    </div>
  )
}
