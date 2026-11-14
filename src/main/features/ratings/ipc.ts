import { ipcManager } from '~/core/ipc'
import { refreshGameRatings } from './services'

export function setupRatingsIPC(): void {
  ipcManager.handle('ratings:refresh', async (_, gameId: string) => {
    return await refreshGameRatings(gameId)
  })
}
