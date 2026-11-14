import { useRef } from 'react'

/**
 * 鼠标跟随的 3D 倾斜效果（悬停时轻微放大 + 纵深）。
 *
 * 用法：
 *   const tilt = useTilt(18, 1.12)
 *   <div {...tilt.bind} style={tilt.style} className="...">…</div>
 *
 * 性能要点（之前很卡的原因）：
 *   1. 不要在卡片上用 `transition-all` —— 它会把每次 transform 更新变成 300ms 补间，
 *      导致完全跟不上鼠标。这里由 hook 自己设置 transition：
 *      移动时 60ms（几乎没有延迟）、离开时 240ms 缓动回弹。
 *   2. 只写 `transform`（合成层，不触发布局/重绘），并用 rAF 合并同一帧的多次鼠标事件。
 *   3. perspective 直接写在 transform 里，父元素不需要再加 perspective。
 */
export function useTilt(
  maxTilt = 18,
  scale = 1.12
): {
  bind: {
    ref: React.RefObject<HTMLDivElement | null>
    onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void
    onMouseEnter: () => void
    onMouseLeave: () => void
  }
  style: React.CSSProperties
} {
  const ref = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const target = useRef({ x: 0, y: 0 })
  const active = useRef(false)

  const apply = (): void => {
    const el = ref.current
    if (!el) return
    const rotateX = (-target.current.y * maxTilt).toFixed(2)
    const rotateY = (target.current.x * maxTilt).toFixed(2)
    const depth = active.current ? 28 : 0
    const s = active.current ? scale : 1
    el.style.transform =
      `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) ` +
      `translate3d(0, 0, ${depth}px) scale3d(${s}, ${s}, 1)`
  }

  const onMouseEnter = (): void => {
    active.current = true
    const el = ref.current
    if (el) el.style.transition = 'transform 90ms linear'
    apply()
  }

  const onMouseMove = (event: React.MouseEvent<HTMLDivElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    target.current = {
      x: (event.clientX - rect.left) / rect.width - 0.5,
      y: (event.clientY - rect.top) / rect.height - 0.5
    }
    if (frameRef.current) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0
      const el = ref.current
      if (el) el.style.transition = 'transform 60ms linear'
      apply()
    })
  }

  const onMouseLeave = (): void => {
    active.current = false
    const el = ref.current
    if (!el) return
    el.style.transition = 'transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1)'
    target.current = { x: 0, y: 0 }
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }
    apply()
  }

  return {
    bind: { ref, onMouseMove, onMouseEnter, onMouseLeave },
    style: {
      transformStyle: 'preserve-3d',
      backfaceVisibility: 'hidden',
      willChange: 'transform'
    }
  }
}
