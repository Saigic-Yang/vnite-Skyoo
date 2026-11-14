import { ScrollArea } from '@ui/scroll-area'
import { useRef } from 'react'
import { cn } from '~/utils'
import { AllGames } from './AllGames'
import { ScrollToTopButton } from './ScrollToTopButton'

/** 「所有游戏」独立页（对应顶栏的第三个 tab） */
export function AllGamesPage(): React.JSX.Element {
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  return (
    <div className={cn('flex flex-col gap-3 h-full w-full bg-transparent')}>
      <ScrollArea ref={scrollAreaRef} className={cn('w-full h-full')}>
        <div className={cn('pt-[18px] flex flex-col gap-3')}>
          <AllGames />
        </div>
      </ScrollArea>
      <ScrollToTopButton scrollAreaRef={scrollAreaRef} />
    </div>
  )
}
