import { NSFWBlurLevel } from '@appTypes/models'
import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '~/components/ui/context-menu'
import { toast } from 'sonner'
import { ipcManager } from '~/app/ipc'
import { Button } from '~/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useConfigState, useGameLocalState, useGameState } from '~/hooks'
import { usePathExistsStore } from '~/stores/pathExistsStore'
import { useRunningGames } from '~/pages/Library/store'
import { cn, copyWithToast } from '~/utils'
import { GameImage } from '../ui/game-image'
import { Config } from './Config'
import { Record } from './Overview/Record'
import { RatingsBar } from './RatingsBar'
import { StartGame } from './StartGame'
import { StopGame } from './StopGame'
import { useGameDetailStore } from './store'
import { openLargeGameMediaImage } from './utils'

export function Header({
  gameId,
  className
}: {
  gameId: string
  className?: string
}): React.JSX.Element {
  const runningGames = useRunningGames((state) => state.runningGames)
  const [name] = useGameState(gameId, 'metadata.name')
  const [originalName] = useGameState(gameId, 'metadata.originalName')
  const [showOriginalNameInGameHeader] = useConfigState('game.gameHeader.showOriginalName')
  const [showCover] = useConfigState('appearances.gameDetail.showCover')
  const [nsfw] = useGameState(gameId, 'apperance.nsfw')
  const [rootPath] = useGameLocalState(gameId, 'utils.rootPath')
  const [pathMissing, setPathMissing] = React.useState(false)
  const gamePathState = usePathExistsStore((state) => state.gamePaths[gameId])
  const recheckPath = usePathExistsStore((state) => state.recheck)
  // 设置过路径但文件已不存在 → 图标标红
  const rootPathMissing = Boolean(gamePathState?.hasPath) && gamePathState?.exists === false
  const [nsfwBlurLevel] = useConfigState('appearances.nsfwBlurLevel')
  const openPropertiesDialog = useGameDetailStore((state) => state.openPropertiesDialog)
  const openImageViewer = useGameDetailStore((state) => state.openImageViewer)

  const stringToBase64 = (str: string): string =>
    btoa(String.fromCharCode(...new TextEncoder().encode(str)))
  const obfuscatedName = stringToBase64(name).slice(0, name.length)

  const { t } = useTranslation('game')

  // 封面悬停：轻微放大 + 3D 跟随鼠标
  const [coverTilt, setCoverTilt] = React.useState({ x: 0, y: 0, active: false })

  const handleCoverMove = (event: React.MouseEvent<HTMLDivElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    setCoverTilt({
      x: (event.clientX - rect.left) / rect.width - 0.5,
      y: (event.clientY - rect.top) / rect.height - 0.5,
      active: true
    })
  }

  const resetCoverTilt = (): void => setCoverTilt({ x: 0, y: 0, active: false })

  return (
    <div className={cn('flex-col flex gap-5 px-7 py-5 pl-6 pt-6 relative', className)}>
      {/* Game name section */}
      <div className="flex flex-row justify-between items-end">
        <div
          className={cn('flex flex-col gap-3 grow overflow-hidden items-start justify-start pl-1')}
        >
          <div
            className={cn(
              'font-bold text-2xl text-accent-foreground cursor-pointer select-none text-shadow-lg break-all group'
            )}
            onClick={() => copyWithToast(name)}
          >
            {nsfw && nsfwBlurLevel >= NSFWBlurLevel.BlurImageAndTitle ? (
              <>
                <span className="block group-hover:hidden">{obfuscatedName}</span>
                <span className="hidden group-hover:block">{name}</span>
              </>
            ) : (
              name
            )}
          </div>
          {showOriginalNameInGameHeader && originalName && (
            <div
              className={cn(
                'font-bold text-accent-foreground cursor-pointer select-none break-all group'
              )}
              onClick={() => copyWithToast(originalName)}
            >
              {nsfw && nsfwBlurLevel >= NSFWBlurLevel.BlurImageAndTitle ? (
                <>
                  <span className="block group-hover:hidden">{obfuscatedName}</span>
                  <span className="hidden group-hover:block">{originalName}</span>
                </>
              ) : (
                originalName
              )}
            </div>
          )}
          <div
            className={cn(
              'flex flex-row justify-between items-end duration-300 select-none mt-2 pb-1',
              '3xl:gap-5'
            )}
          >
            <div className={cn('flex flex-row gap-3 items-end z-20', '3xl:gap-5')}>
              {/* Start/Stop game button */}
              {runningGames.includes(gameId) ? (
                <StopGame gameId={gameId} className={cn('w-[170px] h-[40px]')} />
              ) : (
                <StartGame gameId={gameId} className={cn('w-[170px] h-[40px]')} />
              )}

              {/* Configuration button */}
              <Config gameId={gameId} />

              {/* 浏览本地文件（独立的文件夹按钮，取代右键菜单里的入口） */}
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="thirdary"
                      size="icon"
                      className={cn(
                        'h-[40px] w-[40px]',
                        (pathMissing || rootPathMissing) && 'text-destructive'
                      )}
                      onClick={async () => {
                        if (!rootPath) {
                          toast.warning(t('detail.manage.notifications.gamePathNotSet'))
                          return
                        }
                        const exists = await recheckPath(gameId)
                        if (!exists) {
                          setPathMissing(true)
                          toast.error('本地文件已删除')
                          return
                        }
                        setPathMissing(false)
                        void ipcManager.invoke('system:open-path-in-explorer', rootPath)
                      }}
                    >
                      <span className="icon-[mdi--folder-open-outline] w-5 h-5"></span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {t('detail.manage.browseLocalFiles')}
                  </TooltipContent>
                </Tooltip>
                {pathMissing && (
                  <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-xs text-destructive">
                    本地文件已删除
                  </span>
                )}
              </div>

              {/* 评分徽章：我的评分 / Steam / Metacritic / OpenCritic + 刷新 */}
              <RatingsBar gameId={gameId} />
            </div>
          </div>
        </div>
        {/* Game cover image with context menu */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className="relative lg:mr-3 pb-1 shrink-0"
              style={{ perspective: '900px' }}
              onMouseMove={handleCoverMove}
              onMouseLeave={resetCoverTilt}
            >
              {showCover && (
                <div
                  className={cn('transition-transform duration-200 ease-out will-change-transform')}
                  style={{
                    transform: `rotateX(${(-coverTilt.y * 18).toFixed(2)}deg) rotateY(${(
                      coverTilt.x * 20
                    ).toFixed(2)}deg) scale(${coverTilt.active ? 1.12 : 1})`,
                    transformStyle: 'preserve-3d'
                  }}
                >
                  <GameImage
                    gameId={gameId}
                    key={`${gameId}-poster`}
                    type="cover"
                    blur={nsfw && nsfwBlurLevel >= NSFWBlurLevel.BlurImage}
                    className={cn('w-auto h-[170px] object-cover rounded-lg shadow-md')}
                    fallback={<div className="h-[170px]" />}
                    onClick={() => {
                      void openLargeGameMediaImage({
                        gameId,
                        type: 'cover',
                        openImageViewer
                      })
                    }}
                  />
                </div>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className={cn('w-40')}>
            <ContextMenuItem onSelect={() => openPropertiesDialog('media')}>
              {t('detail.contextMenu.editMediaProperties')}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
      {/* Game record section */}
      <div className="pt-6">
        <Record gameId={gameId} />
      </div>
    </div>
  )
}
