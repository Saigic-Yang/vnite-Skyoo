import { NSFWBlurLevel } from '@appTypes/models'
import { CrossfadeImage } from '@ui/cross-fade-image'
import { useEffect, useRef } from 'react'
import { useConfigState, useGameState } from '~/hooks'
import { useAttachmentStore } from '~/stores'

/**
 * 游戏详情页背景层（原 Light.tsx 里那套实现的完整抽取）。
 *
 * 包含原版全部动效：
 * - 鼠标跟随 3D：perspective(1400px) rotateX(±2.2°) rotateY(±2.6°) scale(1.045)
 * - 滚动视差：translateY(-scrollTop * 1.1)
 * - 两层 mask 渐变（外层 black30%→透明70%，图片 black70%→透明100%）
 * - CrossfadeImage 500ms 过渡 + NSFW 模糊
 *
 * 视差统一监听 window 的 `game-scroll` 事件（Game 组件滚动时会派发），
 * 因此整页详情与内联详情共用同一套逻辑、同一组参数。
 */
export function GameDetailBackdrop({
  gameId
}: {
  gameId: string
}): React.JSX.Element {
  const [glassBackgroundImage] = useConfigState('appearances.gameDetail.glassBackgroundImage')
  const [nsfwBlurLevel] = useConfigState('appearances.nsfwBlurLevel')
  const [nsfw] = useGameState(gameId, 'apperance.nsfw')
  const { getAttachmentInfo } = useAttachmentStore()

  const tiltLayerRef = useRef<HTMLDivElement>(null)
  const parallaxContainerRef = useRef<HTMLDivElement>(null)

  const info = getAttachmentInfo('game', gameId, `images/${glassBackgroundImage}.webp`)
  const src = `attachment://game/${gameId}/images/${glassBackgroundImage}.webp?t=${info?.timestamp}`

  // 鼠标跟随 3D（与原详情页同参数）
  useEffect(() => {
    let frame = 0
    let targetX = 0
    let targetY = 0
    let paused = false

    const handleLogoHover = (event: Event): void => {
      paused = Boolean((event as CustomEvent).detail)
      if (paused) {
        const layer = tiltLayerRef.current
        if (layer) {
          layer.style.transform = 'perspective(1400px) rotateX(0deg) rotateY(0deg) scale(1.02)'
        }
      }
    }

    const handleMove = (event: MouseEvent): void => {
      if (paused) return
      const width = window.innerWidth || 1
      const height = window.innerHeight || 1
      targetX = (event.clientX / width - 0.5) * 2
      targetY = (event.clientY / height - 0.5) * 2

      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const layer = tiltLayerRef.current
        if (!layer) return
        layer.style.transform = `perspective(1400px) rotateX(${(-targetY * 2.2).toFixed(
          2
        )}deg) rotateY(${(targetX * 2.6).toFixed(2)}deg) scale(1.045)`
      })
    }

    const handleLeave = (): void => {
      const layer = tiltLayerRef.current
      if (layer) {
        layer.style.transform = 'perspective(1400px) rotateX(0deg) rotateY(0deg) scale(1.02)'
      }
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('game-logo-hover', handleLogoHover as EventListener)
    document.addEventListener('mouseleave', handleLeave)
    return (): void => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('game-logo-hover', handleLogoHover as EventListener)
      document.removeEventListener('mouseleave', handleLeave)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  // 滚动视差（与原详情页同系数 1.1）
  // Game 组件在内容滚动时会把 scrollY 通过 `game-scroll` 事件派发到 window，
  // 这里直接复用该事件，因此内联详情与整页详情的视差行为完全一致。
  useEffect(() => {
    let ticking = false
    const handleGameScroll = (event: Event): void => {
      const scrollY = Math.max(0, (event as CustomEvent<{ scrollY: number }>).detail?.scrollY ?? 0)
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        if (parallaxContainerRef.current) {
          parallaxContainerRef.current.style.transform = `translateY(-${scrollY * 1.1}px)`
        }
        ticking = false
      })
    }

    window.addEventListener('game-scroll', handleGameScroll as EventListener)
    return (): void =>
      window.removeEventListener('game-scroll', handleGameScroll as EventListener)
  }, [])

  return (
    <>
      {/* ① 主色调延伸层：同一张背景图放大模糊，颜色自然取自图片主色，
             再用渐变一路过渡到页面背景色（保证正文可读） */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <CrossfadeImage
          src={src}
          className="h-full w-full scale-110 object-cover object-top opacity-55 blur-3xl"
          duration={500}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, transparent 0%, transparent 20%, color-mix(in oklab, var(--background) 65%, transparent) 45%, var(--background) 70%, var(--background) 100%)'
          }}
        />
      </div>

      {/* ② 头图（带 3D 与视差，只作用在顶部区域） */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
        style={{
          // 取设置值与容器 52% 的较小值，保证下方一定留出渐变区
          height: 'min(var(--header-max-height, 380px), 52%)',
          maskImage: 'linear-gradient(to bottom, black 30%, transparent 70%)',
          zIndex: 1
        }}
      >
        <div
          ref={tiltLayerRef}
          style={{
            width: '100%',
            height: '100%',
            transition: 'transform 260ms ease-out',
            transformStyle: 'preserve-3d'
          }}
        >
          <div ref={parallaxContainerRef} style={{ width: '100%', height: '100%' }}>
            <CrossfadeImage
              src={src}
              className="h-full w-full object-cover object-top"
              blur={nsfw && nsfwBlurLevel >= NSFWBlurLevel.BlurImage}
              duration={500}
              style={{ maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)' }}
            />
          </div>
        </div>
      </div>
    </>
  )
}
