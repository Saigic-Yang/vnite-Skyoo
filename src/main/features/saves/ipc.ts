import { shell } from 'electron'
import fse from 'fs-extra'
import { join } from 'node:path'
import { GameDBManager } from '~/core/database'
import { ipcManager } from '~/core/ipc'
import { getSaveDataPath } from '~/features/system'
import { detectSaveCandidates, searchSaveByKeyword, searchSaveOnline } from './scanner'

/**
 * 只做「存档路径智能检测 + 打开位置」。
 * 备份 / 还原 / 删除复用上游已有的 game:backup-save / game:restore-save / game:delete-save，
 * 数据存在游戏文档的 save.saveList 里，避免出现两套备份系统。
 */
export function setupSavesIPC(): void {
  ipcManager.handle('saves:detect', async (_, gameId: string, forceReindex?: boolean) => {
    return await detectSaveCandidates(gameId, Boolean(forceReindex))
  })

  // 按关键词在 C 盘用户目录里搜索（优先 Everything CLI）
  ipcManager.handle('saves:search-by-keyword', async (_, gameId: string, keyword: string) => {
    return await searchSaveByKeyword(gameId, keyword)
  })

  // 全网搜索存档路径（PCGamingWiki 兜底）
  ipcManager.handle('saves:search-online', async (_, gameId: string) => {
    return await searchSaveOnline(gameId)
  })

  ipcManager.handle('saves:set-paths', async (_, gameId: string, paths: string[]) => {
    await GameDBManager.setGameLocalValue(
      gameId,
      'path.savePaths',
      paths.map((item) => item.trim()).filter(Boolean)
    )
  })

  // 打开某个备份：直接定位到备份落盘的真实文件。
  // 新备份在 backupGameSave 时已经写入磁盘；老数据没有 filePath 时才从数据库补写一次（稳定目录）。
  ipcManager.handle('saves:show-backup', async (_, gameId: string, saveId: string) => {
    try {
      const saveList = await GameDBManager.getGameValue(gameId, 'save.saveList')
      let file: string | undefined = saveList?.[saveId]?.filePath
      if (!file || !(await fse.pathExists(file))) {
        const buffer = await GameDBManager.getGameSave(gameId, saveId, 'buffer')
        if (!buffer) return
        const gameName = await GameDBManager.getGameValue(gameId, 'metadata.name').catch(() => '')
        const safeName = String(gameName || gameId).replace(/[\\/:*?"<>|]/g, '_').trim()
        const dir = getSaveDataPath(safeName)
        await fse.ensureDir(dir)
        file = join(dir, `${saveId}.zip`)
        await fse.writeFile(file, buffer)
        if (saveList?.[saveId]) {
          saveList[saveId].filePath = file
          await GameDBManager.setGameValue(gameId, 'save.saveList', saveList)
        }
      }
      shell.showItemInFolder(file)
    } catch {
      // 忽略：备份可能已被清理
    }
  })

  // 打开任意文件所在目录并选中它
  ipcManager.handle('system:show-item-in-folder', async (_, filePath: string) => {
    if (!filePath) return
    shell.showItemInFolder(filePath)
  })

  // 用系统浏览器打开外部链接
  ipcManager.handle('system:open-external', async (_, url: string) => {
    if (!url || !/^https?:\/\//i.test(url)) return
    await shell.openExternal(url)
  })
}
