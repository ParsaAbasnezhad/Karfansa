export type AnalysisCategory = {
  slug: string
  name: string
  description: string
  report_count: number
}

export type AnalysisAuthor = {
  full_name: string
  position: string
  biography: string
  profile_image: string | null
  report_count: number
}

export type AnalysisAttachment = {
  id: string
  original_filename: string
  file_type: string
  file_size: number
  download_url: string
}

export type AnalysisReport = {
  id: string
  slug: string
  title: string
  short_description: string
  cover_image: string | null
  category: AnalysisCategory | null
  report_type: string
  author: AnalysisAuthor | null
  published_at: string
  is_featured: boolean
  view_count: number
  download_count: number
  reading_minutes: number
}

export type AnalysisReportDetail = AnalysisReport & {
  content: string
  seo_title: string
  seo_description: string
  attachments: AnalysisAttachment[]
}

export type AnalysisPage = {
  items: AnalysisReport[]
  count: number
  page: number
  page_size: number
  total_pages: number
}

export type AnalysisDetailResponse = {
  report: AnalysisReportDetail
  related: AnalysisReport[]
}
