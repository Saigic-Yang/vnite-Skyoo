import { Button } from '@ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/tooltip'
import { Game } from '~/components/Game'
import { GameDetailBackdrop } from '~/components/Game/GameDetailBackdrop'
import { useGameDetailStore } from '~/components/Game/store'

/**
 * 在某个区域内联渲染游戏详情（收藏右栏 / 所有游戏网格区）。
 * 背景直接调用详情页原组件 GameDetailBackdrop（3D + 视差 + 主色调渐变）。
 */
export function InlineGameDetail({
  gameId,
  onClose
}: {
  gameId: string
  onClose: () => void
}): React.JSX.Element {
  const openPropertiesDialog = useGameDetailStore((state) => state.openPropertiesDialog)

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-background">
      <GameDetailBackdrop gameId={gameId} />

      {/* 右上角操作：关闭 + 更换背景（背景改动写入附件，全局同步） */}
      <div className="absolute right-4 top-3 z-20 flex flex-col gap-2">
        <Button variant="secondary" size="icon" title="关闭" onClick={onClose}>
          <span className="icon-[mdi--close] w-5 h-5" />
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              title="更换背景图"
              onClick={() => openPropertiesDialog('media')}
            >
              <span className="icon-[mdi--image-edit-outline] w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">媒体素材（换背景图）</TooltipContent>
        </Tooltip>
      </div>

      <div className="relative z-10 h-full overflow-y-auto">
        <Game gameId={gameId} hideMediaButton />
      </div>
    </div>
  )
}
