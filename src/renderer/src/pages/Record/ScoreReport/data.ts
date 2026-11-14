import type { TFunction } from 'i18next'
import type { GameMetaInfo } from '~/stores/game'
import type { ScoreCategoryData } from './types'

/** 评分为 1~10 的整数，按需求分成 6 组，每组标题使用不同颜色 */
const SCORE_CATEGORIES = [
  {
    id: 'score1',
    minScore: 1,
    maxScore: 1,
    className: 'border-destructive',
    titleClass: 'text-red-700 dark:text-red-500'
  },
  {
    id: 'score23',
    minScore: 2,
    maxScore: 3,
    className: 'border-destructive/70',
    titleClass: 'text-amber-800 dark:text-amber-600'
  },
  {
    id: 'score45',
    minScore: 4,
    maxScore: 5,
    className: 'border-muted',
    titleClass: 'text-yellow-600 dark:text-yellow-400'
  },
  {
    id: 'score67',
    minScore: 6,
    maxScore: 7,
    className: 'border-accent',
    titleClass: 'text-blue-600 dark:text-blue-400'
  },
  {
    id: 'score89',
    minScore: 8,
    maxScore: 9,
    className: 'border-secondary',
    titleClass: 'text-sky-500 dark:text-sky-400'
  },
  {
    id: 'score10',
    minScore: 10,
    maxScore: 10,
    className: 'border-primary',
    titleClass: 'text-emerald-600 dark:text-emerald-400'
  }
] as const

export function createScoreReportCategories(
  t: TFunction<'record'>,
  gameIds: readonly string[],
  gameMetaIndex: Record<string, GameMetaInfo>
): ScoreCategoryData[] {
  return SCORE_CATEGORIES.map((category) => {
    const games = gameIds
      .filter((gameId) => {
        const score = gameMetaIndex[gameId]?.score
        if (typeof score !== 'number' || score < 0) return false
        return score >= category.minScore && score <= category.maxScore
      })
      .sort((a, b) => {
        const scoreA = gameMetaIndex[a]?.score ?? -1
        const scoreB = gameMetaIndex[b]?.score ?? -1
        return scoreB - scoreA
      })

    return {
      ...category,
      title: t(`score.categories.${category.id}.title`),
      description: t(`score.categories.${category.id}.description`),
      verdict: t(`score.verdicts.${category.id}`),
      games
    }
  })
}
