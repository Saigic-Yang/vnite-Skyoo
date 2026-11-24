import { NSFWFilterMode } from '@appTypes/models'
import { type ReportExportResponse } from '@appTypes/report'
import { type GamePlayTimeReportItem } from '@appTypes/report/gamePlayTime'
import { Button } from '@ui/button'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ipcManager } from '~/app/ipc'
import { useConfigState } from '~/hooks'
import { getGameStore, useGameCollectionStore, useNSFWFilteredGameIds } from '~/stores/game'
import { EmptyReportConfigForm } from '../settings'
import type { ReportGeneratorProps } from '../types'
import { exportJsonReport, formatReportGeneratedAt } from '../utils'

function createReportItem(name: string, playTimeMs: number): GamePlayTimeReportItem {
  return {
    name,
    playTimeMs,
    playTimeHours: Math.round((playTimeMs / 3600000) * 10) / 10
  }
}

interface PlayTimeReport {
  generatedAt: string
  nsfwFilter: string
  games: GamePlayTimeReportItem[]
  collections: GamePlayTimeReportItem[]
}

async function buildReport(
  includedGameIds: readonly string[],
  nsfwFilterMode: NSFWFilterMode
): Promise<PlayTimeReport> {
  const generatedAt = new Date()
  const includedGames = new Map<string, GamePlayTimeReportItem>()

  for (const gameId of new Set(includedGameIds)) {
    const game = getGameStore(gameId).getState().getData()
    if (!game) continue

    const playTimeMs = Number.isFinite(game.record.playTime) ? game.record.playTime : 0
    includedGames.set(gameId, createReportItem(game.metadata.name, playTimeMs))
  }

  const gameItems = Array.from(includedGames.values()).sort(
    (a, b) => b.playTimeMs - a.playTimeMs || a.name.localeCompare(b.name)
  )

  const collectionItems = Object.values(useGameCollectionStore.getState().documents)
    .sort((a, b) => a.sort - b.sort)
    .map((collection) => {
      let playTimeMs = 0

      for (const gameId of new Set(collection.games)) {
        playTimeMs += includedGames.get(gameId)?.playTimeMs ?? 0
      }

      return createReportItem(collection.name, playTimeMs)
    })

  return {
    generatedAt: formatReportGeneratedAt(generatedAt),
    nsfwFilter:
      nsfwFilterMode === NSFWFilterMode.HideNSFW
        ? 'SFW'
        : nsfwFilterMode === NSFWFilterMode.OnlyNSFW
          ? 'NSFW'
          : 'ALL',
    games: gameItems,
    collections: collectionItems
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 生成可交互的可视化 HTML（离线单文件，双击即可打开） */
function buildHtml(report: PlayTimeReport): string {
  const totalMs = report.games.reduce((sum, item) => sum + item.playTimeMs, 0)
  const totalHours = (totalMs / 3600000).toFixed(1)
  const maxMs = report.games.reduce((max, item) => Math.max(max, item.playTimeMs), 0) || 1

  const row = (item: GamePlayTimeReportItem): string => {
    const percent = Math.max((item.playTimeMs / maxMs) * 100, 0.5)
    return `<tr data-ms="${item.playTimeMs}" data-name="${escapeHtml(item.name)}">
      <td class="name">${escapeHtml(item.name)}</td>
      <td class="bar"><div class="track"><div class="fill" style="width:${percent.toFixed(2)}%"></div></div></td>
      <td class="hours">${item.playTimeHours.toFixed(1)} h</td>
    </tr>`
  }

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>游玩时间报告 · Skyoo</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 40px 64px;
    background: radial-gradient(1200px 600px at 20% -10%, #1d2a3a, #0d1117 60%);
    color: #e6edf3; font: 14px/1.6 "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
  }
  h1 { font-size: 24px; margin: 0 0 6px; }
  .meta { color: #8b98a5; font-size: 12px; margin-bottom: 24px; }
  .cards { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }
  .card {
    flex: 1 1 180px; padding: 16px 18px; border-radius: 12px;
    background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
  }
  .card .label { color: #8b98a5; font-size: 12px; }
  .card .value { font-size: 26px; font-weight: 700; margin-top: 4px; }
  .toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
  input[type=search] {
    flex: 0 0 260px; padding: 8px 12px; border-radius: 8px;
    background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); color: inherit;
    outline: none;
  }
  input[type=search]:focus { border-color: #58a6ff; }
  .hint { color: #8b98a5; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid rgba(255,255,255,.06); }
  th { color: #8b98a5; font-weight: 600; font-size: 12px; cursor: pointer; user-select: none; white-space: nowrap; }
  th:hover { color: #e6edf3; }
  td.name { width: 42%; max-width: 460px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  td.bar { width: 46%; }
  .track { height: 8px; border-radius: 999px; background: rgba(255,255,255,.07); overflow: hidden; }
  .fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #2f81f7, #56d364); }
  td.hours { text-align: right; width: 120px; font-variant-numeric: tabular-nums; color: #9fd0ff; }
  h2 { font-size: 16px; margin: 34px 0 10px; }
</style>
</head>
<body>
  <h1>游玩时间报告</h1>
  <div class="meta">生成时间：${escapeHtml(report.generatedAt)} · 内容过滤：${report.nsfwFilter} · 共 ${report.games.length} 款游戏</div>

  <div class="cards">
    <div class="card"><div class="label">总游玩时间</div><div class="value">${totalHours} h</div></div>
    <div class="card"><div class="label">游戏数量</div><div class="value">${report.games.length}</div></div>
    <div class="card"><div class="label">平均每款</div><div class="value">${
      report.games.length ? (totalMs / 3600000 / report.games.length).toFixed(1) : '0'
    } h</div></div>
  </div>

  <div class="toolbar">
    <input id="q" type="search" placeholder="搜索游戏名…" />
    <span class="hint">点击表头可按时长 / 名称排序</span>
  </div>

  <table id="games">
    <thead>
      <tr><th data-sort="name">游戏</th><th data-sort="ms">占比</th><th data-sort="ms">游玩时间</th></tr>
    </thead>
    <tbody>
      ${report.games.map(row).join('\n      ')}
    </tbody>
  </table>

  ${
    report.collections.length > 0
      ? `<h2>按收藏汇总</h2>
  <table>
    <thead><tr><th>收藏</th><th></th><th style="text-align:right">游玩时间</th></tr></thead>
    <tbody>
      ${report.collections
        .map(
          (item) => `<tr>
        <td class="name">${escapeHtml(item.name)}</td>
        <td class="bar"><div class="track"><div class="fill" style="width:${Math.max(
          (item.playTimeMs / maxMs) * 100,
          0.5
        ).toFixed(2)}%"></div></div></td>
        <td class="hours">${item.playTimeHours.toFixed(1)} h</td>
      </tr>`
        )
        .join('\n      ')}
    </tbody>
  </table>`
      : ''
  }

<script>
  const tbody = document.querySelector('#games tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  let sortKey = 'ms';
  let asc = false;

  document.querySelectorAll('#games th').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      asc = key === sortKey ? !asc : false;
      sortKey = key;
      const sorted = rows.slice().sort((a, b) => {
        const va = key === 'name' ? a.dataset.name : Number(a.dataset.ms);
        const vb = key === 'name' ? b.dataset.name : Number(b.dataset.ms);
        const cmp = key === 'name' ? String(va).localeCompare(String(vb)) : va - vb;
        return asc ? cmp : -cmp;
      });
      sorted.forEach((tr) => tbody.appendChild(tr));
    });
  });

  document.getElementById('q').addEventListener('input', (event) => {
    const keyword = event.target.value.trim().toLowerCase();
    rows.forEach((tr) => {
      tr.style.display = tr.dataset.name.toLowerCase().includes(keyword) ? '' : 'none';
    });
  });
</script>
</body>
</html>
`
}

async function exportGamePlayTimeHtml(
  outputPath: string,
  includedGameIds: readonly string[],
  nsfwFilterMode: NSFWFilterMode
): Promise<ReportExportResponse> {
  const report = await buildReport(includedGameIds, nsfwFilterMode)
  return await ipcManager.invoke('report:export', {
    reportType: 'gamePlayTime',
    format: 'html',
    outputPath,
    html: buildHtml(report)
  })
}

export function GamePlayTimeReportGenerator({
  outputPath,
  isExporting,
  resolveOutputPath,
  onExportingChange
}: ReportGeneratorProps): React.JSX.Element {
  const { t } = useTranslation('record')
  const filteredGameIds = useNSFWFilteredGameIds()
  const [nsfwFilterMode] = useConfigState('appearances.nsfwFilterMode')

  const runExport = async (format: 'json' | 'html'): Promise<void> => {
    if (isExporting) return

    const resolvedOutputPath = outputPath || (await resolveOutputPath())
    if (!resolvedOutputPath) return

    onExportingChange(true)
    const exportPromise = (
      format === 'json'
        ? buildReport(filteredGameIds, nsfwFilterMode).then((report) =>
            exportJsonReport('gamePlayTime', resolvedOutputPath, report)
          )
        : exportGamePlayTimeHtml(resolvedOutputPath, filteredGameIds, nsfwFilterMode)
    ).finally(() => onExportingChange(false))

    toast.promise(exportPromise, {
      loading: '正在导出报告…',
      success: (result) => t('exportReport.message.success', { file: result.outputFile }),
      error: (error) =>
        `${t('exportReport.message.error')}: ${error instanceof Error ? error.message : String(error)}`
    })
  }

  return (
    <>
      <div className="flex justify-end ml-4 gap-2">
        <Button disabled={isExporting} variant="secondary" onClick={() => void runExport('json')}>
          {t('exportReport.action.exportJson')}
        </Button>
        <Button disabled={isExporting} onClick={() => void runExport('html')}>
          导出 HTML（可视化）
        </Button>
      </div>
      <div className="col-span-2">
        <EmptyReportConfigForm />
      </div>
    </>
  )
}
