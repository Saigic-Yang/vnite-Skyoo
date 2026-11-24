import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getSaveRoots, normalizeName, NOISE_DIRS } from './rules'

export interface DirEntry {
  path: string
  name: string
  norm: string
  /** 相对根的深度，1 = 根下一层 */
  depth: number
  root: string
}

interface Cache {
  at: number
  dirs: DirEntry[]
}

const TTL = 10 * 60 * 1000
let cache: Cache | null = null

function safeReadDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

function scanRoot(root: string, maxDepth: number, out: DirEntry[], cap = 5000): void {
  let queue: { dir: string; depth: number }[] = [{ dir: root, depth: 0 }]
  let visited = 0

  while (queue.length > 0) {
    const next: { dir: string; depth: number }[] = []
    for (const item of queue) {
      if (visited > cap) return
      const names = safeReadDirs(item.dir)
      for (const name of names) {
        visited++
        const lower = name.toLowerCase()
        if (lower.startsWith('.')) continue
        if (NOISE_DIRS.has(lower)) continue
        // 名称过短或明显是系统缓存目录
        if (/^(cache|caches|logs?|temp|tmp|crashes|crashreports|crashes)$/i.test(lower)) continue

        const full = join(item.dir, name)
        out.push({ path: full, name, norm: normalizeName(name), depth: item.depth + 1, root })
        if (item.depth + 1 < maxDepth) next.push({ dir: full, depth: item.depth + 1 })
      }
    }
    queue = next
  }
}

/** 建立「可能的存档目录」索引（缓存 10 分钟） */
export function getDirIndex(force = false): DirEntry[] {
  const now = Date.now()
  if (!force && cache && now - cache.at < TTL) return cache.dirs

  const roots = getSaveRoots()
  const dirs: DirEntry[] = []

  // Roaming / Local：一层目录名通常就是游戏名或厂商名
  scanRoot(roots.appData, 2, dirs)
  scanRoot(roots.localAppData, 2, dirs)
  // LocalLow 一定是 公司名\产品名 两层
  scanRoot(roots.localLow, 2, dirs)
  // 文档：根一层 + My Games / Saved Games 里再一层
  scanRoot(roots.documents, 1, dirs)
  scanRoot(join(roots.documents, 'My Games'), 2, dirs)
  scanRoot(join(roots.documents, 'Saved Games'), 2, dirs)
  scanRoot(roots.savedGames, 2, dirs)

  // 去重
  const seen = new Set<string>()
  const unique = dirs.filter((dir) => {
    const key = dir.path.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  cache = { at: now, dirs: unique }
  return unique
}

export function clearDirIndexCache(): void {
  cache = null
}

export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
