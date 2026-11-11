import { autoUpdater } from 'electron-updater'
import log from 'electron-log/main'
import { AUTO_UPDATE_ENABLED, updateUpdater } from './services'
import { ipcManager } from '~/core/ipc'

const DISABLED_MESSAGE = 'Auto update is disabled in this build'

export function setupUpdaterIPC(): void {
  ipcManager.handle('updater:check-update', async () => {
    if (!AUTO_UPDATE_ENABLED) {
      throw new Error(DISABLED_MESSAGE)
    }
    return await autoUpdater.checkForUpdates()
  })

  ipcManager.handle('updater:start-update', async () => {
    if (!AUTO_UPDATE_ENABLED) {
      throw new Error(DISABLED_MESSAGE)
    }
    try {
      return await autoUpdater.downloadUpdate()
    } catch (error) {
      log.error('[AppUpdater] Failed to download update:', error)
      throw error
    }
  })

  ipcManager.handle('updater:install-update', async () => {
    if (!AUTO_UPDATE_ENABLED) {
      return
    }
    autoUpdater.quitAndInstall(false, true)
  })

  // Add handler for updating auto-updater configuration
  ipcManager.handle('updater:update-config', async () => {
    if (!AUTO_UPDATE_ENABLED) {
      return
    }
    try {
      await updateUpdater()
    } catch (error) {
      log.error('[AppUpdater] Failed to update auto-updater configuration:', error)
      throw error
    }
  })
}
