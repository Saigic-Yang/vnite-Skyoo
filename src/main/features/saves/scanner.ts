import { execFile } from 'node:child_process'
import { net } from 'electron'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { GameDBManager } from '~/core/database'
import { getDirIndex, isDirectory } from './indexer'
import {
  CRACK_PATH_TEMPLATES,
  getSaveRoots,
  nameSimilarity,
  SAVE_DIR_NAMES,
  SAVE_EXT
} from './rules'

const execFileAsync = promisify(execFile)

export interface SaveCandidate {
  path: string
  score: number
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  fileCount: number
  saveFileCount: number
  sizeMB: number
  updatedAt: string
  exists: boolean
  /** 是否用户手动指定 */
  manual?: boolean
}

const RECENT_WINDOW = 1000 * 60 * 60 * 24 * 90

function expandTemplate(template: string, appid: string): string {
  const roots = getSaveRoots()
  return template
    .replace('%APPDATA%', roots.appData)
    .replace('%LOCALAPPDATA%', roots.localAppData)
    .replace('%PROGRAMDATA%', roots.programData)
    .replace('{appid}', appid)
}

function inspectDir(dir: string): {
  fileCount: number
  saveFileCount: number
  sizeMB: number
  updatedAt: string
} {
  let fileCount = 0
  let saveFileCount = 0
  let size = 0
  let latest = 0

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries.slice(0, 400)) {
      if (!entry.isFile()) continue
      const full = join(dir, entry.name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      fileCount++
      size += st.size
      const dot = entry.name.lastIndexOf('.')
      if (dot >= 0 && SAVE_EXT.has(entry.name.slice(dot).toLowerCase())) saveFileCount++
      if (st.mtimeMs > latest) latest = st.mtimeMs
    }
  } catch {
    return { fileCount: 0, saveFileCount: 0, sizeMB: 0, updatedAt: '' }
  }

  return {
    fileCount,
    saveFileCount,
    sizeMB: +(size / 1048576).toFixed(2),
    updatedAt: latest ? new Date(latest).toISOString() : ''
  }
}

/**
 * 给一个目录打分。
 * 设计原则：**名字匹配度是第一要素**（占 0~70 分），文件特征只做辅助与门槛。
 */
function scoreDir(
  dir: string,
  gameName: string,
  options: {
    /** 手动指定：无条件保留 */
    manual?: boolean
    /** 破解模板命中：appid 精确，名字可以放宽 */
    trusted?: boolean
    /** 用户关键词搜索命中：放宽名字限制 */
    keywordHit?: boolean
    extraReasons?: string[]
  } = {}
): SaveCandidate | null {
  if (!dir || !isDirectory(dir)) return null

  const reasons = [...(options.extraReasons ?? [])]
  const info = inspectDir(dir)

  // 名字匹配：同时看自身与上一级（存档项目录常是「游戏名/save」）
  const selfSim = gameName ? nameSimilarity(basename(dir), gameName) : 0
  const parentSim = gameName ? nameSimilarity(basename(dirname(dir)), gameName) : 0
  const similarity = Math.max(selfSim, parentSim)

  if (options.manual) {
    return {
      path: dir,
      score: 999,
      confidence: 'high',
      reasons: [...reasons, '手动指定'],
      fileCount: info.fileCount,
      saveFileCount: info.saveFileCount,
      sizeMB: info.sizeMB,
      updatedAt: info.updatedAt,
      exists: true,
      manual: true
    }
  }

  // 空目录直接丢弃（截图里那些 0 文件 0 MB 的噪声就是这么来的）
  if (info.fileCount === 0 && !options.trusted && !options.keywordHit) return null

  let score = similarity * 70
  if (similarity >= 0.9) reasons.push('目录名与游戏名几乎一致')
  else if (similarity >= 0.6) reasons.push('目录名与游戏名高度相符')
  else if (similarity >= 0.35) reasons.push('目录名与游戏名部分相符')

  const dirName = basename(dir).toLowerCase()
  const fileSaveNamed = SAVE_DIR_NAMES.includes(dirName)
  const parentSaveNamed = SAVE_DIR_NAMES.includes(basename(dirname(dir)).toLowerCase())
  if (fileSaveNamed || parentSaveNamed) {
    score += 8
    reasons.push('目录名是常见存档目录')
  }

  if (info.saveFileCount > 0) {
    score += Math.min(info.saveFileCount, 20) * 1.5
    reasons.push(`含 ${info.saveFileCount} 个存档类文件`)
  }

  if (info.updatedAt) {
    const age = Date.now() - new Date(info.updatedAt).getTime()
    if (age < RECENT_WINDOW) {
      score += 8
      reasons.push('近期有写入')
    }
  }

  if (info.sizeMB > 0.01) score += 2

  // 大量文件但名字完全无关：更像安装目录 / 缓存
  if (info.fileCount > 300 && similarity < 0.5) score -= 40
  // 完全没有名字依据、也没有存档文件：不可信（关键词搜索除外）
  if (similarity < 0.3 && info.saveFileCount === 0 && !options.keywordHit) return null
  if (options.trusted) score += 25
  if (options.keywordHit) {
    score += 15
    reasons.push('命中搜索关键词')
  }

  if (score < 20) return null

  return {
    path: dir,
    score: Math.round(score),
    confidence: score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low',
    reasons,
    fileCount: info.fileCount,
    saveFileCount: info.saveFileCount,
    sizeMB: info.sizeMB,
    updatedAt: info.updatedAt,
    exists: true
  }
}

export interface DetectResult {
  candidates: SaveCandidate[]
  chosen: string[]
  manual: string[]
}

/** 检测某游戏的存档目录候选 */
export async function detectSaveCandidates(
  gameId: string,
  forceReindex = false
): Promise<DetectResult> {
  const [name, originalName, steamId, rootPath, manualPaths] = await Promise.all([
    GameDBManager.getGameValue(gameId, 'metadata.name').catch(() => ''),
    GameDBManager.getGameValue(gameId, 'metadata.originalName').catch(() => ''),
    GameDBManager.getGameValue(gameId, 'metadata.steamId').catch(() => ''),
    GameDBManager.getGameLocalValue(gameId, 'utils.rootPath').catch(() => ''),
    GameDBManager.getGameLocalValue(gameId, 'path.savePaths').catch(() => [] as string[])
  ])

  const manual = (manualPaths || []).filter(Boolean)
  const gameName = String(originalName || name || '')
  const candidates: SaveCandidate[] = []
  const seen = new Set<string>()

  const push = (candidate: SaveCandidate | null): void => {
    if (!candidate) return
    const key = candidate.path.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    candidates.push(candidate)
  }

  // 1) 手动指定
  for (const path of manual) {
    push(scoreDir(path, gameName, { manual: true, extraReasons: [] }))
  }

  // 2) 破解 / 模拟器（appid 精确，可信）
  const appid = String(steamId || '').trim()
  if (appid) {
    for (const template of CRACK_PATH_TEMPLATES) {
      const dir = expandTemplate(template, appid)
      push(scoreDir(dir, gameName, { trusted: true, extraReasons: ['破解模拟器存档目录'] }))
    }
  }

  // 3) 游戏安装目录内的常见存档子目录（要求名字或存档文件支持）
  if (rootPath && isDirectory(rootPath)) {
    for (const sub of SAVE_DIR_NAMES) {
      push(scoreDir(join(rootPath, sub), gameName, { extraReasons: ['游戏安装目录内'] }))
    }
    // 安装目录本身也可能是存档所在（如 ...\影之刃零\Saved）
    for (const sub of ['Saved', 'Saved\\SaveGames', 'userdata', 'profile']) {
      push(scoreDir(join(rootPath, sub), gameName, { extraReasons: ['游戏安装目录内'] }))
    }
  }

  // 4) 名称匹配的目录索引：按相似度优先，只取真正像的
  const index = getDirIndex(forceReindex)
  const scored = index
    .map((entry) => ({ entry, sim: nameSimilarity(entry.name, gameName) }))
    .filter((item) => item.sim >= 0.4)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 40)

  for (const { entry } of scored) {
    const dirName = entry.name.toLowerCase()
    const saveNamed = SAVE_DIR_NAMES.includes(dirName)
    push(
      scoreDir(entry.path, gameName, {
        extraReasons: ['名称匹配的目录'],
        trusted: saveNamed
      })
    )
  }

  candidates.sort((a, b) => b.score - a.score)
  const top = candidates.slice(0, 8)
  const chosen = manual.length > 0 ? manual : top.length > 0 ? [top[0].path] : []

  return { candidates: top, chosen, manual }
}

/* ------------------------------------------------------------------ */
/* 关键词搜索（C 盘）：优先 Everything CLI，不可用时用受限递归扫描      */
/* ------------------------------------------------------------------ */

const EVERYTHING_CLI_PATHS = [
  'C:\\Program Files\\Everything\\es.exe',
  'C:\\Program Files (x86)\\Everything\\es.exe',
  'C:\\Everything\\es.exe'
]

function findEverythingCli(): string | null {
  for (const candidate of EVERYTHING_CLI_PATHS) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

async function searchWithEverything(terms: string[], limit: number): Promise<string[]> {
  const cli = findEverythingCli()
  if (!cli) return []
  const found = new Set<string>()

  // 宽松匹配：对每个词分别查一次，任意一个命中即可
  for (const term of terms.slice(0, 4)) {
    try {
      const { stdout } = await execFileAsync(cli, ['-p', '-n', String(limit), term], {
        timeout: 6000,
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024
      })
      stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((path) => found.add(path))
    } catch {
      // 单个词失败不影响其它词
    }
  }

  return [...found]
}

/** 受限递归扫描（只在用户目录里找，深度 4，最多 2.5 秒 / 2 万项） */
function searchWithWalk(terms: string[], limit: number): string[] {
  const roots = getSaveRoots()
  const bases = [
    roots.appData,
    roots.localAppData,
    roots.localLow,
    roots.documents,
    roots.savedGames
  ]

  const results: string[] = []
  const started = Date.now()
  let visited = 0
  let queue: { dir: string; depth: number }[] = bases
    .filter((base) => existsSync(base))
    .map((base) => ({ dir: base, depth: 0 }))

  while (queue.length > 0 && results.length < limit) {
    if (Date.now() - started > 2500 || visited > 20000) break
    const next: { dir: string; depth: number }[] = []

    for (const item of queue) {
      if (results.length >= limit) break
      let names: string[] = []
      try {
        names = readdirSync(item.dir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
      } catch {
        continue
      }

      for (const name of names) {
        visited++
        const lower = name.toLowerCase()
        if (lower.startsWith('.')) continue
        const full = join(item.dir, name)
        // 宽泛匹配：命中任意一个词即可
        if (terms.some((term) => lower.includes(term))) results.push(full)
        if (item.depth + 1 < 4) next.push({ dir: full, depth: item.depth + 1 })
      }
    }
    queue = next
  }

  return results
}

export interface KeywordSearchResult {
  candidates: SaveCandidate[]
  /** 本次使用的搜索引擎 */
  engine: 'everything' | 'walk'
  /** Everything 是否可用 */
  hasEverything: boolean
  /** 扫描耗时（毫秒） */
  elapsedMs: number
}

/** 按关键词在 C 盘用户目录里搜索可能的存档目录 */
export async function searchSaveByKeyword(
  gameId: string,
  keyword: string
): Promise<KeywordSearchResult> {
  const started = Date.now()
  const trimmed = String(keyword || '').trim()
  const hasEverything = Boolean(findEverythingCli())
  if (!trimmed) {
    return { candidates: [], engine: hasEverything ? 'everything' : 'walk', hasEverything, elapsedMs: 0 }
  }

  const [name, originalName] = await Promise.all([
    GameDBManager.getGameValue(gameId, 'metadata.name').catch(() => ''),
    GameDBManager.getGameValue(gameId, 'metadata.originalName').catch(() => '')
  ])
  const gameName = String(originalName || name || trimmed)

  // 宽松匹配：按空格拆词，命中任意一个词就算
  const terms = trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  let paths = await searchWithEverything(terms, 300)
  const engine: 'everything' | 'walk' = paths.length > 0 ? 'everything' : 'walk'
  if (paths.length === 0) paths = searchWithWalk(terms, 200)

  const candidates: SaveCandidate[] = []
  const seen = new Set<string>()
  for (const path of paths) {
    if (!isDirectory(path)) continue
    const key = path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const candidate = scoreDir(path, gameName, {
      keywordHit: true,
      extraReasons: ['关键词搜索命中']
    })
    if (candidate) candidates.push(candidate)
  }

  candidates.sort((a, b) => b.score - a.score)
  return {
    candidates: candidates.slice(0, 20),
    engine,
    hasEverything,
    elapsedMs: Date.now() - started
  }
}

/* ------------------------------------------------------------------ */
/* 网络搜索：从 PCGamingWiki 抓取该游戏的存档路径（兜底方案）           */
/* ------------------------------------------------------------------ */

export interface OnlineSavePathResult {
  source: string
  title: string
  url: string
  paths: string[]
}

export interface OnlineSearchOutcome {
  /** ok = 找到路径；not-found = 网站没收录；network = 网络问题；no-query = 没有游戏名 */
  status: 'ok' | 'not-found' | 'network' | 'no-query'
  /** 给用户看的明确说明（区分「没收录」和「网络不通」） */
  message: string
  results: OnlineSavePathResult[]
  /** 其它参考链接（Bing 等） */
  links: { source: string; title: string; url: string }[]
}

const PCGW_API = 'https://www.pcgamingwiki.com/w/api.php'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  Referer: 'https://www.pcgamingwiki.com/'
}

/**
 * 用 Chromium 网络栈（net.fetch）发请求，并伪装成浏览器。
 * 直接用 Node 的 fetch 会被 Cloudflare 判为爬虫而返回 403。
 */
async function browserFetch(url: string): Promise<Response> {
  const options = { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) }
  try {
    return await net.fetch(url, options)
  } catch {
    return await fetch(url, options)
  }
}

function decodePcgwPath(raw: string): string {
  return raw
    .replace(/\{\{p\|userprofile\}\}/gi, '%USERPROFILE%')
    .replace(/\{\{p\|appdata\}\}/gi, '%APPDATA%')
    .replace(/\{\{p\|localappdata\}\}/gi, '%LOCALAPPDATA%')
    .replace(/\{\{p\|programdata\}\}/gi, '%PROGRAMDATA%')
    .replace(/\{\{p\|savedgames\}\}/gi, '%USERPROFILE%\\Saved Games')
    .replace(/\{\{p\|gamepagetitle\}\}/gi, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[([^|\]]*\|)?([^\]]*)\]\]/g, '$2')
    .replace(/<[^>]+>/g, '')
    .trim()
}

/** 额外来源：Bing 搜索参考链接（供用户自行核对） */
async function searchBingLinks(
  query: string
): Promise<{ source: string; title: string; url: string }[]> {
  try {
    const res = await browserFetch(
      `https://www.bing.com/search?q=${encodeURIComponent(`${query} 存档位置 save game location`)}`
    )
    if (!res.ok) return []
    const html = await res.text()
    const out: { source: string; title: string; url: string }[] = []
    const regex = /<h2[^>]*>\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    let match: RegExpExecArray | null
    while ((match = regex.exec(html)) !== null && out.length < 5) {
      const url = match[1]
      const title = match[2].replace(/<[^>]+>/g, '').trim()
      if (!title || !url) continue
      out.push({ source: 'Bing', title, url })
    }
    return out
  } catch {
    return []
  }
}

/** 全网搜索存档路径：PCGamingWiki（解析路径）+ Bing（参考链接） */
export async function searchSaveOnline(gameId: string): Promise<OnlineSearchOutcome> {
  const [name, originalName] = await Promise.all([
    GameDBManager.getGameValue(gameId, 'metadata.name').catch(() => ''),
    GameDBManager.getGameValue(gameId, 'metadata.originalName').catch(() => '')
  ])
  const query = String(originalName || name || '').trim()
  if (!query) {
    return {
      status: 'no-query',
      message: '该游戏没有可用的名称，无法进行网络搜索',
      results: [],
      links: []
    }
  }

  const results: OnlineSavePathResult[] = []
  const links: { source: string; title: string; url: string }[] = []
  let titles: string[] = []

  try {
    const searchUrl = `${PCGW_API}?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&srlimit=3`
    const searchRes = await browserFetch(searchUrl)
    if (!searchRes.ok) {
      return {
        status: 'network',
        message: `PCGamingWiki 返回 HTTP ${searchRes.status}（被 Cloudflare 拦截），已提供可点击的搜索页链接`,
        results: [],
        links: [
          {
            source: 'PCGamingWiki',
            title: `在浏览器中搜索「${query}」`,
            url: `https://www.pcgamingwiki.com/w/index.php?search=${encodeURIComponent(query)}`
          },
          {
            source: 'Bing',
            title: `搜索「${query} 存档位置」`,
            url: `https://www.bing.com/search?q=${encodeURIComponent(
              `${query} 存档位置 save game location`
            )}`
          }
        ]
      }
    }
    const searchJson = (await searchRes.json()) as {
      query?: { search?: { title: string }[] }
    }
    titles = (searchJson.query?.search ?? []).map((item) => item.title).slice(0, 3)

    for (const title of titles) {
      const parseUrl = `${PCGW_API}?action=parse&page=${encodeURIComponent(
        title
      )}&prop=wikitext&format=json`
      const parseRes = await browserFetch(parseUrl)
      if (!parseRes.ok) continue
      const parseJson = (await parseRes.json()) as {
        parse?: { wikitext?: { '*': string } }
      }
      const wikitext = parseJson.parse?.wikitext?.['*'] ?? ''
      if (!wikitext) continue

      const paths = new Set<string>()
      const regex = /\{\{\s*Game data\/saves\s*\|\s*Windows\s*\|([^}]+)\}\}/gi
      let match: RegExpExecArray | null
      while ((match = regex.exec(wikitext)) !== null) {
        const decoded = decodePcgwPath(match[1])
        if (decoded && decoded.length > 2) paths.add(decoded)
      }

      if (paths.size > 0) {
        results.push({
          source: 'PCGamingWiki',
          title,
          url: `https://www.pcgamingwiki.com/wiki/${encodeURIComponent(title)}`,
          paths: [...paths]
        })
      }
    }
  } catch (error) {
    const message = (error as Error).message || String(error)
    const isTimeout = message.includes('timeout') || message.includes('aborted')
    return {
      status: 'network',
      message: isTimeout
        ? '连接 PCGamingWiki 超时（8 秒无响应），请检查网络或代理设置'
        : `无法连接 PCGamingWiki：${message}`,
      results: [],
      links: []
    }
  }

  links.push(...(await searchBingLinks(query)))

  if (results.length > 0) {
    return {
      status: 'ok',
      message: `PCGamingWiki 命中 ${results.length} 个页面`,
      results,
      links
    }
  }

  if (titles.length === 0) {
    return {
      status: 'network',
      message: 'PCGamingWiki 搜索接口返回空结果（可能被网络中间层拦截），请检查网络/代理',
      results: [],
      links
    }
  }

  return {
    status: 'not-found',
    message: `PCGamingWiki 有「${titles[0]}」页面，但页面未提供 Windows 存档路径`,
    results: [],
    links
  }
}
