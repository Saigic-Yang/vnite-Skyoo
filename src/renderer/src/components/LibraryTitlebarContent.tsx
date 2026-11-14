import { isEqual } from 'lodash'
import { Fragment, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { ClearableInput } from '~/components/ui/input'
import { Nav } from '~/components/ui/nav'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useConfigState } from '~/hooks'
import { cn } from '~/utils'
import { Filter } from './Librarybar/Filter'
import { useFilterStore } from './Librarybar/Filter/store'
import { SortMenu } from './Librarybar/SortMenu'
import { useLibrarybarStore } from './Librarybar/store'

/** 搜索框单独拆出来，便于在顶栏里排到最左侧 */
export function LibraryTitlebarSearch(): React.JSX.Element {
  const { t } = useTranslation('game')
  const query = useLibrarybarStore((state) => state.query)
  const setQuery = useLibrarybarStore((state) => state.setQuery)

  return (
    <div className="w-[250px]">
      <Tooltip>
        <TooltipTrigger className="w-full">
          <ClearableInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('librarybar.search.placeholder')}
            onClear={() => setQuery('')}
            className="h-[32px] min-h-0 "
            inputClassName="h-[32px] min-h-0 bg-background/50 border-0"
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('librarybar.search.tooltip')}</TooltipContent>
      </Tooltip>
    </div>
  )
}

const BUTTON_IDS = ['home', 'collections', 'allGames', 'filter', 'sort'] as const
type ToolbarButtonId = (typeof BUTTON_IDS)[number]

/** 拖动时插入位置的竖线提示 */
function DropIndicator(): React.JSX.Element {
  return (
    <div className="w-[2px] h-6 rounded-full bg-primary shadow-[0_0_6px] shadow-primary/60" />
  )
}

/** 首页 / 收藏 / 所有游戏 / 筛选 / 排序（顺序可拖动自定义，保存在 config） */
export function LibraryTitlebarActions(): React.JSX.Element {
  const { t } = useTranslation('game')
  const filter = useFilterStore((state) => state.filter)
  const toggleFilterMenu = useFilterStore((state) => state.toggleFilterMenu)
  const clearFilter = useFilterStore((state) => state.clearFilter)

  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)
  const toggleSortMenu = (): void => {
    setIsSortMenuOpen(!isSortMenuOpen)
  }

  const [buttonOrder, setButtonOrder] = useConfigState('appearances.toolbar.buttonOrder')
  const draggingId = useRef<ToolbarButtonId | null>(null)
  const [dragging, setDragging] = useState<ToolbarButtonId | null>(null)
  /** 插入位置的索引（0 ~ length） */
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  // 容错：过滤掉未知 id、补齐缺失项
  const orderedIds = useMemo<ToolbarButtonId[]>(() => {
    const stored = Array.isArray(buttonOrder) ? buttonOrder : []
    const valid = stored.filter((id): id is ToolbarButtonId =>
      (BUTTON_IDS as readonly string[]).includes(id)
    )
    const unique = Array.from(new Set(valid))
    return [...unique, ...BUTTON_IDS.filter((id) => !unique.includes(id))]
  }, [buttonOrder])

  const commitDrop = (targetIndex: number): void => {
    const sourceId = draggingId.current
    draggingId.current = null
    setDragging(null)
    setDropIndex(null)
    if (!sourceId) return

    const from = orderedIds.indexOf(sourceId)
    if (from === -1) return
    const next = [...orderedIds]
    next.splice(from, 1)
    const insertAt = targetIndex > from ? targetIndex - 1 : targetIndex
    next.splice(insertAt, 0, sourceId)
    if (next.join(',') !== orderedIds.join(',')) setButtonOrder(next)
  }

  const renderButton = (id: ToolbarButtonId): React.JSX.Element => {
    switch (id) {
      case 'home':
        return (
          <Tooltip>
            <TooltipTrigger>
              <Nav variant="librarybar" to="/library/home" className="p-0 h-[32px] w-[32px]">
                <span className="icon-[mdi--home-outline] w-6 h-6"></span>
              </Nav>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('librarybar.home')}</TooltipContent>
          </Tooltip>
        )
      case 'collections':
        return (
          <Tooltip>
            <TooltipTrigger>
              <Nav variant="librarybar" to="/library/collections" className="p-0 h-[32px] w-[32px]">
                <span className="icon-[mdi--heart-outline] w-6 h-6"></span>
              </Nav>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('librarybar.collections')}</TooltipContent>
          </Tooltip>
        )
      case 'allGames':
        return (
          <Tooltip>
            <TooltipTrigger>
              <Nav variant="librarybar" to="/library/all" className="p-0 h-[32px] w-[32px]">
                <span className="icon-[mdi--controller] w-6 h-6"></span>
              </Nav>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('showcase.sections.allGames')}</TooltipContent>
          </Tooltip>
        )
      case 'filter':
        return (
          <div className="relative">
            <Filter>
              <Button
                onClick={toggleFilterMenu}
                variant="thirdary"
                size="icon"
                className="h-[32px] w-[32px]"
              >
                <span
                  className={cn(
                    isEqual(filter, {})
                      ? 'icon-[mdi--filter-variant] w-6 h-6'
                      : 'icon-[mdi--filter-variant-plus] w-6 h-6'
                  )}
                ></span>
              </Button>
            </Filter>
            {!isEqual(filter, {}) && (
              <Button
                className={cn(
                  'absolute -top-1 -right-1 w-[14px] h-[14px] p-0 items-center justify-center'
                )}
                onClick={clearFilter}
                variant={'thirdary'}
              >
                <span className={cn('icon-[mdi--close] w-[10px] h-[10px]')}></span>
              </Button>
            )}
          </div>
        )
      case 'sort':
        return (
          <SortMenu isSortMenuOpen={isSortMenuOpen} setIsSortMenuOpen={setIsSortMenuOpen}>
            <Button
              onClick={toggleSortMenu}
              variant="thirdary"
              size="icon"
              className="h-[32px] w-[32px]"
            >
              <span className="icon-[mdi--sort] w-6 h-6"></span>
            </Button>
          </SortMenu>
        )
    }
  }

  return (
    <div
      className="flex flex-row items-center justify-center gap-2"
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropIndex(null)
      }}
    >
      {orderedIds.map((id, index) => (
        <Fragment key={id}>
          {dropIndex === index && <DropIndicator />}
          <div
            draggable
            onDragStart={(event) => {
              draggingId.current = id
              setDragging(id)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', id)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              const rect = event.currentTarget.getBoundingClientRect()
              const after = event.clientX > rect.left + rect.width / 2
              setDropIndex(index + (after ? 1 : 0))
            }}
            onDrop={(event) => {
              event.preventDefault()
              event.stopPropagation()
              commitDrop(dropIndex ?? index)
            }}
            onDragEnd={() => {
              draggingId.current = null
              setDragging(null)
              setDropIndex(null)
            }}
            className={cn(
              'cursor-grab active:cursor-grabbing',
              // 拖动中：被拖的按钮淡化缩小，其它按钮让出位置
              'transition-all duration-150 ease-out',
              dragging === id && 'opacity-40 scale-90',
              dragging !== null && dragging !== id && 'scale-105'
            )}
            title={t('librarybar.dragToReorder')}
          >
            {renderButton(id)}
          </div>
        </Fragment>
      ))}
      {dropIndex === orderedIds.length && <DropIndicator />}
    </div>
  )
}
