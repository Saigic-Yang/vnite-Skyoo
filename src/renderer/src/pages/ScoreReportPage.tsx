import { ScrollArea } from '@ui/scroll-area'
import { useTranslation } from 'react-i18next'
import { cn } from '~/utils'
import { ScoreReport } from './Record/ScoreReport'

/** 「评分报告」独立页（不再作为时间看板的一个 tab） */
export function ScoreReportPage(): React.JSX.Element {
  const { t } = useTranslation('record')

  return (
    <ScrollArea className={cn('w-full h-full')}>
      <div className={cn('flex flex-col gap-6 pt-[34px] px-6 pb-6')}>
        <div className={cn('text-2xl font-bold')}>{t('tabs.score')}</div>
        <ScoreReport />
      </div>
    </ScrollArea>
  )
}
