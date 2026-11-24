import { NSFWBlurLevel } from '@appTypes/models'
import defaultBackground from '@assets/defaultBackground.png'
import { useLocation } from '@tanstack/react-router'
import { CrossfadeImage } from '@ui/cross-fade-image'
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { useTheme } from '~/components/ThemeProvider'
import { useConfigState, useGameState } from '~/hooks'
import { useEffectiveLibraryBarWidth } from '~/hooks/useShowLibrarybar'
import { useAttachmentStore } from '~/stores'
import { getRecentGameIds, useGameCollectionStore, useGameRegistry } from '~/stores/game'
import { cn } from '~/utils'

// eslint-disable-next-line
export const useLightStore = create<{
  refreshId: number
  refresh: () => void
}>((set) => ({
  refreshId: 0,
  refresh: () => set((state) => ({ refreshId: state.refreshId + 1 }))
}))

export function Light(): React.JSX.Element {
  const { pathname } = useLocation()
  const [gameId, setGameId] = useState<string>('')
  const [imageUrl, setImageUrl] = useState<string>('')
  const { getAttachmentInfo, setAttachmentError } = useAttachmentStore()
  const getGameCollectionValue = useGameCollectionStore((state) => state.getGameCollectionValue)
  const collections = useGameCollectionStore((state) => state.documents)
  const gameMetaIndex = useGameRegistry((state) => state.gameMetaIndex)
  const [customBackground] = useConfigState('appearances.background.customBackground')
  const [darkGlassBlur] = useConfigState('appearances.glass.dark.blur')
  const [darkGlassOpacity] = useConfigState('appearances.glass.dark.opacity')
  const [lightGlassBlur] = useConfigState('appearances.glass.light.blur')
  const [lightGlassOpacity] = useConfigState('appearances.glass.light.opacity')
  const [glassBlur, setGlassBlur] = useState(darkGlassBlur)
  const [glassOpacity, setGlassOpacity] = useState(darkGlassOpacity)
  const [nsfwBlurLevel] = useConfigState('appearances.nsfwBlurLevel')
  const [nsfw] = useGameState(gameId, 'apperance.nsfw')
  const detailBackgroundRef = useRef<HTMLDivElement>(null)
  const tiltLayerRef = useRef<HTMLDivElement>(null)
  const parallaxContainerRef = useRef<HTMLDivElement>(null)
  const libraryBarWidth = useEffectiveLibraryBarWidth()
  const { isDark } = useTheme()
  const refreshId = useLightStore((state) => state.refreshId)

  // 是否处于游戏详情页（背景层是否启用）
  const isGameDetailRoute = pathname.includes('/library/games/') && gameId !== ''

  // 侧栏宽度（可由右侧分隔条拖动调整）
  const [configSidebarWidth] = useConfigState('appearances.sidebar.width')
  const sidebarWidth = Math.max(56, Number(configSidebarWidth) || 56)

  const [showHeaderImage] = useConfigState('appearances.gameDetail.showHeaderImage')
  const [gameGlassBackgroundImage] = useConfigState('appearances.gameDetail.glassBackgroundImage')

  useEffect(() => {
    // Set initial background based on the current theme
    if (isDark) {
      setGlassBlur(darkGlassBlur)
      setGlassOpacity(darkGlassOpacity)
    } else {
      setGlassBlur(lightGlassBlur)
      setGlassOpacity(lightGlassOpacity)
    }
  }, [isDark, darkGlassBlur, darkGlassOpacity, lightGlassBlur, lightGlassOpacity])

  const getGameBackgroundUrl = (id: string): string => {
    const info = getAttachmentInfo('game', id, `images/${gameGlassBackgroundImage}.webp`)
    return `attachment://game/${id}/images/${gameGlassBackgroundImage}.webp?t=${info?.timestamp}`
  }

  const getCustomBackgroundUrl = (): string => {
    const info = getAttachmentInfo(
      'config',
      'media',
      `background-${isDark ? 'dark' : 'light'}.webp`
    )
    if (info?.error && isDark) {
      return defaultBackground
    }
    return `attachment://config/media/background-${isDark ? 'dark' : 'light'}.webp?t=${info?.timestamp}`
  }

  const getRecentGameId = (): string => getRecentGameIds(1)[0] || ''

  const updateBackgroundImage = (newUrl: string, newGameId: string = ''): void => {
    if (newUrl === imageUrl) return

    setImageUrl(newUrl)
    if (newGameId) setGameId(newGameId)
  }

  const updateRecentGameBackgroundImage = (): void => {
    const recentGameId = getRecentGameId()
    if (recentGameId) {
      updateBackgroundImage(getGameBackgroundUrl(recentGameId), recentGameId)
      return
    }

    updateBackgroundImage(defaultBackground)
    setGameId('')
  }

  // Use requestAnimationFrame for smoother updates
  let ticking = false

  // Handle scroll events
  useEffect(() => {
    const handleScroll = (e: Event): void => {
      // Get the scroll element
      const scrollElement = e.target as HTMLElement

      // Calculate the scroll position, limiting the minimum value to 0 (to prevent scrolling up beyond the top)
      const currentScrollY = Math.max(0, scrollElement.scrollTop)

      // Use requestAnimationFrame to optimize performance
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Directly update the parallax background position
          if (parallaxContainerRef.current) {
            parallaxContainerRef.current.style.transform = `translateY(-${currentScrollY * 1.1}px)`
          }
          ticking = false
        })
        ticking = true
      }
    }

    // Handle custom scroll events dispatched by game components
    const handleGameScroll = (e: CustomEvent): void => {
      const currentScrollY = e.detail?.scrollY || 0

      // Use requestAnimationFrame to optimize performance
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (parallaxContainerRef.current) {
            parallaxContainerRef.current.style.transform = `translateY(-${currentScrollY * 1.2}px)`
          }
          ticking = false
        })
        ticking = true
      }
    }

    // Listen for custom scroll events
    window.addEventListener('game-scroll', handleGameScroll as EventListener)

    // Listen for gameDetail scroll events
    document.addEventListener('scroll', handleScroll)

    // Listen for scroll events on all elements marked as scrollable
    document.querySelectorAll('.scrollable-content').forEach((el) => {
      el.addEventListener('scroll', handleScroll)
    })

    return (): void => {
      window.removeEventListener('game-scroll', handleGameScroll as EventListener)
      document.removeEventListener('scroll', handleScroll)
      document.querySelectorAll('.scrollable-content').forEach((el) => {
        el.removeEventListener('scroll', handleScroll)
      })
    }
  }, [])

  // Update background image based on the current route
  useEffect(() => {
    if (pathname.includes('/library/games/')) {
      const currentGameId = pathname.split('/games/')[1]?.split('/')[0]
      updateBackgroundImage(getGameBackgroundUrl(currentGameId), currentGameId)
    } else if (pathname.includes('/library/collections')) {
      const currentCollectionId = pathname.split('/collections/')[1]?.split('/')[0]

      if (!currentCollectionId) {
        if (customBackground) {
          updateBackgroundImage(getCustomBackgroundUrl())
        } else {
          updateRecentGameBackgroundImage()
        }
        return
      }

      const currentGameId = getGameCollectionValue(currentCollectionId, 'games')[0]
      if (currentGameId) {
        updateBackgroundImage(getGameBackgroundUrl(currentGameId), currentGameId)
      }
    } else {
      if (customBackground) {
        updateBackgroundImage(getCustomBackgroundUrl())
        return
      }

      updateRecentGameBackgroundImage()
    }
  }, [
    pathname,
    getGameCollectionValue,
    collections,
    gameMetaIndex,
    customBackground,
    isDark,
    refreshId,
    getAttachmentInfo
  ])

  /**
   * 鼠标跟随的轻微 3D 立体效果（仅游戏详情页的背景层）。
   * 变换写在最外层容器上，跟滚动用的 translateY 在内层，互不干扰。
   */
  useEffect(() => {
    if (!isGameDetailRoute) return

    let frame = 0
    let targetX = 0
    let targetY = 0
    // 鼠标悬停在徽章上时暂停背景 3D，避免两套动效打架
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
      // 归一化到 -1 ~ 1
      targetX = (event.clientX / width - 0.5) * 2
      targetY = (event.clientY / height - 0.5) * 2

      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const layer = tiltLayerRef.current
        if (!layer) return
        // 幅度刻意做得小：±2° 左右，只做「轻微」的立体感
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
  }, [isGameDetailRoute])

  // Update CSS variables for glass effect
  useEffect(() => {
    document.documentElement.style.setProperty('--glass-opacity', glassOpacity * 100 + '%')
    document.documentElement.style.setProperty('--glass-blur', `${glassBlur}px`)
  }, [glassOpacity, glassBlur])

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10">
      {/* Game detail page specific background layer - only shown on games route */}
      {isGameDetailRoute && (
        <div
          ref={detailBackgroundRef}
          className={cn('absolute overflow-hidden', 'will-change-transform')}
          style={{
            left: `${libraryBarWidth + sidebarWidth + 1 - (libraryBarWidth === 0 ? 1 : 0)}px`,
            top: '50px',
            width: `calc(100% - ${libraryBarWidth + sidebarWidth + 1 - (libraryBarWidth === 0 ? 1 : 0)}px)`,
            height: 'calc(100% - 50px)',
            zIndex: 15,
            clipPath: 'inset(0 0 0 0)' // Ensure content does not overflow this container
          }}
        >
          {/* 3D 跟随层：变换放在被裁剪容器内部，旋转时不会露出边角 */}
          <div
            ref={tiltLayerRef}
            style={{
              width: '100%',
              height: '100%',
              transition: 'transform 260ms ease-out',
              transformStyle: 'preserve-3d'
            }}
          >
            {/* Internal container for parallax scrolling effect */}
            <div
              ref={parallaxContainerRef}
              style={{
                width: '100%',
                height: '100%',
                maskImage: 'linear-gradient(to bottom, black 30%, transparent 70%)'
              }}
            >
            {showHeaderImage ? (
              <CrossfadeImage
                src={imageUrl}
                className={cn(`w-full h-auto max-h-(--header-max-height) object-top object-cover`)}
                blur={nsfw && nsfwBlurLevel >= NSFWBlurLevel.BlurImage}
                duration={500}
                onError={() => {
                  if (customBackground) {
                    setAttachmentError('config', 'media', 'background.webp', true)
                  } else {
                    setAttachmentError('game', gameId, 'images/background.webp', true)
                  }
                }}
                style={{
                  maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)'
                }}
              />
            ) : (
              <div
                className={`w-full h-auto max-h-(--header-max-height) object-top object-cover`}
              ></div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Glass effect layer */}
      <div
        className={cn(
          'absolute top-0 left-0 w-full h-full bg-background/[var(--glass-opacity)] backdrop-filter backdrop-blur-[var(--glass-blur)] z-10'
        )}
      ></div>

      {/* Background image layer */}
      <CrossfadeImage
        src={imageUrl}
        className="w-full h-full"
        duration={500}
        onError={() => {
          if (customBackground) {
            setAttachmentError(
              'config',
              'media',
              `background-${isDark ? 'dark' : 'light'}.webp`,
              true
            )
          } else {
            setAttachmentError('game', gameId, 'images/background.webp', true)
          }
        }}
      />
    </div>
  )
}
