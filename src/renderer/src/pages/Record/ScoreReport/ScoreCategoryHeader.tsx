import { Button } from '@ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ui/dialog'
import { Input } from '@ui/input'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useScoreCategoryCopyStore } from '~/stores/scoreCategoryCopyStore'
import { cn } from '~/utils'
import type { ScoreCategoryData } from './types'

export function ScoreCategoryHeader({
  category,
  className
}: {
  category: ScoreCategoryData
  className?: string
}): React.JSX.Element {
  const { t } = useTranslation('record')
  const copies = useScoreCategoryCopyStore((state) => state.copies)
  const saveCopy = useScoreCategoryCopyStore((state) => state.saveCopy)
  const copy = copies[category.id]

  const title = copy?.title || category.title
  const description = copy?.description || category.description

  const [open, setOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const [draftDesc, setDraftDesc] = useState(description)

  const openDialog = (): void => {
    setDraftTitle(title)
    setDraftDesc(description)
    setOpen(true)
  }

  const handleSave = (): void => {
    saveCopy(
      category.id,
      { title: draftTitle, description: draftDesc },
      { title, description }
    )
    setOpen(false)
  }

  return (
    <div className={cn('min-w-0', className)}>
      {/* 总评颜色与分组标题保持一致 */}
      <div className={cn('text-xs font-semibold tracking-wide', category.titleClass)}>
        {category.verdict}
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <h3 className={cn('text-lg font-semibold truncate', category.titleClass)}>{title}</h3>
        <span
          className="icon-[mdi--pencil-outline] w-4 h-4 shrink-0 cursor-pointer opacity-0 group-hover/scorecat:opacity-60 hover:opacity-100"
          onClick={openDialog}
        />
      </div>

      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{description}</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('score.categories.editTitle', { defaultValue: '编辑分组文案' })}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">标题</span>
              <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
              {copy && copy.titleHistory.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {copy.titleHistory.map((item) => (
                    <button
                      key={item}
                      className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-accent"
                      onClick={() => setDraftTitle(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">说明</span>
              <Input value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} />
              {copy && copy.descriptionHistory.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {copy.descriptionHistory.map((item) => (
                    <button
                      key={item}
                      className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-accent"
                      onClick={() => setDraftDesc(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="thirdary" onClick={() => setOpen(false)}>
                {t('utils:common.cancel', { defaultValue: '取消' })}
              </Button>
              <Button onClick={handleSave}>{t('utils:common.confirm', { defaultValue: '确定' })}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
