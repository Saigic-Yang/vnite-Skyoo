import { useNavigate, useRouterState } from '@tanstack/react-router'
import { isEqual } from 'lodash'
import { Fragment, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { ClearableInput } from '~/components/ui/input'
import { Nav } from '~/components/ui/nav'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useConfigState } from '~/hooks'
import { searchGames, useGameRegistry, useNSFWFilteredGameIds } from '~/stores/game'
import { useInlineDetailStore } from '~/stores/inlineDetailStore'
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
  const gameIds = useNSFWFilteredGameIds()
  const navigate = useNavigate()
  const diceRef = useRef<HTMLSpanElement>(null)
  const [rolling, setRolling] = useState(false)

  // 搜索下拉
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const gameMetaIndex = useGameRegistry((state) => state.gameMetaIndex)
  const setInlineGameId = useInlineDetailStore((state) => state.setGameId)
  const [open, setOpen] = useState(false)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number } | null>(null)

  // 下拉用 Portal + fixed 定位：避免被任何父级 overflow / stacking context 裁掉
  const updateAnchor = (): void => {
    const el = searchWrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setAnchor({ left: rect.left, top: rect.bottom + 4, width: Math.max(rect.width, 320) })
  }

  const results = useMemo(() => {
    const value = query.trim()
    if (!value) return []
    return searchGames(value).slice(0, 8)
  }, [query])

  const isCollectionPage = pathname.startsWith('/library/collections')
  // 「所有游戏」页的搜索结果直接显示在网格里，不再弹下拉
  const showDropdown = !pathname.startsWith('/library/all')

  const openGame = (gameId: string): void => {
    setOpen(false)
    // 收藏页：在右栏内联显示，不跳页
    if (isCollectionPage) {
      setInlineGameId(gameId)
      return
    }
    void navigate({ to: `/library/games/${gameId}/all` })
  }

  /**
   * 随机跳转一个游戏：
   * - 在整个游戏库里均匀随机（不按标签/位置/相似度取样，跳转范围最大）
   * - 记录已随机的游戏，全部轮完一遍后才允许重复
   */
  const jumpRandomGame = (): void => {
    if (gameIds.length === 0 || rolling) return

    // 抛骰子动效：连续翻滚 + 缩放，落定时回到倾斜角度
    setRolling(true)
    diceRef.current?.animate(
      [
        { transform: 'rotate(-12deg) scale(1)' },
        { transform: 'rotate(105deg) scale(1.28)' },
        { transform: 'rotate(215deg) scale(0.88)' },
        { transform: 'rotate(330deg) scale(1.18)' },
        { transform: 'rotate(-12deg) scale(1)' }
      ],
      { duration: 720, easing: 'cubic-bezier(.25,.8,.25,1)' }
    )

    const KEY = 'skyoo:random-picked'
    let picked: string[] = []
    try {
      const raw = window.localStorage.getItem(KEY)
      picked = raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      picked = []
    }

    const current = window.location.hash.split('/library/games/')[1]?.split(/[/?]/)[0] || ''
    // 只保留仍然存在的游戏，避免库里删过游戏后永远轮不完
    picked = picked.filter((id) => gameIds.includes(id))

    let pool = gameIds.filter((id) => id !== current && !picked.includes(id))
    if (pool.length === 0) {
      // 全部轮过一遍：清空重新开始
      picked = []
      pool = gameIds.filter((id) => id !== current)
      if (pool.length === 0) pool = [...gameIds]
    }

    const target = pool[Math.floor(Math.random() * pool.length)]
    try {
      window.localStorage.setItem(KEY, JSON.stringify([...picked, target]))
    } catch {
      // 忽略存储失败
    }
    // 动画播到落定时再跳转，视觉上像"骰子停下后决定去哪"
    window.setTimeout(() => {
      void navigate({ to: `/library/games/${target}/all` })
      setRolling(false)
    }, 640)
  }

  return (
    <div ref={searchWrapRef} className="relative flex flex-row items-center gap-2 w-[250px]">
      <div className="flex-1 min-w-0">
        <Tooltip>
          <TooltipTrigger className="w-full">
            <ClearableInput
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
                updateAnchor()
              }}
              onFocus={() => {
                setOpen(true)
                updateAnchor()
              }}
              onBlur={() => window.setTimeout(() => setOpen(false), 150)}
              placeholder={t('librarybar.search.placeholder')}
              onClear={() => {
                setQuery('')
                setOpen(false)
              }}
              className="h-[32px] min-h-0 "
              inputClassName="h-[32px] min-h-0 bg-background/50 border-0"
            />
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('librarybar.search.tooltip')}</TooltipContent>
        </Tooltip>

      </div>
      {/* 随机游戏（骰子） */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="thirdary"
            size="icon"
            className="h-[32px] w-[32px] shrink-0"
            disabled={rolling}
            onClick={jumpRandomGame}
          >
            <span ref={diceRef} className="icon-[mdi--dice-5] w-7 h-7 -rotate-12 inline-block" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">随机一个游戏（不重复，轮完一遍才重新开始）</TooltipContent>
      </Tooltip>

      {/* 搜索结果下拉：Portal 到 body，任何页面都不会被裁剪/遮挡 */}
      {open &&
        showDropdown &&
        query.trim() !== '' &&
        anchor &&
        createPortal(
          <div
            className="fixed z-[999] overflow-y-auto rounded-md border border-border bg-background/95 shadow-xl backdrop-blur-md"
            style={{
              left: anchor.left,
              top: anchor.top,
              width: anchor.width,
              maxHeight: '60vh'
            }}
            onMouseDown={(event) => event.preventDefault()}
          >
            {results.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">没有匹配的游戏</div>
            ) : (
              results.map((gameId) => (
                <button
                  key={gameId}
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent"
                  onClick={() => openGame(gameId)}
                >
                  <span className="icon-[mdi--gamepad-variant-outline] w-4 h-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{gameMetaIndex[gameId]?.name ?? gameId}</span>
                </button>
              ))
            )}
          </div>,
          document.body
        )}
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
