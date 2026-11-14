import { gameDoc } from '@appTypes/models'

export const PLAY_STATUS_ICONS: Record<gameDoc['record']['playStatus'], string> = {
  unplayed: 'icon-[mdi--bookmark-outline]',
  playing: 'icon-[mdi--map-marker-path]',
  // playing: 'icon-[mdi--progress-clock]',
  partial: 'icon-[mdi--progress-check]',
  finished: 'icon-[mdi--check-circle-outline]',
  multiple: 'icon-[mdi--check-decagram-outline]',
  deleted: 'icon-[mdi--delete-outline]',
  shelved: 'icon-[mdi--archive-outline]'
}

/** 与状态颜色一致的「色条」样式（用于列表标题前的斜杠） */
export const PLAY_STATUS_BAR_COLORS: Record<gameDoc['record']['playStatus'], string> = {
  unplayed: 'bg-zinc-400',
  playing: 'bg-sky-400',
  partial: 'bg-sky-400',
  finished: 'bg-emerald-400',
  multiple: 'bg-emerald-400',
  deleted: 'bg-red-400',
  shelved: 'bg-amber-400'
}

export const PLAY_STATUS_COLORS: Record<gameDoc['record']['playStatus'], string> = {
  // 未开始：灰
  unplayed: 'text-zinc-400',
  // 游玩中 / 部分完成：浅蓝
  playing: 'text-sky-400',
  partial: 'text-sky-400',
  // 已完成 / 多周目：绿
  finished: 'text-emerald-400',
  multiple: 'text-emerald-400',
  // 已删除：红
  deleted: 'text-red-400',
  // 搁置中：黄
  shelved: 'text-amber-400'
}
