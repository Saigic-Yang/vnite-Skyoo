import { Paths } from 'type-fest'

export type GameMediaType = 'cover' | 'background' | 'icon' | 'logo' | 'wideCover'

export type GameMemoryViewMode = 'grid' | 'full' | 'masonry' | 'list'

export type GameSortField =
  | 'metadata.name'
  | 'metadata.sortName'
  | 'metadata.developers'
  | 'metadata.releaseDate'
  | 'record.lastRunDate'
  | 'record.addDate'
  | 'record.playTime'
  | 'record.score'
  | 'record.storageSize'
  | 'record.playStatus'

export const GAME_SORT_FIELDS: readonly GameSortField[] = [
  'metadata.name',
  'metadata.sortName',
  'metadata.developers',
  'metadata.releaseDate',
  'record.lastRunDate',
  'record.addDate',
  'record.playTime',
  'record.score',
  'record.storageSize',
  'record.playStatus'
]

export type gameDocs = {
  [gameId: string]: gameDoc
}

export interface gameDoc {
  _id: string
  metadata: {
    name: string
    originalName: string
    sortName: string
    releaseDate: string
    description: string
    developers: string[]
    publishers: string[]
    platforms: string[]
    genres: string[]
    tags: string[]
    relatedSites: {
      label: string
      url: string
    }[]
    steamId: string
    vndbId: string
    igdbId: string
    ymgalId: string
    extra: {
      key: string
      value: string[]
    }[]
  }
  record: {
    addDate: string
    lastRunDate: string
    score: number
    playTime: number
    playStatus:
      | 'unplayed'
      | 'playing'
      | 'partial'
      | 'finished'
      | 'multiple'
      | 'shelved'
      | 'deleted'
    hideFromRecentGames: boolean
    timers: {
      start: string
      end: string
    }[]
    dailyPlayTimes: {
      date: string
      playTime: number
    }[]
    storageSize: number
  }
  save: {
    saveList: {
      [saveId: string]: {
        _id: string
        date: string
        note: string
        locked: boolean
        /** 磁盘上的备份文件（用于「打开本地文件」，老数据可能没有） */
        filePath?: string
        /** 该备份的大小（MB），老数据可能没有 */
        sizeMB?: number
      }
    }
    maxBackups: number
    autoBackupSave: boolean
    autoRestoreSave: boolean
  }
  memory: {
    preferences: {
      viewMode: GameMemoryViewMode | null
    }
    memoryList: {
      [memoryId: string]: {
        _id: string
        date: string
        note: string
        pinned?: boolean
      }
    }
  }
  apperance: {
    logo: {
      position: {
        x: number
        y: number
      }
      size: number
      visible: boolean
    }
    nsfw: boolean
  }
  /** 评分聚合：入库时抓取一次，可手动刷新（Skyoo 新增） */
  ratings?: GameRatings
}

export interface GameSteamRatingRow {
  /** 评价文案，如「特别好评」 */
  summary: string
  /** 好评率（0-100） */
  percent: number
  /** 评测数 */
  total: number
}

export interface GameSteamRating extends GameSteamRatingRow {
  /** 商店页链接 */
  url: string
  /** 最近 30 天评测 */
  recent?: GameSteamRatingRow
  /** 简体中文评测 */
  chinese?: GameSteamRatingRow
}

export interface GameSourceRating {
  score: number
  url?: string
  updatedAt?: string
}

export interface GameRatings {
  steam?: GameSteamRating
  metacritic?: GameSourceRating
  opencritic?: GameSourceRating & { percentRecommended?: number; reviewCount?: number }
  howlongtobeat?: {
    main?: number
    mainExtra?: number
    completionist?: number
    url?: string
    updatedAt?: string
  }
  /** 各站的「本作详情页」直链（抓取时解析，解析不到则前端退回站内搜索） */
  links?: {
    metacritic?: string
    opencritic?: string
  }
  updatedAt?: string
}

export interface gameCollectionDocs {
  [gameCollectionId: string]: gameCollectionDoc
}

export interface gameCollectionDoc {
  _id: string
  name: string
  sort: number
  sortBy: GameSortField | 'custom'
  sortOrder: 'asc' | 'desc'
  secondarySort: {
    by: GameSortField
    order: 'asc' | 'desc'
  } | null
  games: string[]
}

export interface gameLocalDocs {
  [gameId: string]: gameLocalDoc
}

export interface gameLocalDoc {
  _id: string
  path: {
    gamePath: string
    savePaths: string[]
    screenshotPath?: string
  }
  launcher: {
    mode: 'file' | 'url' | 'script'
    fileConfig: {
      path: string
      args: string[]
      monitorMode: 'file' | 'folder' | 'process'
      monitorPath: string
    }
    urlConfig: {
      url: string
      browserPath: string
      monitorMode: 'file' | 'folder' | 'process'
      monitorPath: string
    }
    scriptConfig: {
      workingDirectory: string
      command: string[]
      monitorMode: 'file' | 'folder' | 'process'
      monitorPath: string
    }
    useMagpie: boolean
  }
  utils: {
    markPath: string
    rootPath: string
  }
}

export const DEFAULT_GAME_LOCAL_VALUES: Readonly<gameLocalDoc> = {
  _id: '',
  path: {
    gamePath: '',
    savePaths: [],
    screenshotPath: ''
  },
  launcher: {
    mode: 'file',
    fileConfig: {
      path: '',
      args: [],
      monitorMode: 'folder',
      monitorPath: ''
    },
    urlConfig: {
      url: '',
      browserPath: '',
      monitorMode: 'folder',
      monitorPath: ''
    },
    scriptConfig: {
      workingDirectory: '',
      command: [],
      monitorMode: 'folder',
      monitorPath: ''
    },
    useMagpie: false
  },
  utils: {
    markPath: '',
    rootPath: ''
  }
} as const

export const DEFAULT_GAME_COLLECTION_VALUES: Readonly<gameCollectionDoc> = {
  _id: '',
  name: '',
  sort: 0,
  sortBy: 'custom',
  sortOrder: 'asc',
  secondarySort: null,
  games: []
} as const

/**
 * Storage size value indicating the size has not been calculated yet
 */
export const STORAGE_SIZE_NOT_CALCULATED = -1

export const DEFAULT_GAME_VALUES: Readonly<gameDoc> = {
  _id: '',
  metadata: {
    name: '',
    originalName: '',
    sortName: '',
    releaseDate: '',
    description: '',
    developers: [] as string[],
    publishers: [] as string[],
    platforms: [] as string[],
    genres: [] as string[],
    tags: [] as string[],
    relatedSites: [] as { label: string; url: string }[],
    steamId: '',
    vndbId: '',
    igdbId: '',
    ymgalId: '',
    extra: [] as { key: string; value: string[] }[]
  },
  record: {
    addDate: '',
    lastRunDate: '',
    score: -1,
    playTime: 0,
    playStatus: 'unplayed',
    hideFromRecentGames: false,
    timers: [],
    dailyPlayTimes: [],
    storageSize: STORAGE_SIZE_NOT_CALCULATED
  },
  save: {
    saveList: {},
    maxBackups: 7,
    autoBackupSave: false,
    autoRestoreSave: false
  },
  memory: {
    preferences: {
      viewMode: null
    },
    memoryList: {}
  },
  apperance: {
    logo: {
      position: {
        x: 1.5,
        y: 35
      },
      size: 100,
      visible: true
    },
    nsfw: false
  }
} as const

export interface SortConfig {
  by: Paths<gameDoc, { bracketNotation: true }>
  order?: 'asc' | 'desc'
}

export interface Timer {
  start: string
  end: string
}

export interface DailyPlayTime {
  date: string
  playTime: number
}

export interface MaxPlayTimeDay {
  date: string
  playTime: number
}

export const DEFAULT_PLAY_STATUS_ORDER: gameDoc['record']['playStatus'][] = [
  'unplayed',
  'playing',
  'partial',
  'finished',
  'multiple',
  'deleted',
  'shelved'
]

export const METADATA_EXTRA_PREDEFINED_KEYS = [
  'director',
  'scenario',
  'illustration',
  'music',
  'voice',
  'engine'
]

export interface BatchGameInfo {
  dataId: string
  dataSource: string
  name: string
  id: string
  status: 'idle' | 'loading' | 'success' | 'error' | 'existed'
  dirPath: string
}

export enum TimerStatus {
  Resumed,
  Paused
}

export interface GameTimerStatus {
  name: string
  status: TimerStatus
}
