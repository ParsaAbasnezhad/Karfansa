export const TICKET_CATEGORIES = [
  { value: 'technical', label: 'پشتیبانی فنی' },
  { value: 'business', label: 'همکاری تجاری' },
  { value: 'company', label: 'ثبت شرکت' },
  { value: 'ads', label: 'تبلیغات' },
  { value: 'feedback', label: 'پیشنهاد و انتقاد' },
  { value: 'other', label: 'سایر موارد' },
] as const

export type TicketCategory = (typeof TICKET_CATEGORIES)[number]['value']
export type TicketStatus = 'open' | 'in_progress' | 'waiting_for_user' | 'answered' | 'closed'

export type TicketMessage = {
  id: string
  sender_type: 'user' | 'staff' | 'system'
  sender_type_display: string
  sender_label: string
  message: string
  attachment_url: string | null
  attachment_name: string | null
  created_at: string
}

export type TicketListItem = {
  id: string
  ticket_number: string
  subject: string
  category: string
  category_display: string
  priority: string
  status: TicketStatus
  status_display: string
  last_message_excerpt: string
  last_message_at: string | null
  created_at: string
  updated_at: string
  has_unread: boolean
  is_closed: boolean
}

export type TicketDetail = TicketListItem & {
  contact_name: string
  contact_email: string
  contact_phone: string
  source: string
  closed_at: string | null
  access_token?: string | null
  messages: TicketMessage[]
}

export type TicketSummary = {
  total: number
  open: number
  waiting_for_user: number
  answered: number
  unread: number
}

export type TicketPage = {
  results: TicketListItem[]
  count: number
  page: number
  page_size: number
  total_pages: number
  summary: TicketSummary
}

export type TicketCreated = {
  ticket_number: string
  access_token: string | null
  message: string
}

export const emptySummary: TicketSummary = {
  total: 0,
  open: 0,
  waiting_for_user: 0,
  answered: 0,
  unread: 0,
}
