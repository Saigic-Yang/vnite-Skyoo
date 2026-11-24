export const jsonOnlyReportTypes = ['gamePlayTime'] as const
export const visualReportTypes = ['scoreReport'] as const
export type JsonOnlyReportType = (typeof jsonOnlyReportTypes)[number]
export type VisualReportType = (typeof visualReportTypes)[number]
export type ReportType = VisualReportType | JsonOnlyReportType

type VisualReportExportArtifact = {
  format: 'html'
  html: string
}

type JsonReportExportArtifact = {
  format: 'json'
  json: string
}

export type ReportExportRequest = ReportExportOptions['common'] &
  (
    | ({ reportType: VisualReportType } & VisualReportExportArtifact)
    // 游玩时间报告既支持 JSON，也支持可视化 HTML
    | ({ reportType: JsonOnlyReportType } & (JsonReportExportArtifact | VisualReportExportArtifact))
  )

export interface ReportExportResponse {
  outputFile: string
}

export type ReportExportFormat = ReportExportRequest['format']

export interface ReportExportOptions {
  common: {
    outputPath: string
  }
  reports: {
    scoreReport: {
      variant: 'A' | 'B'
      coverWidth: number
      theme: 'current' | 'light' | 'dark'
      showScore: boolean
    }
  }
}

export const defaultReportExportOptions: ReportExportOptions = {
  common: {
    outputPath: ''
  },
  reports: {
    scoreReport: {
      variant: 'A',
      coverWidth: 120,
      theme: 'current',
      showScore: true
    }
  }
}
