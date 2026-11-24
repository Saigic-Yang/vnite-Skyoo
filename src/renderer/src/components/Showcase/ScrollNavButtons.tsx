import React, { useEffect, useState } from 'react'
import { Button } from '~/components/ui/button'
import { cn } from '~/utils'

function findViewport(anchor: HTMLElement | null): HTMLElement | null {
  if (!anchor) return null
  return (
    (anchor.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null) ??
    (anchor.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null) ??
    (anchor.closest('[data-slot="scroll-area-viewport"]') as HTMLElement | null) ??
    (anchor.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null) ??
    anchor
  )
}

/** 一键到顶部 / 一键到底部（成对，固定在右下角） */
export function ScrollNavButtons({
  anchorRef,
  threshold = 300
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>
  threshold?: number
}): React.JSX.Element {
  const [canUp, setCanUp] = useState(false)
  const [canDown, setCanDown] = useState(false)

  useEffect(() => {
    const viewport = findViewport(anchorRef.current)
    if (!viewport) return

    const update = (): void => {
      setCanUp(viewport.scrollTop > threshold)
      setCanDown(viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > threshold)
    }

    update()
    viewport.addEventListener('scroll', update)
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    return () => {
      viewport.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [anchorRef, threshold])

  const scrollTo = (top: number): void => {
    findViewport(anchorRef.current)?.scrollTo({ top, behavior: 'instant' })
  }

  return (
    <div className="fixed right-6 bottom-6 z-50 flex flex-col gap-2">
      <Button
        size="icon"
        title="回到顶部"
        className={cn(
          'shadow-md transition-all duration-200 hover:bg-primary',
          canUp ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => scrollTo(0)}
      >
        <span className="icon-[mdi--arrow-up] w-5 h-5" />
      </Button>
      <Button
        size="icon"
        title="跳到底部"
        className={cn(
          'shadow-md transition-all duration-200 hover:bg-primary',
          canDown ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => {
          const viewport = findViewport(anchorRef.current)
          if (viewport) scrollTo(viewport.scrollHeight)
        }}
      >
        <span className="icon-[mdi--arrow-down] w-5 h-5" />
      </Button>
    </div>
  )
}
