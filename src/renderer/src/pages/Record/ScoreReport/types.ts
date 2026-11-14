export type ScoreReportView = 'compact' | 'detailed'

export interface ScoreCategoryData {
  id: string
  title: string
  description: string
  minScore: number
  maxScore: number
  className: string
  /** 标题文字颜色 */
  titleClass?: string
  /** Steam 式总评（好评如潮 / 褒贬不一 …） */
  verdict?: string
  games: string[]
}

export interface ScoreReportViewProps {
  categories: ScoreCategoryData[]
}
