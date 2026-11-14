import { useRouter } from '@tanstack/react-router'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
// 左上角使用「龙头特写」图标（完整 logo 仍用于窗口/关于页）
import brandIcon from '@resources/head.png?inline'
import { ipcManager } from '~/app/ipc'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu'
import { Nav } from '~/components/ui/nav'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useConfigState } from '~/hooks/useConfigState'
import { useGameAdderStore } from '~/pages/GameAdder/store'
import { useGameBatchAdderStore } from '~/pages/GameBatchAdder/store'
import { useGameScannerStore } from '~/pages/GameScannerManager/store'
import { useSteamImporterStore } from '~/pages/Importer/SteamImporter/store'
import { cn } from '~/utils'
import { ToolboxPopover } from './Toolbox/ToolboxPopover'

const MIN_WIDTH = 56
const MAX_WIDTH = 220
/** 文字完全显现的宽度，以及开始淡入的宽度 */
const LABEL_FADE_START = 96
const LABEL_FADE_END = 156

const NAV_ITEMS = [
  {
    id: 'library',
    to: '/library',
    icon: 'icon-[mdi--bookshelf]',
    labelKey: 'navigation.library',
    exact: false
  },
  {
    id: 'records',
    to: '/record',
    icon: 'icon-[mdi--report-box-multiple]',
    labelKey: 'navigation.records'
  },
  {
    id: 'scanner',
    to: '/scanner',
    icon: 'icon-[mdi--folder-search]',
    labelKey: 'navigation.scanner'
  },
  {
    id: 'transformer',
    to: '/transformer',
    icon: 'icon-[mdi--file-replace]',
    labelKey: 'navigation.transformer'
  },
  {
    id: 'plugin',
    to: '/plugin',
    icon: 'icon-[mdi--puzzle]',
    labelKey: 'navigation.plugin'
  },
  {
    id: 'databaseInspector',
    to: '/database-inspector',
    icon: 'icon-[mdi--database-eye]',
    labelKey: 'navigation.databaseInspector',
    exact: false
  },
  {
    id: 'scoreReport',
    to: '/score-report',
    icon: 'icon-[mdi--chart-box-outline]',
    labelKey: 'navigation.scoreReport'
  }
] as const

const BOTTOM_IDS = ['customize', 'addGame', 'toolbox', 'settings'] as const
const ALL_IDS = [...NAV_ITEMS.map((item) => item.id), ...BOTTOM_IDS] as string[]

function DropIndicator(): React.JSX.Element {
  return (
    <div className="h-[2px] w-8 rounded-full bg-primary shadow-[0_0_6px] shadow-primary/60" />
  )
}

export function Sidebar(): React.JSX.Element {
  const router = useRouter()
  const setIsGameAdderOpen = useGameAdderStore((state) => state.setIsOpen)
  const gameBatchAdderActions = useGameBatchAdderStore((state) => state.actions)
  const setIsSteamImporterOpen = useSteamImporterStore((state) => state.setIsOpen)
  const setEditingScanner = useGameScannerStore((state) => state.setEditingScanner)
  const [showToolbox] = useConfigState('appearances.sidebar.showToolbox')
  const [configWidth, setConfigWidth] = useConfigState('appearances.sidebar.width')
  const [itemOrder, setItemOrder] = useConfigState('appearances.sidebar.itemOrder')
  const [hiddenItems, setHiddenItems] = useConfigState('appearances.sidebar.hiddenItems')
  const { t } = useTranslation('sidebar')

  const [width, setWidth] = useState<number>(
    Math.min(Math.max(configWidth || MIN_WIDTH, MIN_WIDTH), MAX_WIDTH)
  )
  const [resizing, setResizing] = useState(false)
  const resizeStart = useRef({ x: 0, width: MIN_WIDTH })

  useEffect(() => {
    if (typeof configWidth === 'number' && !resizing) {
      setWidth(Math.min(Math.max(configWidth, MIN_WIDTH), MAX_WIDTH))
    }
  }, [configWidth, resizing])

  const handleResizeDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    resizeStart.current = { x: event.clientX, width }
    setResizing(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleResizeMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!resizing) return
    const next = resizeStart.current.width + (event.clientX - resizeStart.current.x)
    setWidth(Math.min(Math.max(next, MIN_WIDTH), MAX_WIDTH))
  }

  const handleResizeUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!resizing) return
    setResizing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setConfigWidth(Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH))
  }

  // 文字随宽度平滑淡入淡出（0~1），不再用阈值硬切
  const labelOpacity = Math.min(
    1,
    Math.max(0, (width - LABEL_FADE_START) / (LABEL_FADE_END - LABEL_FADE_START))
  )
  const showLabels = labelOpacity > 0.5

  const hidden = Array.isArray(hiddenItems) ? hiddenItems : []
  const order = useMemo<string[]>(() => {
    const stored = Array.isArray(itemOrder) ? itemOrder : []
    const valid = stored.filter((id) => ALL_IDS.includes(id))
    const unique = Array.from(new Set(valid))
    return [...unique, ...ALL_IDS.filter((id) => !unique.includes(id))]
  }, [itemOrder])

  const topIds = order.filter(
    (id) => !BOTTOM_IDS.includes(id as (typeof BOTTOM_IDS)[number]) && !hidden.includes(id)
  )
  const bottomIds = order.filter((id) => BOTTOM_IDS.includes(id as (typeof BOTTOM_IDS)[number]))

  const draggingId = useRef<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ group: 'top' | 'bottom'; index: number } | null>(null)
  // drop 的 ref 版本：onDrop 时 state 可能还没同步，用 ref 保证拿到最新位置
  const dropRef = useRef<{ group: 'top' | 'bottom'; index: number } | null>(null)

  const reorderGroup = (groupIds: string[], fromId: string, targetIndex: number): void => {
    const from = groupIds.indexOf(fromId)
    if (from === -1) return
    const reordered = [...groupIds]
    reordered.splice(from, 1)
    const insertAt = targetIndex > from ? targetIndex - 1 : targetIndex
    reordered.splice(insertAt, 0, fromId)

    const next = [...order]
    const slots = next
      .map((id, index) => (groupIds.includes(id) ? index : -1))
      .filter((index) => index >= 0)
    slots.forEach((slot, index) => {
      next[slot] = reordered[index]
    })
    setItemOrder(next)
  }

  const commitDrop = (): void => {
    const sourceId = draggingId.current
    draggingId.current = null
    setDragging(null)
    const target = dropRef.current
    dropRef.current = null
    setDrop(null)
    if (!sourceId || !target) return
    reorderGroup(target.group === 'top' ? topIds : bottomIds, sourceId, target.index)
  }

  const toggleItem = (id: string): void => {
    setHiddenItems(hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id])
  }

  const itemClass = cn(
    'h-9 w-full p-0 pl-2 justify-start gap-2 overflow-hidden shrink-0',
    showLabels ? 'pr-1' : 'pr-0'
  )

  const Label = ({ text }: { text: string }): React.JSX.Element => (
    <span
      className="text-[13px] whitespace-nowrap overflow-hidden text-ellipsis"
      style={{ opacity: labelOpacity }}
    >
      {text}
    </span>
  )

  const renderNavItem = (item: (typeof NAV_ITEMS)[number]): React.JSX.Element => {
    const nav = (
      <Nav
        variant="sidebar"
        to={item.to}
        {...('search' in item && item.search ? { search: item.search } : {})}
        {...('exact' in item && item.exact === false
          ? { activeOptions: { exact: false as const } }
          : {})}
        className={cn(itemClass, 'non-draggable')}
      >
        <span className={cn(item.icon, 'w-5 h-5 shrink-0')}></span>
        <Label text={t(item.labelKey)} />
      </Nav>
    )

    if (showLabels) return nav
    return (
      <Tooltip>
        <TooltipTrigger asChild>{nav}</TooltipTrigger>
        <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
      </Tooltip>
    )
  }

  const renderItemWrapper = (
    id: string,
    group: 'top' | 'bottom',
    index: number
  ): React.JSX.Element => {
    const navItem = NAV_ITEMS.find((item) => item.id === id)
    let content: React.ReactNode = null

    if (navItem) {
      content = renderNavItem(navItem)
    } else if (id === 'customize') {
      content = (
        <DropdownMenu>
          <Tooltip>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className={cn(itemClass, 'non-draggable min-h-0')}>
                <span className={cn('icon-[mdi--dots-horizontal] w-5 h-5 shrink-0')}></span>
                <Label text={t('actions.customizeSidebar')} />
              </Button>
            </DropdownMenuTrigger>
            <TooltipContent side="right">{t('actions.customizeSidebar')}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" className="w-52">
            <div className="px-2 py-1 text-xs text-muted-foreground">
              {t('actions.customizeSidebar')}
            </div>
            <DropdownMenuSeparator />
            {NAV_ITEMS.map((item) => (
              <DropdownMenuItem key={item.id} onClick={() => toggleItem(item.id)}>
                <span
                  className={cn(
                    hidden.includes(item.id)
                      ? 'w-4 h-4 mr-2 opacity-0'
                      : 'icon-[mdi--check] w-4 h-4 mr-2'
                  )}
                ></span>
                <span className={cn(item.icon, 'w-4 h-4 mr-2 opacity-70')}></span>
                <div>{t(item.labelKey)}</div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    } else if (id === 'addGame') {
      content = (
        <DropdownMenu>
          <Tooltip>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className={cn(itemClass, 'non-draggable min-h-0')}>
                <span className={cn('icon-[mdi--plus-circle-outline] w-5 h-5 shrink-0')}></span>
                <Label text={t('actions.addGame')} />
              </Button>
            </DropdownMenuTrigger>
            <TooltipContent side="right">{t('actions.addGame')}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right">
            <DropdownMenuItem
              onClick={() => {
                router.navigate({ to: '/scanner' })
                setEditingScanner({ id: null, isNew: true })
              }}
            >
              <div>{t('adder.addScanner')}</div>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t('adder.addGame')}</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => setIsGameAdderOpen(true)}>
                    <div>{t('adder.addSingle')}</div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      toast.promise(
                        (async (): Promise<void> => {
                          try {
                            const result = await ipcManager.invoke(
                              'adder:get-batch-game-adder-data'
                            )
                            if (!Array.isArray(result)) {
                              throw new Error(t('notifications.unknownError'))
                            }
                            if (result.length === 0) {
                              toast.error(t('notifications.noGamesFound'))
                              return
                            }
                            gameBatchAdderActions.setGames(result)
                            gameBatchAdderActions.setIsOpen(true)
                          } catch (error) {
                            if (error instanceof Error) {
                              toast.error(
                                `${t('notifications.getBatchGamesFailed')}${error.message}`
                              )
                              throw error
                            }
                            toast.error(`${t('notifications.getBatchGamesFailed')}${error}`)
                            throw new Error(t('notifications.unknownError'))
                          }
                        })(),
                        {
                          loading: t('notifications.selectLibraryFolder'),
                          success: t('notifications.getBatchGamesSuccess'),
                          error: (err: Error) =>
                            `${t('notifications.getBatchGamesFailed')}${err.message}`
                        }
                      )
                    }}
                  >
                    <div>{t('adder.addBatch')}</div>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t('adder.importFromThirdParty')}</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => setIsSteamImporterOpen(true)}>
                    <div>{t('adder.steam')}</div>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    } else if (id === 'toolbox') {
      content = showToolbox ? <ToolboxPopover labelOpacity={labelOpacity} itemClass={itemClass} /> : null
    } else if (id === 'settings') {
      content = (
        <Tooltip>
          <TooltipTrigger asChild>
            <Nav variant="sidebar" to="/config" className={cn(itemClass)}>
              <span className={cn('icon-[mdi--settings-outline] w-5 h-5 shrink-0')}></span>
              <Label text={t('actions.settings')} />
            </Nav>
          </TooltipTrigger>
          <TooltipContent side="right">{t('actions.settings')}</TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Fragment key={id}>
        {drop?.group === group && drop.index === index && <DropIndicator />}
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
            const after = event.clientY > rect.top + rect.height / 2
            const next = { group, index: index + (after ? 1 : 0) } as const
            dropRef.current = next
            setDrop(next)
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            commitDrop()
          }}
          onDragEnd={() => {
            draggingId.current = null
            dropRef.current = null
            setDragging(null)
            setDrop(null)
          }}
          className={cn(
            'w-full flex justify-start transition-all duration-150 ease-out',
            dragging === id && 'opacity-40 scale-95'
          )}
        >
          {content}
        </div>
      </Fragment>
    )
  }

  return (
    <div
      className={cn(
        'relative flex flex-col pl-[6px] pr-[2px] py-[8px] bg-transparent border-r border-border h-full shrink-0',
        resizing ? 'select-none' : 'transition-[width] duration-100'
      )}
      style={{ width }}
    >
      {/* Logo */}
      <div
        className="flex items-center non-draggable cursor-pointer w-full gap-2 pl-2 pr-0 mb-2"
        onClick={() => router.navigate({ to: '/' })}
      >
        <img
          src={brandIcon}
          alt="Skyoo"
          draggable={false}
          className="w-7 h-7 rounded-md object-cover shrink-0"
        />
        <span
          className="font-bold text-[13px] select-none truncate"
          style={{ opacity: labelOpacity }}
        >
          SKYOO
        </span>
      </div>

      <div className="flex flex-col gap-2 items-start w-full">
        {topIds.map((id, index) => renderItemWrapper(id, 'top', index))}
        {drop?.group === 'top' && drop.index === topIds.length && <DropIndicator />}
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-2 items-start w-full">
        {bottomIds.map((id, index) => renderItemWrapper(id, 'bottom', index))}
        {drop?.group === 'bottom' && drop.index === bottomIds.length && <DropIndicator />}
      </div>

      {/* 右侧拖动分隔条 */}
      <div
        onPointerDown={handleResizeDown}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        onPointerCancel={handleResizeUp}
        className="absolute top-0 right-0 h-full w-[6px] cursor-col-resize group z-20 flex justify-center"
      >
        <div
          className={cn(
            'h-full w-[2px] transition-colors',
            resizing ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/60'
          )}
        />
      </div>
    </div>
  )
}
