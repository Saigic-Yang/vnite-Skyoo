import { useEffect, useRef, type RefObject } from 'react'

type Axis = 'x' | 'y'

function isScrollable(el: HTMLElement, axis: Axis): boolean {
  const style = getComputedStyle(el)
  const prop = axis === 'x' ? 'overflowX' : 'overflowY'
  if (!/auto|scroll/.test(style[prop])) return false
  return axis === 'x'
    ? el.scrollWidth > el.clientWidth + 10
    : el.scrollHeight > el.clientHeight + 10
}

/** 找到容器里（或其祖先里）真正可滚动的元素 */
function findScrollElement(root: HTMLElement, axis: Axis): HTMLElement {
  // 1) 容器内部：Radix ScrollArea 的 viewport
  const viewport =
    (root.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null) ??
    (root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null)
  if (viewport && isScrollable(viewport, axis)) return viewport

  // 2) 容器内部其它可滚动元素
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    if (isScrollable(el, axis)) return el
  }

  // 3) 祖先链：整页 ScrollArea 包着网格时（所有游戏页）走这里
  let node: HTMLElement | null = root.parentElement
  while (node) {
    if (isScrollable(node, axis)) return node
    const inner =
      (node.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null) ??
      (node.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null)
    if (inner && isScrollable(inner, axis)) return inner
    node = node.parentElement
  }

  return root
}

/**
 * 按住左键拖动滚动（window 捕获阶段，绕开 dnd-kit / 卡片自身对事件的拦截）。
 * 位移超过 5px 才滚动，因此单击仍然正常。
 */
export function useWindowDragScroll(
  containerRef: RefObject<HTMLElement | null>,
  axis: Axis = 'y'
): void {
  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    let active = false
    let moved = false
    let start = 0
    let getScrollEl: () => HTMLElement = () => root

    const onDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      if (!root.contains(event.target as Node)) return
      const el = findScrollElement(root, axis)
      getScrollEl = () => el
      active = true
      moved = false
      start = axis === 'x' ? event.clientX : event.clientY
    }

    const onMove = (event: PointerEvent): void => {
      if (!active) return
      const distance = (axis === 'x' ? event.clientX : event.clientY) - start
      if (!moved) {
        if (Math.abs(distance) < 5) return
        moved = true
      }
      const el = getScrollEl()
      const value = (axis === 'x' ? el.scrollLeft : el.scrollTop) - distance
      if (axis === 'x') el.scrollLeft = value
      else el.scrollTop = value
      start = axis === 'x' ? event.clientX : event.clientY
    }

    const onUp = (): void => {
      active = false
      moved = false
    }

    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onUp, true)
    }
  }, [containerRef, axis])
}

/** 旧版 React 事件版本（横向条带等简单场景继续使用） */
export function resolveScrollElement(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null
  return (root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement) ?? root
}

export function useDragScroll(
  getElement: () => HTMLElement | null,
  axis: Axis = 'x'
): {
  onPointerDown: (event: React.PointerEvent) => void
  onPointerMove: (event: React.PointerEvent) => void
  onPointerUp: (event: React.PointerEvent) => void
  onPointerCancel: (event: React.PointerEvent) => void
} {
  const drag = useRef({ active: false, moved: false, start: 0, startScroll: 0 })

  const onPointerDown = (event: React.PointerEvent): void => {
    if (event.button !== 0) return
    const el = getElement()
    if (!el) return
    drag.current = {
      active: true,
      moved: false,
      start: axis === 'x' ? event.clientX : event.clientY,
      startScroll: axis === 'x' ? el.scrollLeft : el.scrollTop
    }
  }

  const onPointerMove = (event: React.PointerEvent): void => {
    if (!drag.current.active) return
    const distance = (axis === 'x' ? event.clientX : event.clientY) - drag.current.start
    if (!drag.current.moved) {
      if (Math.abs(distance) < 5) return
      drag.current.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    const el = getElement()
    if (!el) return
    if (axis === 'x') el.scrollLeft = drag.current.startScroll - distance
    else el.scrollTop = drag.current.startScroll - distance
  }

  const end = (event: React.PointerEvent): void => {
    drag.current.active = false
    if (drag.current.moved && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    drag.current.moved = false
  }

  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end }
}
