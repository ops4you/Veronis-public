export interface Category {
  id: string
  name: string
}

export interface Product {
  id: string
  name: string
  price: number
  categoryId: string
  active: boolean
}

export interface Room {
  id: string
  name: string
}

export interface Table {
  id: string
  roomId: string
  name: string
  seats: number
}

export interface OrderItem {
  id: string
  productId: string
  name: string
  unitPrice: number
  qty: number
  note?: string
}

/**
 * open   – order being taken at the table
 * sent   – ticket is in the kitchen
 * ready  – kitchen finished, waiting to be served
 * served – delivered, waiting for the bill
 */
export type OrderStatus = 'open' | 'sent' | 'ready' | 'served'

export interface Order {
  id: string
  tableId: string | null // null = counter / takeaway sale
  items: OrderItem[]
  status: OrderStatus
  createdAt: number
  sentAt?: number
  readyAt?: number
}

export type PayMethod = 'cash' | 'card'

export interface SaleLine {
  productId: string
  name: string
  qty: number
  unitPrice: number
}

export interface Sale {
  id: string
  at: number
  total: number
  method: PayMethod
  lines: SaleLine[]
}

export interface Expense {
  id: string
  label: string
  amount: number
  category: string
  at: number
}

export type WidgetType =
  | 'income'
  | 'expenses'
  | 'profit'
  | 'orders'
  | 'avgTicket'
  | 'salesByDay'
  | 'topProducts'
  | 'categoryMix'
  | 'paymentMix'
  | 'deadHours'
  | 'recentSales'

export type AccentKey =
  | 'blue'
  | 'teal'
  | 'amber'
  | 'green'
  | 'violet'
  | 'red'
  | 'magenta'
  | 'orange'

export interface Widget {
  id: string
  type: WidgetType
  /** columns spanned on the dashboard grid (of 4) */
  size: 1 | 2
  accent: AccentKey
}

export interface OpeningHours {
  /** 0 = Sunday … 6 = Saturday */
  openDays: number[]
  openHour: number
  closeHour: number
}

export interface BusinessSettings {
  businessName: string
  currency: string
  opening: OpeningHours
}

export type Period = 'today' | '7d' | '30d' | '90d'
