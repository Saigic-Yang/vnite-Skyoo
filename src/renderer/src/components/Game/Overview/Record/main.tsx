import { DEFAULT_PLAY_STATUS_ORDER } from '@appTypes/models/game'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { eventBus } from '~/app/events'
import { useLibrarybarStore } from '~/components/Librarybar/store'
import { Popover, PopoverContent } from '~/components/ui/popover'
import { useGameState } from '~/hooks'
import { cn, formatStorageSize } from '~/utils'
import { useGameDetailStore } from '../../store'
import { RecalculateLastRunDateAlertDialog } from './RecalculateLastRunDateAlertDialog'
import { RecordCard } from './RecordCard'
import { PLAY_STATUS_COLORS, PLAY_STATUS_ICONS } from './RecordIcon'

export function Record({ gameId }: { gameId: string }): React.JSX.Element {
  const { t } = useTranslation('game')
  const [lastRunDate] = useGameState(gameId, 'record.lastRunDate')
  const [playingTime] = useGameState(gameId, 'record.playTime')
  const [playStatus, setPlayStatus] = useGameState(gameId, 'record.playStatus')
  const [storageSize] = useGameState(gameId, 'record.storageSize')
  const { refreshGameList } = useLibrarybarStore.getState()
  const setIsPlayTimeEditorDialogOpen = useGameDetailStore(
    (state) => state.setIsPlayTimeEditorDialogOpen
  )
  const setIsStorageSizeDialogOpen = useGameDetailStore((state) => state.setIsStorageSizeDialogOpen)

  const changePlayStatus = (status: typeof playStatus): void => {
    setPlayStatus(status)
    eventBus.emit('game:play-status-changed', { gameId, status }, { source: 'record' })
    refreshGameList()
  }

  return (
    <div className={cn('flex flex-row flex-wrap items-center gap-12 ml-1')}>
      {/* Play Time */}
      <RecordCard
        className={cn('')}
        title={t('detail.overview.record.playTime')}
        content={
          playingTime !== 0
            ? t('{{date, gameTime}}', { date: playingTime })
            : t('detail.overview.information.empty')
        }
        icon="icon-[mdi--timer-outline] w-[30px] h-[30px]"
        onClick={() => setIsPlayTimeEditorDialogOpen(true)}
      />
      {/* Last Run Date */}
      <RecalculateLastRunDateAlertDialog gameId={gameId}>
        <RecordCard
          className={cn('')}
          title={t('detail.overview.record.lastRunDate')}
          content={
            lastRunDate
              ? t('{{date, niceDate}}', { date: lastRunDate })
              : t('detail.overview.record.neverRun')
          }
          icon="icon-[mdi--calendar-blank-multiple] w-[28px] h-[28px]"
        />
      </RecalculateLastRunDateAlertDialog>
      {/* Play Status */}
      <Popover>
        <RecordCard
          asPopoverTrigger
          className={cn('')}
          title={t('detail.overview.record.playStatus')}
          content={
            <span className={PLAY_STATUS_COLORS[playStatus]}>
              {t(`utils:game.playStatus.${playStatus}`)}
            </span>
          }
          icon={cn(
            PLAY_STATUS_ICONS[playStatus],
            PLAY_STATUS_COLORS[playStatus],
            'w-[32px] h-[32px]'
          )}
        />
        <PopoverContent className="max-w-[150px] p-1">
          <div className="flex flex-col">
            {DEFAULT_PLAY_STATUS_ORDER.map((opt) => (
              <div
                key={opt}
                onClick={() => changePlayStatus(opt)}
                className={cn(
                  'flex flex-row items-center justify-between px-2 py-2 text-sm cursor-pointer',
                  'hover:bg-accent'
                )}
              >
                <span className={PLAY_STATUS_COLORS[opt]}>
                  {t('utils:game.playStatus.' + opt)}
                </span>
                {playStatus === opt && <Check className="w-4 h-4" />}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {/* 我的评分已上移到头部按钮右侧的评分栏（RatingsBar） */}
      {/* Storage Size */}
      <RecordCard
        className={cn('')}
        title={t('detail.overview.record.storageSize')}
        content={formatStorageSize(storageSize, t('detail.overview.record.storageSizeEmpty'))}
        icon="icon-[mdi--harddisk] w-[30px] h-[30px]"
        onClick={() => setIsStorageSizeDialogOpen(true)}
      />
    </div>
  )
}
