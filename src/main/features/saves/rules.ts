import { join } from 'node:path'
import os from 'node:os'

/** 存档目录常见命名 */
export const SAVE_DIR_NAMES = [
  'save',
  'saves',
  'savegame',
  'savegames',
  'saved',
  'savedata',
  'save data',
  'save-data',
  'userdata',
  'user data',
  'profile',
  'profiles',
  'storage',
  'slot',
  'slots',
  'cloud',
  'campaign',
  'backup',
  'backups'
]

/** 存档文件常见扩展名 */
export const SAVE_EXT = new Set([
  '.sav',
  '.save',
  '.sav0',
  '.sav1',
  '.sav2',
  '.slot',
  '.ess',
  '.sl2',
  '.dat',
  '.json',
  '.xml',
  '.ini',
  '.cfg',
  '.profile',
  '.bin',
  '.pak',
  '.arc',
  '.gsv'
])

/** 用户目录下一层里明显不是存档的目录，建索引时跳过 */
export const NOISE_DIRS = new Set([
  'microsoft',
  'packages',
  'temp',
  'tmp',
  'crashdumps',
  'd3dscache',
  'nvidia',
  'nvidia corporation',
  'amd',
  'intel',
  'google',
  'mozilla',
  'spotify',
  'discord',
  'slack',
  'teams',
  'zoom',
  'adobe',
  'jetbrains',
  'npm',
  'pnpm',
  'node',
  'python',
  'pip',
  'programs',
  'programdata',
  'windows',
  'system32',
  'steam',
  'steamlibrary',
  'epicgameslauncher',
  'battle.net',
  'origin',
  'ea games',
  'ubisoft',
  'gog.com',
  'gog galaxy',
  'itch',
  'playnite',
  'vnite',
  'skyoo',
  'obs-studio',
  'obs',
  'vortex',
  'mod organ',
  'curseforge',
  'thunderstore',
  'r2modman',
  'cheatengine',
  'reshade',
  'msi',
  'installshield',
  'common files'
])

/** 破解 / 模拟器相关路径模板（{appid} 会被替换） */
export const CRACK_PATH_TEMPLATES = [
  '%APPDATA%/Goldberg SteamEmu Saves/{appid}',
  '%APPDATA%/SmartSteamEmu/{appid}',
  '%APPDATA%/OnlineFix/{appid}',
  '%PROGRAMDATA%/OnlineFix/{appid}',
  '%LOCALAPPDATA%/SmartSteamEmu/{appid}'
]

export interface SaveRoots {
  appData: string
  localAppData: string
  localLow: string
  documents: string
  savedGames: string
  programData: string
}

export function getSaveRoots(): SaveRoots {
  const home = os.homedir()
  return {
    appData: process.env.APPDATA || join(home, 'AppData', 'Roaming'),
    localAppData: process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'),
    // LocalLow 固定是 AppData\LocalLow（不是 Local 的子目录）
    localLow: join(home, 'AppData', 'LocalLow'),
    documents: join(home, 'Documents'),
    savedGames: join(home, 'Saved Games'),
    programData: process.env.PROGRAMDATA || 'C:\\ProgramData'
  }
}

/** 名称归一化：去商标符号 / 标点 / 空格 / 版本号，保留字母数字与中文 */
export function normalizeName(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[\u2122\u00ae\u00a9]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
    .replace(/v?\d+(?:[._]\d+)*/g, '')
}

/** 命中共有的连续片段（用于模糊匹配，避免 "the" 之类误命中） */
export function sharesToken(a: string, b: string, minLen = 5): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length < minLen) return longer.includes(shorter) && shorter.length >= 3
  for (let i = 0; i + minLen <= shorter.length; i++) {
    if (longer.includes(shorter.slice(i, i + minLen))) return true
  }
  return false
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    prev = cur
  }
  return prev[b.length]
}

/**
 * 名称相似度 0~1（用于「名字匹配度优先」的排序）。
 * 依次考虑：完全相同 > 包含关系 > 词元重叠 > 编辑距离。
 */
export function nameSimilarity(rawA: string, rawB: string): number {
  const a = normalizeName(rawA)
  const b = normalizeName(rawB)
  if (!a || !b) return 0
  if (a === b) return 1

  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a

  // 包含关系：长名里含有短名（短名至少 4 个字符，避免 "save" 这类误命中）
  if (shorter.length >= 4 && longer.includes(shorter)) {
    return 0.75 + 0.2 * (shorter.length / longer.length)
  }

  // 词元重叠（按非字母数字切分，驼峰也算）
  const tokenize = (input: string): string[] =>
    input
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(/[^a-zA-Z0-9\u4e00-\u9fa5]+/)
      .map((token) => token.toLowerCase())
      .filter((token) => token.length >= 3)

  const tokensA = tokenize(rawA)
  const tokensB = tokenize(rawB)
  if (tokensA.length && tokensB.length) {
    const hit = tokensA.filter((token) => tokensB.some((other) => other === token)).length
    const overlap = hit / Math.min(tokensA.length, tokensB.length)
    if (overlap > 0) return 0.5 + 0.35 * overlap
  }

  // 编辑距离（对短名更宽容）
  if (longer.length <= 48) {
    const distance = levenshtein(a, b)
    const ratio = 1 - distance / Math.max(a.length, b.length)
    if (ratio >= 0.72) return ratio * 0.9
  }

  return 0
}
