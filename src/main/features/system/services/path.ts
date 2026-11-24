import { app } from 'electron'
import log from 'electron-log/main'
import fse from 'fs-extra'
import os from 'os'
import path from 'path'
import { portableStore } from './portable'

export function getAppRootPath(): string {
  try {
    if (app.isPackaged) {
      return path.dirname(app.getPath('exe'))
    } else {
      return app.getAppPath()
    }
  } catch (error) {
    log.error('[System] Failed to get app root path:', error)
    throw error
  }
}

export function getDataPath(file = ''): string {
  try {
    const basePath = portableStore.isPortableMode
      ? path.join(getAppRootPath(), 'app/database')
      : path.join(app.getPath('userData'), 'app/database')

    return path.join(basePath, file)
  } catch (error) {
    log.error('[System] Failed to get data path:', error)
    throw error
  }
}

export function getLogsPath(): string {
  try {
    const basePath = portableStore.isPortableMode
      ? path.join(getAppRootPath(), 'logs')
      : app.getPath('logs')
    return path.join(basePath, 'app.log')
  } catch (error) {
    log.error('[System] Failed to get logs path:', error)
    throw error
  }
}

export function getPluginPath(): string {
  try {
    const basePath = portableStore.isPortableMode
      ? path.join(getAppRootPath(), 'app/plugins')
      : path.join(app.getPath('userData'), 'app/plugins')
    return basePath
  } catch (error) {
    log.error('[System] Failed to get plugin path:', error)
    throw error
  }
}

export function getAppTempPath(file?: string): string {
  try {
    // Use electron's app.getPath('temp') to get the system temp directory.
    // If the app is not accessible in the main process, use os.tmpdir()
    const tempDir = app?.getPath?.('temp') || os.tmpdir()

    // Creating application-specific temporary directory paths
    const appTempDir = path.join(tempDir, 'skyoo', file || '')

    return appTempDir
  } catch (error) {
    log.error('[System] Failed to get app temp path:', error)
    throw error
  }
}

/** 存档备份目录：<数据目录>/save data/<gameId>（即 SkyooData\save data） */
export function getSaveDataPath(gameId?: string): string {
  const base = portableStore.isPortableMode
    ? path.join(getAppRootPath(), 'app')
    : path.join(app.getPath('userData'), 'app')
  return path.join(base, 'save data', gameId || '')
}

/** 持久导出目录（备份/图片导出到这里，不会被临时清理） */
export function getAppExportPath(file?: string): string {
  const base = path.join(app.getPath('userData'), 'exports', file || '')
  return base
}

/** 清理临时目录里超过 maxAgeDays 天的残留（应用启动时执行一次） */
export async function cleanupOldTempFiles(maxAgeDays = 7): Promise<number> {
  const tempPath = getAppTempPath()
  let removed = 0
  try {
    if (!(await fse.pathExists(tempPath))) return 0
    const entries = await fse.readdir(tempPath)
    const deadline = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    for (const name of entries) {
      const full = path.join(tempPath, name)
      try {
        const stat = await fse.stat(full)
        if (stat.mtimeMs < deadline) {
          await fse.remove(full)
          removed++
        }
      } catch {
        // 单个条目清理失败不影响其它
      }
    }
    if (removed > 0) log.info(`[System] Cleaned ${removed} stale temp entries`)
  } catch (error) {
    log.error('[System] Failed to clean stale temp files:', error)
  }
  return removed
}

export async function setupTempDirectory(): Promise<string> {
  try {
    const tempPath = getAppTempPath()

    // Ensure that the temporary directory exists
    await fse.ensureDir(tempPath)

    // 启动时清理 7 天前的残留（应用每次启动都会跑，避免临时目录越积越多）
    void cleanupOldTempFiles(7)

    // Clean up the temporary directory when the app exits
    app.on('quit', async () => {
      try {
        await fse.remove(tempPath)
        log.info('[System] Temporary directory cleared')
      } catch (error) {
        log.error('[System] Failed to clean up temporary directory:', error)
      }
    })

    log.info('[System] Temporary directory is set:', tempPath)
    return tempPath
  } catch (error) {
    log.error('[System] Failed to set up temporary directory:', error)
    throw error
  }
}

export async function checkIfPathExist(paths: string[]): Promise<boolean[]> {
  try {
    if (!Array.isArray(paths)) throw new TypeError('paths must be an array of strings')

    const results = await Promise.all(paths.map(async (path) => await fse.pathExists(path)))

    return results
  } catch (error) {
    log.error('[System] Failed to check path exist:', error)
    throw error
  }
}
