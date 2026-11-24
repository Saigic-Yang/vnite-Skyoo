import { NSFWBlurLevel } from '@appTypes/models'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTilt } from '~/components/animations/useTilt'
import { CollectionCM } from '~/components/contextMenu/CollectionCM'
import { useGameBatchEditorStore } from '~/components/GameBatchEditor/store'
import { GameImage } from '~/components/ui/game-image'
import { useConfigState, useGameState } from '~/hooks'
import { useGameCollectionStore } from '~/stores'
import { useVisibleGameIds } from '~/stores/game'
import { cn } from '~/utils'
import {
  attachClosestEdge,
  calPreviewOffset,
  combine,
  createPortal,
  draggable,
  DropIndicator,
  dropTargetForElements,
  extractClosestEdge,
  invariant,
  setCustomNativeDragPreview,
  type Edge,
  type PreviewState
} from '~/utils/dnd-utills'

function Preview({
  collectionName,
  collectionLength,
  transparentBackground = false
}: {
  collectionName: string
  collectionLength: number
  transparentBackground?: boolean
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'group relative overflow-hidden w-[148px] h-[222px] rounded-lg',
        'transition-all duration-300 ease-in-out',
        'border-4 border-dashed border-primary',
        !transparentBackground && ' bg-background'
      )}
    >
      <div
        className={cn(
          'absolute inset-0 z-20 mt-7',
          'flex items-center justify-center',
          'pointer-events-none'
        )}
      >
        <div className="flex flex-col items-center justify-center gap-1">
          <div className={cn('text-accent-foreground text-lg')}>{collectionName}</div>
          <div className={cn('text-accent-foreground/70')}>{`( ${collectionLength} )`}</div>
        </div>
      </div>
    </div>
  )
}

export function CollectionPoster({
  collectionId,
  className,
  parentGap = 24,
  position = 'center',
  dragScenario,
  square = false,
  onOpen,
  active = false
}: {
  collectionId: string
  className?: string
  parentGap?: number // Gap(px) between posters
  position?: 'right' | 'left' | 'center' // poster position in the container
  dragScenario?: string
  /** 正方形卡片（收藏页左侧列表） */
  square?: boolean
  /** 提供后点击不再跳转路由，直接回调 */
  onOpen?: (collectionId: string) => void
  /** 激活态：描边画在卡片图片本身，而不是外层容器 */
  active?: boolean
}): React.JSX.Element {
  const router = useRouter()
  const collections = useGameCollectionStore((state) => state.documents)
  const reorderCollections = useGameCollectionStore((state) => state.reorderCollections)
  const collectionName = collections[collectionId].name
  const collectionGames = collections[collectionId].games
  const [nsfwBlurLevel] = useConfigState('appearances.nsfwBlurLevel')
  const visibleGames = useVisibleGameIds(collectionGames)
  const length = visibleGames.length // length > 0, guaranteed by parent component
  const gameId = visibleGames[0] || collectionGames[0]
  const [nsfw] = useGameState(gameId, 'apperance.nsfw')
  // 悬停 3D 微动效（与详情页封面同强度）
  const tilt = useTilt(18, 1.12)

  // Batch mode and selection state
  const { selectedGamesMap, selectGames, unselectGames, isBatchMode } = useGameBatchEditorStore()

  // Check if all games in the collection are selected
  const isCollectionFullySelected = (): boolean => {
    if (collectionGames.length === 0) return false

    return collectionGames.every((gameId) => selectedGamesMap[gameId])
  }

  // Check if some games in the collection are selected
  const isCollectionPartiallySelected = (): boolean => {
    if (collectionGames.length === 0) return false

    return (
      collectionGames.some((gameId) => selectedGamesMap[gameId]) &&
      !collectionGames.every((gameId) => selectedGamesMap[gameId])
    )
  }

  const isSelected = isCollectionFullySelected()
  const isPartiallySelected = isCollectionPartiallySelected()

  // Handle select/unselect collection
  const handleSelect = (e: React.MouseEvent): void => {
    e.stopPropagation()

    if (isSelected) {
      // If all games are selected, unselect
      unselectGames(collectionGames)
    } else {
      // Select all games in the collection
      selectGames(collectionGames)
    }
  }

  const handleCollectionClick = (e: React.MouseEvent): void => {
    if (e.ctrlKey || e.metaKey) {
      handleSelect(e)
    } else if (isBatchMode && !e.ctrlKey && !e.metaKey) {
      // In batch mode, select the collection on click
      handleSelect(e)
    } else if (onOpen) {
      onOpen(collectionId)
    } else {
      // Default behavior: navigate to collection page
      router.navigate({ to: `/library/collections/${collectionId}` })
    }
  }

  const ref_ = useRef<HTMLDivElement>(null)
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
  const [dragging, setDragging] = useState<boolean>(false)
  const [previewState, setPreviewState] = useState<PreviewState>({ type: 'idle' })

  useEffect(() => {
    if (!dragScenario) return

    const el = ref_.current
    invariant(el)

    return combine(
      draggable({
        element: el,
        onGenerateDragPreview({ nativeSetDragImage }) {
          setCustomNativeDragPreview({
            getOffset: calPreviewOffset(0.66, 0.66),
            render({ container }) {
              setPreviewState({ type: 'preview', container })
              return (): void => setPreviewState({ type: 'idle' })
            },
            nativeSetDragImage
          })
        },
        getInitialData: () => ({ dragScenario: dragScenario, uuid: collectionId }),
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false)
      }),

      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => source.data.dragScenario === dragScenario,
        getData: ({ input, element }) => {
          // your base data you want to attach to the drop target
          const data = { uuid: collectionId }
          // this will 'attach' the closest edge to your `data` object
          return attachClosestEdge(data, { input, element, allowedEdges: ['right', 'left'] })
        },
        onDrag({ self, source }) {
          if (source.element === el) {
            setClosestEdge(null)
            return
          }
          const closestEdge = extractClosestEdge(self.data)
          setClosestEdge(closestEdge)
        },
        onDragLeave: () => setClosestEdge(null),
        onDrop({ self, source }) {
          reorderCollections(
            source.data.uuid as string,
            self.data.uuid as string,
            extractClosestEdge(self.data) === 'left' ? 'front' : 'back'
          )
          setClosestEdge(null)
        }
      })
    )
  }, [])

  return (
    <CollectionCM collectionId={collectionId}>
      <div
        className={cn(
          'group relative rounded-lg hover:z-30 focus-within:z-30',
          active && 'z-20'
        )}
        ref={ref_}
      >
        {dragging ? (
          <Preview
            collectionLength={length}
            collectionName={collectionName}
            transparentBackground={true}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-[8px] cursor-pointer group">
            <div
              {...tilt.bind}
              style={tilt.style}
              className={cn(
                'rounded-lg shadow-md',
                'transition-shadow duration-200 ease-out group-hover:shadow-xl',
                // 激活描边交给图片层，避免落位偏移
                active
                  ? 'ring-0'
                  : isSelected || isPartiallySelected
                    ? 'ring-2'
                    : 'ring-0 ring-border group-hover:ring-2',
                active
                  ? ''
                  : isSelected
                    ? 'ring-primary'
                    : isPartiallySelected
                      ? 'ring-primary/50'
                      : 'group-hover:ring-primary',
                'relative overflow-hidden group'
              )}
              onClick={handleCollectionClick}
            >
              <div className="relative overflow-hidden rounded-lg">
                <GameImage
                  gameId={gameId}
                  type="cover"
                  blur={nsfw && nsfwBlurLevel >= NSFWBlurLevel.BlurImage}
                  initialMask={true}
                  blurType="poster"
                  alt={gameId}
                  className={cn(
                    'w-[148px] cursor-pointer object-cover',
                    square ? 'h-[148px]' : 'h-[222px]',
                    className
                  )}
                  draggable="false"
                  fallback={
                    <div
                      className={cn(
                        'w-[148px] cursor-pointer object-cover flex items-center justify-center bg-muted/50',
                        square ? 'h-[148px]' : 'h-[222px]',
                        className
                      )}
                    ></div>
                  }
                />
                {/* 选中态：用 border + inset 发光（画在元素内部，绝不会被父级 overflow-hidden 裁掉） */}
                {active && (
                  <div
                    className={cn(
                      'pointer-events-none absolute inset-0 z-20 rounded-lg',
                      'border-2 border-primary shadow-[inset_0_0_18px_hsl(var(--primary)/0.55)]'
                    )}
                  />
                )}
              </div>
              {/* Hover Layer */}
              <div
                className={cn(
                  'absolute inset-x-0 bottom-0 h-full bg-accent/50',
                  'transition-opacity duration-300 ease-in-out',
                  'flex flex-col p-[10px] text-accent-foreground',
                  'transform',
                  isSelected || isPartiallySelected
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100',
                  'overflow-hidden'
                )}
              >
                {/* Multi-select dot */}
                <div
                  className={cn(
                    'absolute left-2 top-2 shadow-md z-20 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer',
                    'transition-colors duration-200',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : isPartiallySelected
                        ? 'bg-primary/50 text-primary-foreground'
                        : 'bg-muted/70 hover:bg-muted/90'
                  )}
                  onClick={handleSelect}
                >
                  {isSelected && <span className="icon-[mdi--check] w-3 h-3" />}
                  {isPartiallySelected && <span className="icon-[mdi--minus] w-3 h-3" />}
                </div>
                {/* Collection Length */}
                <div className="absolute inset-0 flex items-center justify-center flex-grow">
                  <div className="text-xl font-semibold">{length}</div>
                </div>
              </div>
            </div>
            <div className="text-xs text-foreground truncate cursor-pointer hover:underline w-[148px] text-center decoration-foreground">
              {collectionName}
            </div>
          </div>
        )}

        {closestEdge && (
          <DropIndicator
            edge={closestEdge}
            gap={closestEdge === position ? '16px' : `${parentGap}px`}
          />
        )}
        {previewState.type === 'preview'
          ? createPortal(
              <Preview collectionLength={length} collectionName={collectionName} />,
              previewState.container
            )
          : null}
      </div>
    </CollectionCM>
  )
}
