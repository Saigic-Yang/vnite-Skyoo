import type { GameRatings } from '@appTypes/models'
import log from 'electron-log/main'
import { GameDBManager } from '~/core/database'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

/** OpenCritic 需要申请 API Key；未配置时该来源自动跳过 */
const OPENCRITIC_API_KEY = import.meta.env.VITE_OPENCRITIC_API_KEY || ''

const REQUEST_TIMEOUT = 15_000
/** Steam 成人内容页需要一个「已成年」的 cookie 才会返回详情 */
const STEAM_COOKIE = 'birthtime=568022401; mature_content=1; wants_mature_content=1'

/**
 * 带超时与重试的请求：Steam 在短时间内大量请求后会返回连接重置或 5xx，
 * 需要退避重试，否则单次刷新成功率很低。
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  tries = 3
): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < tries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      if (res.status >= 500 && attempt < tries - 1) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (error) {
      lastError = error as Error
      if (attempt === tries - 1) break
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError ?? new Error('request failed')
}

interface SteamAppDetails {
  name?: string
  metacritic?: { score?: number; url?: string }
  recommendations?: { total?: number }
}

/** Steam 官方接口：同时提供 Metacritic 媒体分与评测总数 */
async function fetchSteamAppDetails(steamId: string): Promise<SteamAppDetails | null> {
  try {
    const res = await fetchWithTimeout(
      `https://store.steampowered.com/api/appdetails?appids=${steamId}&l=schinese&cc=cn`
    )
    if (!res.ok) return null
    const json = (await res.json()) as Record<string, { success?: boolean; data?: SteamAppDetails }>
    const entry = json?.[steamId]
    return entry?.success && entry.data ? entry.data : null
  } catch (error) {
    log.warn(`[Ratings] Steam appdetails failed for ${steamId}: ${(error as Error).message}`)
    return null
  }
}

export interface SteamReviewRow {
  summary: string
  percent: number
  total: number
}

export interface SteamReviewSummary {
  /** 所有评测 */
  all?: SteamReviewRow
  /** 最近 30 天 */
  recent?: SteamReviewRow
  /** 简体中文评测 */
  chinese?: SteamReviewRow
}

/**
 * Steam 官方评价接口（appreviews）现在会返回商店页 HTML，只能解析商店页里的
 * 评价区块。区块共 3 行：最近评测 / 简体中文评测 / 所有评测。
 * 注意 Steam 会按访问者的地区给出对应口径的数据，页面里没有任何「全语言」好评率，
 * 因此全语言只用 appdetails.recommendations.total 校正评测总数。
 */
function parseSteamReviewRows(html: string): SteamReviewSummary {
  const parts = html.split('class="user_reviews_summary_row"').slice(1)
  const out: SteamReviewSummary = {}

  for (const raw of parts) {
    const seg = raw.slice(0, 3000)
    const label = (seg.match(/class="subtitle column[^"]*"[^>]*>([^<]+)</)?.[1] || '').trim()
    const summary = (seg.match(/class="game_review_summary[^"]*"[^>]*>([^<]+)</)?.[1] || '').trim()
    if (!summary) continue

    const tooltip = (seg.match(/data-tooltip-html="([^"]*)"/)?.[1] || '').replace(/&lt;[^&]*&gt;/g, ' ')
    const paren = (seg.match(/\(([^)]{0,80})\)/)?.[1] || '').trim()

    const percentMatch = tooltip.match(/(\d{1,3})%/) || paren.match(/(\d{1,3})%/)
    const countMatch = paren.match(/([\d,]{3,})/)
    if (!percentMatch) continue

    const row: SteamReviewRow = {
      summary,
      percent: Number(percentMatch[1]),
      total: countMatch ? Number(countMatch[1].replace(/,/g, '')) : 0
    }

    if (label.includes('最近') || /recent/i.test(label)) {
      out.recent = out.recent || row
    } else if (label.includes('简体中文') || label.includes('您语言的') || /your language/i.test(tooltip)) {
      out.chinese = out.chinese || row
    } else if (label.includes('所有') || /all reviews/i.test(label)) {
      out.all = out.all || row
    }
  }

  // 兜底：若「所有评测」既没匹配到也没匹配到语言行，用第一个有百分比的行
  if (!out.all) {
    const first = out.recent || out.chinese
    if (first) out.all = { ...first }
  }
  return out
}

async function fetchSteamReview(steamId: string): Promise<SteamReviewSummary | null> {
  try {
    const res = await fetchWithTimeout(
      `https://store.steampowered.com/app/${steamId}/?l=schinese&cc=cn`,
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          Cookie: STEAM_COOKIE
        }
      }
    )
    if (!res.ok) return null
    const html = await res.text()
    const rows = parseSteamReviewRows(html)
    return rows.all || rows.chinese || rows.recent ? rows : null
  } catch (error) {
    log.warn(`[Ratings] Steam review parse failed for ${steamId}: ${(error as Error).message}`)
    return null
  }
}

/** Metacritic 前端自带的公开 key（网页本身就在用，非私有凭据） */
const METACRITIC_SEARCH_KEY = '1MOyoQIqgINEb/4M7GXgtw=='

function normalizeForMatch(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[\s:：·・,，.。!！?？'"“”‘’《》<>()（）\-—_]/g, '')
}

/**
 * 解析游戏在 Metacritic 的详情页地址。
 * 先用 Steam 提供的 metacritic.url；没有时用 Metacritic 自己的搜索接口拿 slug。
 */
async function resolveMetacriticUrl(
  gameName: string,
  knownUrl?: string
): Promise<string | null> {
  if (knownUrl) return knownUrl
  if (!gameName) return null
  try {
    const res = await fetchWithTimeout(
      `https://backend.metacritic.com/finder/metacritic/search/${encodeURIComponent(
        gameName
      )}/web?mcoTypeId=13&offset=0&limit=5`,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          'x-api-key': METACRITIC_SEARCH_KEY
        }
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: { items?: { title?: string; slug?: string }[] }
    }
    const items = json?.data?.items || []
    const wanted = normalizeForMatch(gameName)
    const hit =
      items.find((item) => item.slug && normalizeForMatch(item.title || '').includes(wanted)) ||
      items.find((item) => item.slug)
    if (!hit?.slug) return null
    return `https://www.metacritic.com/game/${hit.slug}/`
  } catch (error) {
    log.warn(`[Ratings] Metacritic link resolve failed: ${(error as Error).message}`)
    return null
  }
}

/**
 * OpenCritic 官方 API（需要 Key）。未配置 Key 时直接返回 null，
 * 不会发出请求，也不会在界面上显示该来源。
 */
async function fetchOpenCritic(
  gameName: string
): Promise<{ score: number; percentRecommended?: number; reviewCount?: number; url?: string } | null> {
  if (!OPENCRITIC_API_KEY || !gameName) return null
  try {
    const headers = {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      Authorization: `Bearer ${OPENCRITIC_API_KEY}`
    }

    const searchRes = await fetchWithTimeout(
      `https://api.opencritic.com/api/game/search?criteria=${encodeURIComponent(gameName)}`,
      { headers }
    )
    if (!searchRes.ok) return null
    const search = (await searchRes.json()) as { id?: number }[] | { results?: { id?: number }[] }
    const list = Array.isArray(search) ? search : search?.results || []
    const firstId = list[0]?.id
    if (!firstId) return null

    const detailRes = await fetchWithTimeout(`https://api.opencritic.com/api/game/${firstId}`, {
      headers
    })
    if (!detailRes.ok) return null
    const detail = (await detailRes.json()) as {
      topCriticScore?: number
      percentRecommended?: number
      numReviews?: number
      name?: string
    }

    const score = detail?.topCriticScore ?? null
    if (typeof score !== 'number') return null
    return {
      score,
      percentRecommended: detail.percentRecommended,
      reviewCount: detail.numReviews,
      url: `https://opencritic.com/game/${firstId}`
    }
  } catch (error) {
    log.warn(`[Ratings] OpenCritic failed: ${(error as Error).message}`)
    return null
  }
}

/**
 * 抓取并写入某个游戏的评分数据（Steam 好评率 / Metacritic / OpenCritic）。
 * 任何来源失败都不影响其它来源，也不会影响游戏本身的数据。
 */
export async function refreshGameRatings(gameId: string): Promise<GameRatings | null> {
  const game = await GameDBManager.getExistingGame(gameId)
  if (!game) return null

  const steamId = (game.metadata?.steamId || '').trim()
  const gameName = (game.metadata?.name || '').trim()
  if (!steamId && !gameName) return null

  const updatedAt = new Date().toISOString()
  const ratings: GameRatings = { updatedAt }

  if (steamId) {
    const [details, review] = await Promise.all([
      fetchSteamAppDetails(steamId),
      fetchSteamReview(steamId)
    ])

    if (review?.all) {
      ratings.steam = {
        summary: review.all.summary,
        percent: review.all.percent,
        // 全语言评测总数以官方接口为准（商店页只给地区口径）
        total: details?.recommendations?.total ?? review.all.total,
        url: `https://store.steampowered.com/app/${steamId}/`,
        recent: review.recent,
        chinese: review.chinese
      }
    }

    if (typeof details?.metacritic?.score === 'number') {
      ratings.metacritic = {
        score: details.metacritic.score,
        url: details.metacritic.url,
        updatedAt
      }
    }
  }

  // 解析「本作详情页」直链：Metacritic 用搜索接口兜底，OpenCritic 有 Key 时才有 id
  const links: GameRatings['links'] = {}
  const metacriticUrl = await resolveMetacriticUrl(gameName, ratings.metacritic?.url)
  if (metacriticUrl) links.metacritic = metacriticUrl

  const opencritic = await fetchOpenCritic(gameName)
  if (opencritic) {
    ratings.opencritic = { ...opencritic, updatedAt }
    if (opencritic.url) links.opencritic = opencritic.url
  }
  if (Object.keys(links).length > 0) ratings.links = links

  // 一个来源都没抓到：不写库、直接报错，让界面提示原因（而不是静默"没反应"）
  if (!ratings.steam && !ratings.metacritic && !ratings.opencritic) {
    throw new Error(
      '未能获取到评分数据：Steam 可能限流或当前网络不可达，请稍后重试'
    )
  }

  await GameDBManager.setGameValue(gameId, 'ratings', ratings)
  log.info(
    `[Ratings] Updated ${gameId} (steam=${ratings.steam ? ratings.steam.percent + '%' : '-'}, metacritic=${
      ratings.metacritic?.score ?? '-'
    }, opencritic=${ratings.opencritic?.score ?? '-'})`
  )
  return ratings
}
