import { isEqual } from 'lodash'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ui/dialog'
import { Input } from '@ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/tooltip'
import type { SaveCandidateInfo } from '@appTypes/ipc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/table'
import { ipcManager } from '~/app/ipc'
import { useGameLocalState, useGameState } from '~/hooks'
import { cn } from '~/utils'
import { useGameDetailStore } from '../store'

/** 路径渲染：最后一级目录用黄色高亮，便于快速定位 */
function renderPath(path: string): React.ReactNode {
  const index = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  if (index < 0) return <span className="text-yellow-400 font-medium">{path}</span>
  return (
    <>
      <span>{path.slice(0, index + 1)}</span>
      <span className="text-yellow-400 font-medium">{path.slice(index + 1)}</span>
    </>
  )
}

export function Save({ gameId }: { gameId: string }): React.JSX.Element {
  const { t } = useTranslation('game')
  const [saveList, setSaveList, saveSaveList, setSaveListAndSave] = useGameState(
    gameId,
    'save.saveList',
    true
  )

  const openPropertiesDialog = useGameDetailStore((state) => state.openPropertiesDialog)

  const [savePaths, setSavePaths] = useGameLocalState(gameId, 'path.savePaths')
  const [isBackingUp, setIsBackingUp] = useState(false)
  const hasSavePath = savePaths.some(Boolean)

  // 备份大小：自动补算 + 手动刷新
  const [refreshingSize, setRefreshingSize] = useState(false)

  async function refreshSaveSizes(silent = false): Promise<void> {
    if (refreshingSize) return
    setRefreshingSize(true)
    try {
      const sizes = await ipcManager.invoke('game:refresh-save-sizes', gameId)
      const entries = Object.entries(sizes)
      if (entries.length > 0) {
        const next = { ...saveList }
        for (const [saveId, sizeMB] of entries) {
          if (next[saveId]) next[saveId] = { ...next[saveId], sizeMB }
        }
        setSaveList(next)
      }
      if (!silent) toast.success('已重新计算备份大小')
    } catch (error) {
      if (!silent) toast.error(`计算失败：${(error as Error).message}`)
    } finally {
      setRefreshingSize(false)
    }
  }

  // 有历史备份缺少大小（老数据）时自动算一次
  useEffect(() => {
    const missing = Object.values(saveList).some((item) => item.sizeMB == null)
    if (missing) void refreshSaveSizes(true)
  }, [saveList])

  // 智能检测存档位置
  const [detectOpen, setDetectOpen] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [candidates, setCandidates] = useState<SaveCandidateInfo[]>([])

  // 关键词搜索（C 盘 / Everything）
  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SaveCandidateInfo[]>([])
  const [searchHint, setSearchHint] = useState('')

  // 网络搜索（PCGamingWiki）
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [onlineResults, setOnlineResults] = useState<
    { source: string; title: string; url: string; paths: string[] }[]
  >([])
  const [onlineHint, setOnlineHint] = useState('')
  const [onlineIsError, setOnlineIsError] = useState(false)
  const [onlineLinks, setOnlineLinks] = useState<
    { source: string; title: string; url: string }[]
  >([])

  async function runOnlineSearch(): Promise<void> {
    if (onlineLoading) return
    // 每次点击都强制重新联网：先清空上一次的状态，给出刷新反馈
    setOnlineLoading(true)
    setOnlineIsError(false)
    setOnlineResults([])
    setOnlineLinks([])
    setOnlineHint('正在联网重新搜索…')
    try {
      const result = await ipcManager.invoke('saves:search-online', gameId)
      setOnlineResults(result.results)
      setOnlineLinks(result.links)
      setOnlineHint(result.message)
      setOnlineIsError(result.status === 'network')
    } catch (error) {
      setOnlineIsError(true)
      setOnlineHint(`网络搜索请求失败：${(error as Error).message}`)
    } finally {
      setOnlineLoading(false)
    }
  }

  async function runKeywordSearch(): Promise<void> {
    const value = keyword.trim()
    if (!value || searching) return
    setSearching(true)
    setSearchHint('正在搜索…')
    try {
      const result = await ipcManager.invoke('saves:search-by-keyword', gameId, value)
      setSearchResults(result.candidates)
      setSearchHint(
        result.candidates.length === 0
          ? `未找到与「${value}」相关的存档目录`
          : `找到 ${result.candidates.length} 个（${
              result.engine === 'everything' ? 'Everything' : '本地扫描'
            }，${result.elapsedMs} ms）`
      )
    } catch (error) {
      toast.error(`搜索失败：${(error as Error).message}`)
    } finally {
      setSearching(false)
    }
  }

  // 合并去重后统一按分数降序（高置信度必须在最上面）
  const displayCandidates = [...candidates, ...searchResults]
    .filter(
      (item, index, arr) =>
        arr.findIndex((other) => other.path.toLowerCase() === item.path.toLowerCase()) === index
    )
    .sort((a, b) => b.score - a.score)

  async function runDetect(forceReindex = false): Promise<void> {
    setDetecting(true)
    try {
      const result = await ipcManager.invoke('saves:detect', gameId, forceReindex)
      setCandidates(result.candidates)
    } catch (error) {
      toast.error(`检测失败：${(error as Error).message}`)
    } finally {
      setDetecting(false)
    }
  }

  /** 追加一个存档路径（支持多个） */
  async function applyPath(path: string): Promise<void> {
    if (savePaths.includes(path)) return
    const next = [...savePaths, path]
    try {
      setSavePaths(next)
      await ipcManager.invoke('saves:set-paths', gameId, next)
      toast.success('已添加为存档路径')
    } catch (error) {
      toast.error(`保存失败：${(error as Error).message}`)
    }
  }

  /** 取消某条存档路径（再点一次绿勾） */
  async function removePath(path: string): Promise<void> {
    const next = savePaths.filter((item) => item !== path)
    try {
      setSavePaths(next)
      await ipcManager.invoke('saves:set-paths', gameId, next)
      toast.success('已取消该存档路径')
    } catch (error) {
      toast.error(`取消失败：${(error as Error).message}`)
    }
  }

  function backupGameSave(): void {
    if (isBackingUp) {
      return
    }

    if (!hasSavePath) {
      toast.error(t('detail.save.notifications.noSavePath'))
      return
    }

    setIsBackingUp(true)

    const backupPromise = ipcManager
      .invoke('game:backup-save', gameId)
      .finally(() => setIsBackingUp(false))

    toast.promise(backupPromise, {
      loading: t('detail.save.notifications.backupLoading'),
      success: t('detail.save.notifications.backupSuccess'),
      error: (err) => t('detail.save.notifications.backupError', { message: err.message })
    })
  }

  function restoreGameSave(saveId: string): void {
    if (!hasSavePath) {
      toast.error(t('detail.save.notifications.noSavePath'))
      return
    }
    toast.promise(ipcManager.invoke('game:restore-save', gameId, saveId), {
      loading: t('detail.save.notifications.switchLoading'),
      success: t('detail.save.notifications.switchSuccess'),
      error: (err) => t('detail.save.notifications.switchError', { message: err.message })
    })
  }

  function deleteGameSave(saveId: string): void {
    if (saveList[saveId]?.locked) {
      toast(t('detail.save.notifications.locked'), { duration: 1000 })
      return
    }
    toast.promise(
      (async (): Promise<void> => {
        await ipcManager.invoke('game:delete-save', gameId, saveId)
        const newSaveList = { ...saveList }
        delete newSaveList[saveId]
        setSaveList(newSaveList)
      })(),
      {
        loading: t('detail.save.notifications.deleteLoading'),
        success: t('detail.save.notifications.deleteSuccess'),
        error: (err) => t('detail.save.notifications.deleteError', { message: err.message })
      }
    )
  }

  const toggleLock = (saveId: string): void => {
    const newSaveList = {
      ...saveList,
      [saveId]: {
        ...saveList[saveId],
        locked: !saveList[saveId]?.locked
      }
    }
    setSaveListAndSave(newSaveList)
  }

  return (
    <div className="pt-2 bg-transparent w-full min-h-[22vh]">
      <div className="mb-4">
        <div className="flex flex-wrap gap-3">
          <Button size="icon" onClick={backupGameSave} disabled={isBackingUp}>
            <span className={cn('icon-[mdi--backup-restore] w-4 h-4')}></span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => openPropertiesDialog('path')}
            disabled={isBackingUp}
          >
            {t('detail.save.openPropertiesDialog')}
          </Button>
          <Button
            variant="secondary"
            disabled={detecting}
            onClick={() => {
              setDetectOpen(true)
              void runDetect()
            }}
          >
            <span className={cn('icon-[mdi--auto-fix] w-4 h-4 mr-1')}></span>
            {detecting ? '检测中…' : '智能检测存档位置'}
          </Button>
          {/* 直接打开游戏自己的存档目录（不是备份目录） */}
          <Button
            variant="secondary"
            disabled={!savePaths.some(Boolean)}
            title={savePaths.find(Boolean) || '未设置存档路径'}
            onClick={() => {
              const path = savePaths.find(Boolean)
              if (path) void ipcManager.invoke('system:open-path-in-explorer', path)
            }}
          >
            <span className={cn('icon-[mdi--folder-open-outline] w-4 h-4 mr-1')}></span>
            一键打开本地存档
          </Button>
        </div>
      </div>

      <Dialog open={detectOpen} onOpenChange={setDetectOpen}>
        <DialogContent className="w-[min(96vw,1060px)] max-w-none">
          <DialogHeader>
            <DialogTitle>智能检测存档位置</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[65vh] overflow-y-auto pr-1">
            {/* 关键词搜索：在 C 盘按名称找存档目录（装了 Everything 会秒出） */}
            <div className="flex items-center gap-2">
              <Input
                value={keyword}
                placeholder="输入游戏名或关键词，在 C 盘搜索存档目录…"
                className="h-8"
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runKeywordSearch()
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                disabled={searching || !keyword.trim()}
                onClick={() => void runKeywordSearch()}
              >
                {searching ? '搜索中…' : '在 C 盘搜索'}
              </Button>
              <Button
                variant="thirdary"
                size="sm"
                className="shrink-0"
                disabled={onlineLoading}
                title="从 PCGamingWiki 等网站查询该游戏的存档位置"
                onClick={() => void runOnlineSearch()}
              >
                {onlineLoading ? '搜索中…' : '网络搜索'}
              </Button>
            </div>
            {searchHint && <div className="text-xs text-muted-foreground">{searchHint}</div>}
            {onlineHint && (
              <div
                className={cn(
                  'text-xs',
                  onlineIsError ? 'text-red-400' : 'text-muted-foreground'
                )}
              >
                {onlineHint}
              </div>
            )}

            {/* 其它来源链接（点击用系统浏览器打开） */}
            {onlineLinks.length > 0 && (
              <div className="flex flex-col gap-1 text-xs">
                <div className="text-muted-foreground">其它参考来源（点击打开浏览器）：</div>
                {onlineLinks.map((link) => (
                  <button
                    key={link.url}
                    type="button"
                    className="text-left text-primary break-all hover:underline"
                    onClick={() => void ipcManager.invoke('system:open-external', link.url)}
                  >
                    [{link.source}] {link.title}
                  </button>
                ))}
              </div>
            )}

            {onlineResults.length > 0 && (
              <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2 text-xs">
                {onlineResults.map((item) => (
                  <div key={item.url} className="flex flex-col gap-1">
                    <div className="text-muted-foreground">
                      {item.source} · {item.title}
                    </div>
                    {item.paths.map((onlinePath) => (
                      <div key={onlinePath} className="flex items-center gap-2">
                        <span className="flex-1 break-all select-text">{onlinePath}</span>
                        <Button
                          variant="thirdary"
                          size="sm"
                          className="shrink-0"
                          onClick={() =>
                            void navigator.clipboard.writeText(onlinePath).then(() => {
                              toast.success('路径已复制，请到资源管理器核对')
                            })
                          }
                        >
                          复制
                        </Button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="thirdary" size="sm" disabled={detecting} onClick={() => void runDetect(true)}>
                重新扫描
              </Button>
            </div>
            {displayCandidates.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                没有找到疑似存档目录，可用上面的搜索框按名字再找一次，或「属性 → 路径」手动指定。
              </div>
            ) : (
              displayCandidates.map((item) => (
                <div
                  key={item.path}
                  className="flex items-start gap-2 rounded-md border border-border p-2 text-xs cursor-pointer hover:border-primary"
                  onClick={() => void applyPath(item.path)}
                >
                  <Badge
                    className={cn(
                      'shrink-0',
                      item.confidence === 'high'
                        ? 'bg-emerald-600 text-white'
                        : item.confidence === 'medium'
                          ? 'bg-amber-600 text-white'
                          : 'bg-zinc-500 text-white'
                    )}
                  >
                    {item.confidence === 'high' ? '高' : item.confidence === 'medium' ? '中' : '低'}
                  </Badge>
                  {savePaths.includes(item.path) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="shrink-0 text-emerald-500 hover:text-emerald-400"
                          onClick={(event) => {
                            event.stopPropagation()
                            void removePath(item.path)
                          }}
                        >
                          <span className={cn('icon-[mdi--check-circle] w-4 h-4 block')} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">已选择此路径作为存档路径（点击可取消）</TooltipContent>
                    </Tooltip>
                  )}
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="break-all select-text">{renderPath(item.path)}</span>
                    <span className="text-muted-foreground">
                      {item.saveFileCount} 个存档文件 · {item.sizeMB} MB ·{' '}
                      {item.reasons.join(' / ')}
                    </span>
                  </div>
                  <div className="ml-auto shrink-0 flex flex-col gap-1">
                    <Button
                      variant="thirdary"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        void ipcManager.invoke('system:open-path-in-explorer', item.path)
                      }}
                    >
                      打开本地文件
                    </Button>
                    <Button
                      variant="thirdary"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        void navigator.clipboard.writeText(item.path).then(() => {
                          toast.success('路径已复制到剪贴板')
                        })
                      }}
                    >
                      复制路径
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      <div className="w-full h-full">
        <div className={cn('h-full')}>
          <Table className="h-full">
            <TableHeader>
              <TableRow className={cn('')}>
                <TableHead className={cn('w-1/5')}>{t('detail.save.table.date')}</TableHead>
                <TableHead className={cn('w-[90px]')}>
                  <div className="flex items-center gap-1">
                    <span>大小</span>
                    <button
                      type="button"
                      title="重新计算所有备份大小"
                      disabled={refreshingSize}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => void refreshSaveSizes()}
                    >
                      <span
                        className={cn(
                          'block h-3.5 w-3.5',
                          refreshingSize
                            ? 'icon-[mdi--loading] animate-spin'
                            : 'icon-[mdi--refresh]'
                        )}
                      />
                    </button>
                  </div>
                </TableHead>
                <TableHead className={cn('w-2/5', 'sm:w-1/3')}>
                  {t('detail.save.table.note')}
                </TableHead>
                <TableHead className={cn('w-1/6')}>{t('detail.save.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={cn('h-full')}>
              {isEqual(saveList, {}) ? (
                <div className={cn('mt-1')}>{t('detail.save.empty')}</div>
              ) : (
                Object.entries(saveList)
                  .sort(([, a], [, b]) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(([saveId, save]) => (
                    <TableRow key={saveId}>
                      <TableCell className={cn('w-1/5')}>
                        <div>{t('{{date, niceDateSeconds}}', { date: save.date })}</div>
                      </TableCell>
                      <TableCell className={cn('w-[90px] text-xs text-muted-foreground')}>
                        {save.sizeMB != null ? `${save.sizeMB} MB` : '—'}
                      </TableCell>
                      <TableCell className={cn('pr-10', '3xl:pr-24')}>
                        <Input
                          value={save.note}
                          disabled={isBackingUp}
                          onChange={(e) =>
                            setSaveList({
                              ...saveList,
                              [saveId]: { ...save, note: e.target.value }
                            })
                          }
                          onBlur={saveSaveList}
                          className={cn('h-8')}
                        />
                      </TableCell>
                      <TableCell className={cn('w-1/6')}>
                        <div className="flex flex-row gap-2">
                          <Button
                            variant={'outline'}
                            size={'icon'}
                            className={cn('h-8 w-8', saveList[saveId]?.locked ? 'border-ring' : '')}
                            disabled={isBackingUp}
                            onClick={() => toggleLock(saveId)}
                          >
                            <span
                              className={cn(
                                'w-5 h-5',
                                saveList[saveId]?.locked
                                  ? 'icon-[mdi--lock-outline]'
                                  : 'icon-[mdi--lock-open-variant-outline]'
                              )}
                            />
                          </Button>
                          <Button
                            variant={'outline'}
                            className={cn('min-h-0 h-8')}
                            disabled={isBackingUp}
                            onClick={() => restoreGameSave(saveId)}
                          >
                            {t('detail.save.actions.switch')}
                          </Button>
                          <Button
                            variant="delete"
                            className={cn('min-h-0 h-8 ')}
                            disabled={isBackingUp}
                            onClick={() => deleteGameSave(saveId)}
                          >
                            {t('detail.save.actions.delete')}
                          </Button>
                          <Button
                            variant={'outline'}
                            size={'icon'}
                            className={cn('h-8 w-8')}
                            disabled={isBackingUp}
                            title="打开本地文件"
                            onClick={() =>
                              void ipcManager.invoke('saves:show-backup', gameId, saveId)
                            }
                          >
                            <span className={cn('icon-[mdi--folder-open-outline] w-5 h-5')} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
