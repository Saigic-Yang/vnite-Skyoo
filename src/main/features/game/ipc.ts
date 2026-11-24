import type { GameMediaType } from '@appTypes/models'
import { shell } from 'electron'
import fse from 'fs-extra'
import { join } from 'node:path'
import sharp from 'sharp'
import { GameDBManager } from '~/core/database'
import { ipcManager } from '~/core/ipc'
import { getAppExportPath } from '~/features/system'
import {
  addGameMemory,
  addGameMemoryInlineImage,
  backupGameSave,
  batchCalculateStorageSize,
  calculateStorageSize,
  cancelBatchStorageSizeCalculation,
  deleteGameMemory,
  deleteGameSave,
  exportAllGameMemories,
  hideGameFromRecentGames,
  isBatchStorageSizeCalculationRunning,
  recalculateLastRunDate,
  restoreGameSave,
  saveGameIconByFile,
  searchGameSavePaths,
  updateGameMemoryCover,
  upscaleGameBackground
} from './services'

export function setupGameIPC(): void {
  ipcManager.handle(
    'game:set-image',
    async (_, gameId: string, type: GameMediaType, image: string) => {
      return await GameDBManager.setGameImage(gameId, type, image)
    }
  )

  ipcManager.handle('game:save-icon-by-file', async (_, gameId: string, filePath: string) => {
    await saveGameIconByFile(gameId, filePath)
  })

  ipcManager.handle('game:search-save-paths', async (_, gameId: string) => {
    return await searchGameSavePaths(gameId)
  })

  ipcManager.handle('game:backup-save', async (_, gameId: string) => {
    return await backupGameSave(gameId)
  })

  // 重新计算所有历史备份的大小（老数据没有 sizeMB 时自动补上）
  ipcManager.handle('game:refresh-save-sizes', async (_, gameId: string) => {
    const saveList = await GameDBManager.getGameValue(gameId, 'save.saveList')
    const sizes: Record<string, number> = {}

    for (const saveId of Object.keys(saveList ?? {})) {
      const entry = saveList[saveId]
      if (!entry) continue
      let bytes = 0
      try {
        if (entry.filePath && (await fse.pathExists(entry.filePath))) {
          bytes = (await fse.stat(entry.filePath)).size
        } else {
          // 回退：从数据库附件取（老数据）
          const buffer = await GameDBManager.getGameSave(gameId, saveId, 'buffer')
          bytes = buffer ? buffer.length : 0
        }
      } catch {
        bytes = 0
      }
      if (bytes > 0) {
        const sizeMB = +(bytes / 1048576).toFixed(2)
        entry.sizeMB = sizeMB
        sizes[saveId] = sizeMB
      }
    }

    await GameDBManager.setGameValue(gameId, 'save.saveList', saveList)
    return sizes
  })

  ipcManager.handle('game:delete-save', async (_, gameId: string, saveId: string) => {
    await deleteGameSave(gameId, saveId)
  })

  ipcManager.handle(
    'game:restore-save',
    async (_, gameId: string, saveId: string, skipIfTargetNewer?: boolean) => {
      await restoreGameSave(gameId, saveId, skipIfTargetNewer)
    }
  )

  ipcManager.handle('game:delete', async (_, gameId: string) => {
    await GameDBManager.removeGame(gameId)
  })

  ipcManager.handle('game:add-memory', async (_, gameId: string) => {
    return await addGameMemory(gameId)
  })

  ipcManager.handle('game:delete-memory', async (_, gameId: string, memoryId: string) => {
    await deleteGameMemory(gameId, memoryId)
  })

  ipcManager.handle(
    'game:update-memory-cover',
    async (
      _,
      gameId: string,
      memoryId: string,
      imgPath: string,
      options?: { originalImagePath?: string }
    ) => {
      await updateGameMemoryCover(gameId, memoryId, imgPath, options)
    }
  )

  ipcManager.handle('game:get-memory-cover-path', async (_, gameId: string, memoryId: string) => {
    return await GameDBManager.getGameMemoryImage(gameId, memoryId, 'file')
  })

  // 打开回忆图片的「本地文件」：图片存在数据库附件里，
  // 这里导出到持久目录（userData/exports/memories）后再定位，而不是用临时目录
  ipcManager.handle('game:show-memory-in-folder', async (_, gameId: string, memoryId: string) => {
    try {
      const buffer = await GameDBManager.getGameMemoryImage(gameId, memoryId, 'buffer')
      if (!buffer) return
      const dir = getAppExportPath(join('memories', gameId))
      await fse.ensureDir(dir)
      const file = join(dir, `${memoryId}.webp`)
      await fse.writeFile(file, buffer)
      shell.showItemInFolder(file)
    } catch {
      // 忽略：图片可能已被删除
    }
  })

  ipcManager.handle('game:add-memory-inline-image', async (_, gameId: string, imgPath: string) => {
    return await addGameMemoryInlineImage(gameId, imgPath)
  })

  ipcManager.handle('game:export-all-memories', async (_, gameId: string) => {
    return await exportAllGameMemories(gameId)
  })

  ipcManager.handle(
    'game:get-memory-masonry-items',
    async (_, gameId: string, memoryIds: string[]) => {
      const entries = await Promise.all(
        memoryIds.map(async (memoryId) => {
          try {
            const imageBuffer = await GameDBManager.getGameMemoryImage(gameId, memoryId, 'buffer')
            if (!imageBuffer) return null

            const metadata = await sharp(imageBuffer).metadata()
            if (!metadata.width || !metadata.height) return null

            return [
              memoryId,
              {
                heightRatio: metadata.height / metadata.width
              }
            ] as const
          } catch {
            return null
          }
        })
      )

      return Object.fromEntries(entries.filter((entry) => entry !== null))
    }
  )

  ipcManager.handle('game:get-media-path', async (_, gameId: string, type: GameMediaType) => {
    return await GameDBManager.getGameImage(gameId, type, 'file')
  })

  ipcManager.handle('game:remove-media', async (_, gameId: string, type: GameMediaType) => {
    return await GameDBManager.removeGameImage(gameId, type)
  })

  ipcManager.handle('game:upscale-background', async (_, gameId: string) => {
    await upscaleGameBackground(gameId)
  })

  ipcManager.handle('game:check-exits-by-path', async (_, gamePath: string) => {
    return await GameDBManager.checkGameExitsByPath(gamePath)
  })

  ipcManager.handle('game:calculate-storage-size', async (_, gameId: string) => {
    return await calculateStorageSize(gameId)
  })

  ipcManager.handle('game:batch-calculate-storage-size', async (_, gameIds: string[]) => {
    return await batchCalculateStorageSize(gameIds)
  })

  ipcManager.handle('game:cancel-batch-storage-size-calculation', async () => {
    cancelBatchStorageSizeCalculation()
  })

  ipcManager.handle('game:is-batch-storage-size-calculation-running', async () => {
    return isBatchStorageSizeCalculationRunning()
  })

  ipcManager.handle('game:recalculate-last-run-date', async (_, gameId: string) => {
    return await recalculateLastRunDate(gameId)
  })

  ipcManager.handle('game:hide-from-recent-games', async (_, gameId: string) => {
    await hideGameFromRecentGames(gameId)
  })
}
