import { useEffect, useRef, useState } from 'react'
import { cn } from '~/utils'

/**
 * 可拖动的横向导航条（代替隐藏的原生滚动条）。
 * - 拖动滑块：直接左右滚动内容
 * - 点击轨道空白处：翻页
 */
export function HorizontalDragBar({
  containerRef,
  className
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  className?: string
}): React.JSX.Element | null {
  const [thumb, setThumb] = useState({ left: 0, width: 100 })
  const [scrollable, setScrollable] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartScroll = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = (): void => {
      const scrollWidth = el.scrollWidth
      const clientWidth = el.clientWidth
      const canScroll = scrollWidth - clientWidth > 2
      setScrollable(canScroll)
      if (!canScroll) {
        setThumb({ left: 0, width: 100 })
        return
      }
      const width = Math.max((clientWidth / scrollWidth) * 100, 12)
      const maxScroll = scrollWidth - clientWidth
      const left = (el.scrollLeft / maxScroll) * (100 - width)
      setThumb({ left, width })
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return (): void => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [containerRef])

  const handleThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.stopPropagation()
    dragging.current = true
    dragStartX.current = event.clientX
    dragStartScroll.current = containerRef.current?.scrollLeft ?? 0
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleThumbPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragging.current) return
    const el = containerRef.current
    const track = trackRef.current
    if (!el || !track) return
    const maxScroll = el.scrollWidth - el.clientWidth
    const trackWidth = track.clientWidth
    const thumbWidth = (thumb.width / 100) * trackWidth
    const usable = trackWidth - thumbWidth
    if (usable <= 0) return
    const delta = event.clientX - dragStartX.current
    el.scrollLeft = dragStartScroll.current + (delta / usable) * maxScroll
  }

  const handleThumbPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    dragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    const el = containerRef.current
    const track = trackRef.current
    if (!el || !track) return
    const rect = track.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    el.scrollTo({ left: ratio * (el.scrollWidth - el.clientWidth), behavior: 'smooth' })
  }

  if (!scrollable) return null

  return (
    <div
      ref={trackRef}
      onPointerDown={handleTrackPointerDown}
      className={cn('relative h-[8px] rounded-full bg-muted/40 cursor-pointer mx-8 mt-1', className)}
    >
      <div
        onPointerDown={handleThumbPointerDown}
        onPointerMove={handleThumbPointerMove}
        onPointerUp={handleThumbPointerUp}
        onPointerCancel={handleThumbPointerUp}
        className={cn(
          'absolute top-0 h-full rounded-full bg-muted-foreground/50',
          'hover:bg-muted-foreground/80 transition-colors cursor-grab active:cursor-grabbing'
        )}
        style={{ left: `${thumb.left}%`, width: `${thumb.width}%` }}
      />
    </div>
  )
}
