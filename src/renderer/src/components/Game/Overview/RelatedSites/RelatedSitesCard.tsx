import { SeparatorDashed } from '@ui/separator-dashed'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '~/components/ui/link'
import { useGameState } from '~/hooks'
import { cn, copyWithToast } from '~/utils'
import { RelatedSitesDialog } from './RelatedSitesDialog'
import { SearchRelatedSitesDialog } from './SearchRelatedSitesDialog'

export function RelatedSitesCard({
  gameId,
  className = ''
}: {
  gameId: string
  className?: string
}): React.JSX.Element {
  const { t } = useTranslation('game')
  const [relatedSites, setRelatedSites] = useGameState(gameId, 'metadata.relatedSites')
  const [originalName] = useGameState(gameId, 'metadata.originalName')
  const [name] = useGameState(gameId, 'metadata.name')
  const [steamId] = useGameState(gameId, 'metadata.steamId')
  const [ratings] = useGameState(gameId, 'ratings')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false)

  const handleSelectRelatedSites = (newRelatedSites: { label: string; url: string }[]): void => {
    setRelatedSites(newRelatedSites)
  }

  /**
   * Skyoo：在原有「相关网站」基础上补齐以下链接，顺序为
   * 官方网站 → Steam 商店 → SteamDB → OpenCritic → Metacritic → HowLongToBeat → 其余
   */
  const mergedSites = useMemo(() => {
    const raw = (relatedSites || []).filter((site) => site && site.url)
    const isSteamStore = (url: string): boolean => /store\.steampowered\.com/i.test(url)
    const isSteamDb = (url: string): boolean => /steamdb\.info/i.test(url)
    const isMetacritic = (url: string): boolean => /metacritic\.com/i.test(url)
    const isOpenCritic = (url: string): boolean => /opencritic\.com/i.test(url)
    const isHltb = (url: string): boolean => /howlongtobeat\.com/i.test(url)

    const others = raw.filter(
      (site) =>
        !(
          isSteamStore(site.url) ||
          isSteamDb(site.url) ||
          isMetacritic(site.url) ||
          isOpenCritic(site.url) ||
          isHltb(site.url)
        )
    )

    const merged: { label: string; url: string }[] = [...others]

    if (steamId) {
      merged.push({
        label: t('detail.overview.relatedSites.steamStore'),
        url: `https://store.steampowered.com/app/${steamId}/`
      })
      merged.push({
        label: t('detail.overview.relatedSites.steamdb'),
        url: `https://steamdb.info/app/${steamId}/`
      })
    }

    const query = encodeURIComponent(originalName || name || '')
    // 优先用抓取时解析到的「本作详情页」，否则退回站内搜索
    const openCriticUrl =
      ratings?.links?.opencritic ||
      ratings?.opencritic?.url ||
      (query ? `https://opencritic.com/search?criteria=${query}` : '')
    if (openCriticUrl) {
      merged.push({ label: t('detail.overview.relatedSites.opencritic'), url: openCriticUrl })
    }

    const metacriticUrl =
      ratings?.links?.metacritic ||
      ratings?.metacritic?.url ||
      (query ? `https://www.metacritic.com/search/${query}/` : '')
    if (metacriticUrl) {
      merged.push({ label: t('detail.overview.relatedSites.metacritic'), url: metacriticUrl })
    }

    if (query) {
      merged.push({
        label: t('detail.overview.relatedSites.howlongtobeat'),
        url: `https://howlongtobeat.com/?q=${query}`
      })
    }

    // 小黑盒：有解析到的 id 直达详情页，否则退回站内搜索
    const xiaoheiheId = (ratings?.links as Record<string, string> | undefined)?.xiaoheihe
    // 注意：必须用 /app/search（旧的 /search 返回 404，所有游戏都会跳到同一个空页）
    const xiaoheiheUrl =
      xiaoheiheId || (query ? `https://www.xiaoheihe.cn/app/search?q=${query}` : '')
    if (xiaoheiheUrl) {
      merged.push({ label: '小黑盒', url: xiaoheiheUrl })
    }

    return merged
  }, [relatedSites, steamId, ratings, name, originalName, t])

  return (
    <div className={cn(className, 'group')}>
      <div className={cn('flex flex-row justify-between items-center')}>
        <div
          className={cn('font-bold select-none cursor-pointer')}
          onClick={() =>
            copyWithToast(mergedSites.map((item) => `${item.label}: ${item.url}`).join('\n'))
          }
        >
          {t('detail.overview.sections.relatedSites')}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'invisible group-hover:visible hover:text-primary cursor-pointer icon-[mdi--magnify] w-5 h-5'
            )}
            onClick={() => setIsSearchDialogOpen(true)}
          ></span>
          <span
            className={cn(
              'invisible group-hover:visible hover:text-primary cursor-pointer icon-[mdi--square-edit-outline] w-5 h-5'
            )}
            onClick={() => setIsEditDialogOpen(true)}
          ></span>
        </div>
      </div>
      <SeparatorDashed />
      <div className={cn('flex flex-col text-sm justify-start gap-[6px] items-start')}>
        {mergedSites.length === 0
          ? t('detail.overview.relatedSites.empty')
          : mergedSites.map((site, index) => (
              <Link
                key={`${gameId}-${site.label}-${site.url}-${index}`}
                name={site.label}
                url={site.url}
                tooltipSide="left"
              />
            ))}
      </div>
      <RelatedSitesDialog
        gameId={gameId}
        isOpen={isEditDialogOpen}
        setIsOpen={setIsEditDialogOpen}
      />

      <SearchRelatedSitesDialog
        isOpen={isSearchDialogOpen}
        onClose={() => setIsSearchDialogOpen(false)}
        gameTitle={originalName || name}
        onSelect={handleSelectRelatedSites}
        initialRelatedSites={relatedSites}
      />
    </div>
  )
}
