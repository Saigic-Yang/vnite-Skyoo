import { useRef, useState } from 'react'
import { cn } from '~/utils'
import { HorizontalDragBar } from './HorizontalDragBar'

/**
 * 两行横向滚动条带：
 * - 条目按阅读顺序分成两行
 * - 支持按住鼠标左右拖动、底部可拖动导航条
 */
export function TwoRowStrip({
  ids,
  renderItem,
  rowGap = 24,
  itemGap = 32,
  className
}: {
  ids: string[]
  renderItem: (id: string, index: number) => React.ReactNode
  rowGap?: number
  itemGap?: number
  className?: string
}): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pan = useRef({ active: false, startX: 0, startScroll: 0, moved: false })
  const suppressClick = useRef(false)
  const [panning, setPanning] = useState(false)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    const el = scrollRef.current
    if (!el) return
    pan.current = { active: true, startX: event.clientX, startScroll: el.scrollLeft, moved: false }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const el = scrollRef.current
    const state = pan.current
    if (!el || !state.active) return
    const dx = event.clientX - state.startX
    if (!state.moved) {
      if (Math.abs(dx) < 6) return
      state.moved = true
      setPanning(true)
      try {
        el.setPointerCapture(event.pointerId)
      } catch {
        /* ignore */
      }
    }
    el.scrollLeft = state.startScroll - dx
  }

  const endPan = (): void => {
    if (pan.current.moved) {
      suppressClick.current = true
      window.setTimeout(() => {
        suppressClick.current = false
      }, 60)
    }
    pan.current = { active: false, startX: 0, startScroll: 0, moved: false }
    setPanning(false)
  }

  const mid = Math.ceil(ids.length / 2)
  const rows = ids.length > 0 ? [ids.slice(0, mid), ids.slice(mid)] : [[]]

  return (
    <div className={cn('flex flex-col', className)}>
      <div
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onPointerLeave={endPan}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        className={cn(
          'w-full overflow-x-auto scrollbar-none',
          panning ? 'cursor-grabbing select-none' : 'cursor-grab',
          'pt-6 pb-2 pl-10 pr-10'
        )}
      >
        <div className="flex flex-col" style={{ gap: rowGap }}>
          {rows.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="flex flex-row" style={{ gap: itemGap }}>
              {row.map((id, index) => (
                <div key={id} className="flex-shrink-0">
                  {renderItem(id, rowIndex * mid + index)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <HorizontalDragBar containerRef={scrollRef} />
    </div>
  )
}
