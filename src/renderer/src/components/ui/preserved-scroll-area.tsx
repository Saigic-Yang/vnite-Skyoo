import { useEffect, useRef } from 'react'
import { ScrollArea } from './scroll-area'

/**
 * 会「记住」滚动位置的 ScrollArea。
 *
 * 左侧游戏列表在刷新（例如修改游玩状态后触发刷新）时会重新挂载，
 * 默认会跳回顶部；这里把每个分组最近一次的 scrollTop 存在模块级 Map 里，
 * 重新挂载后自动恢复到原位置。
 */
const scrollMemory = new Map<string, number>()

export function PreservedScrollArea({
  scrollKey,
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollArea> & { scrollKey: string }): React.JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewport = wrapRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    if (!viewport) return

    const saved = scrollMemory.get(scrollKey)
    if (typeof saved === 'number' && saved > 0) {
      // 等一帧，确保内容已经渲染出来后再恢复
      requestAnimationFrame(() => {
        viewport.scrollTop = saved
      })
    }

    const handleScroll = (): void => {
      scrollMemory.set(scrollKey, viewport.scrollTop)
    }
    viewport.addEventListener('scroll', handleScroll, { passive: true })

    return (): void => {
      viewport.removeEventListener('scroll', handleScroll)
    }
  }, [scrollKey])

  return (
    <div ref={wrapRef} className="w-full h-full">
      <ScrollArea className={className} {...props}>
        {children}
      </ScrollArea>
    </div>
  )
}
