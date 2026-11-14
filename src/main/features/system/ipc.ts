import { generateUUID } from '@appUtils'
import { app, OpenDialogOptions } from 'electron'
import { ConfigDBManager, GameDBManager } from '~/core/database'
import { ipcManager } from '~/core/ipc'
import {
  changeForegroundWaitTime,
  disableForegroundHook,
  enableForegroundHook,
  setupNativeMonitor,
  stopNativeMonitor
} from '~/features/monitor'
import { AUTO_UPDATE_ENABLED } from '~/features/updater'
import { mainWindow } from '~/index'
import {
  checkAdminPermissions,
  checkIfDirectoryNeedsAdminRights,
  cropImage,
  downloadTempImage,
  getAppVersion,
  getTotalPathSize,
  openDatabasePathInExplorer,
  openPathInExplorer,
  readFileBuffer,
  writeTextFile,
  saveClipboardImage,
  selectMultiplePathDialog,
  selectPathDialog
} from '~/utils'
import {
  checkIfPathExist,
  copyAppLogInCurrentLifetimeToClipboardAsFile,
  createGameShortcut,
  getAppLogContentsInCurrentLifetime,
  getAppRootPath,
  getLanguage,
  getSystemFonts,
  openLogPathInExplorer,
  portableStore,
  switchDatabaseMode,
  testUpscalerAvailability,
  updateLanguage,
  updateOpenAtLogin,
  updateScreenshotHotkey
} from './services'

export function setupSystemIPC(): void {
  ipcManager.on('window:minimize', () => {
    mainWindow.minimize()
  })

  ipcManager.on('window:quit-to-tray', () => {
    mainWindow.hide()
  })

  ipcManager.on('window:restore-and-focus', () => {
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  })

  ipcManager.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcManager.on('window:close', () => {
    mainWindow.close()
  })

  ipcManager.on('app:relaunch-app', () => {
    app.relaunch()
    app.exit()
  })

  ipcManager.handle('utils:generate-uuid', () => {
    return generateUUID()
  })

  ipcManager.handle('utils:get-app-log-contents-in-current-lifetime', async () => {
    return await getAppLogContentsInCurrentLifetime()
  })

  ipcManager.handle('utils:copy-app-log-in-current-lifetime-to-clipboard-as-file', async () => {
    await copyAppLogInCurrentLifetimeToClipboardAsFile()
  })

  ipcManager.handle('utils:open-log-path-in-explorer', async () => {
    await openLogPathInExplorer()
  })

  ipcManager.handle(
    'system:select-path-dialog',
    async (
      _,
      properties: NonNullable<OpenDialogOptions['properties']>,
      extensions?: string[],
      defaultPath?: string
    ) => {
      return await selectPathDialog(properties, extensions, defaultPath)
    }
  )

  ipcManager.handle(
    'system:select-multiple-path-dialog',
    async (
      _,
      properties: NonNullable<OpenDialogOptions['properties']>,
      extensions?: string[],
      defaultPath?: string
    ) => {
      return await selectMultiplePathDialog(properties, extensions, defaultPath)
    }
  )

  ipcManager.handle('system:get-fonts', async () => {
    return await getSystemFonts()
  })

  ipcManager.handle('system:get-path-size', async (_, paths: string[]): Promise<number> => {
    return await getTotalPathSize(paths)
  })

  ipcManager.handle('system:open-path-in-explorer', async (_, filePath: string) => {
    await openPathInExplorer(filePath)
  })

  ipcManager.handle('system:path-exists', async (_, targetPath: string): Promise<boolean> => {
    const { existsSync } = await import('node:fs')
    return Boolean(targetPath) && existsSync(targetPath)
  })

  // 从主进程直接读本地库，逐游戏检查 rootPath 是否存在（比渲染层读取更可靠）
  ipcManager.handle(
    'system:check-game-paths',
    async (
      _,
      gameIds: string[]
    ): Promise<Record<string, { hasPath: boolean; exists: boolean }>> => {
      const { existsSync } = await import('node:fs')
      const result: Record<string, { hasPath: boolean; exists: boolean }> = {}

      for (const gameId of gameIds) {
        try {
          const rootPath = await GameDBManager.getGameLocalValue(gameId, 'utils.rootPath')
          if (!rootPath) {
            result[gameId] = { hasPath: false, exists: false }
            continue
          }
          result[gameId] = { hasPath: true, exists: existsSync(rootPath) }
        } catch {
          result[gameId] = { hasPath: false, exists: false }
        }
      }
      return result
    }
  )

  ipcManager.handle(
    'system:paths-exist',
    async (_, paths: string[]): Promise<Record<string, boolean>> => {
      const { existsSync } = await import('node:fs')
      const result: Record<string, boolean> = {}
      for (const p of paths) {
        if (!p) continue
        result[p] = existsSync(p)
      }
      return result
    }
  )

  ipcManager.handle('utils:open-database-path-in-explorer', async () => {
    await openDatabasePathInExplorer()
  })

  ipcManager.handle('utils:create-game-shortcut', async (_, gameId: string, targetPath: string) => {
    await createGameShortcut(gameId, targetPath)
  })

  ipcManager.handle('utils:update-open-at-login', async () => {
    await updateOpenAtLogin()
  })

  ipcManager.handle('app:get-app-version', async () => {
    return getAppVersion()
  })

  ipcManager.handle('app:is-portable-mode', async () => {
    return portableStore.isPortableMode
  })

  ipcManager.handle('app:is-updater-enabled', async () => {
    return AUTO_UPDATE_ENABLED
  })

  ipcManager.handle('app:switch-database-mode', async () => {
    return await switchDatabaseMode()
  })

  ipcManager.handle('system:read-file-buffer', async (_, filePath: string) => {
    return await readFileBuffer(filePath)
  })

  ipcManager.handle(
    'system:write-text-file',
    async (_, filePath: string, content: string): Promise<void> => {
      await writeTextFile(filePath, content)
    }
  )

  ipcManager.handle('system:get-language', async () => {
    return getLanguage()
  })

  ipcManager.handle('system:check-admin-permissions', async () => {
    return await checkAdminPermissions()
  })

  ipcManager.handle('system:check-if-portable-directory-needs-admin-rights', async () => {
    return await checkIfDirectoryNeedsAdminRights(getAppRootPath())
  })

  ipcManager.handle('system:check-if-path-exist', async (_, paths: string[]) => {
    return await checkIfPathExist(paths)
  })

  ipcManager.handle('app:update-language', async (_, language: string) => {
    await updateLanguage(language)
  })

  ipcManager.handle(
    'utils:crop-image',
    async (
      _,
      {
        sourcePath,
        x,
        y,
        width,
        height
      }: {
        sourcePath: string
        x: number
        y: number
        width: number
        height: number
      }
    ) => {
      return await cropImage({ sourcePath, x, y, width, height })
    }
  )

  ipcManager.handle('utils:download-temp-image', async (_, url: string) => {
    return await downloadTempImage(url)
  })

  ipcManager.handle('utils:test-upscaler', async () => {
    await testUpscalerAvailability()
  })

  ipcManager.handle('utils:save-clipboard-image', async () => {
    return await saveClipboardImage()
  })

  ipcManager.handle('system:update-screenshot-hotkey', (_, hotkeyName, hotkey) => {
    return updateScreenshotHotkey(hotkeyName, hotkey)
  })

  ipcManager.on('system:change-process-monitor', async (_, monitor: 'new' | 'legacy') => {
    if (monitor === 'new') {
      await setupNativeMonitor()
    } else if (monitor === 'legacy') {
      await stopNativeMonitor()
      await ConfigDBManager.setConfigValue('general.enableForegroundTimer', false)
      await disableForegroundHook()
    }
  })

  ipcManager.on('system:change-foreground-timer', async (_, isEnabled: boolean) => {
    if (isEnabled) {
      await enableForegroundHook()
    } else {
      await disableForegroundHook()
    }
  })

  ipcManager.on('system:change-foreground-timer-wait-time', async (_, waitTime: number) => {
    changeForegroundWaitTime(waitTime)
  })
}
