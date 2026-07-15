export interface Category {
  id: string
  name: string
}

/** 'each' = priced per unit; 'kg' = weighed (price is per kilogram) */
export type ProductUnit = 'each' | 'kg'

export interface Product {
  id: string
  name: string
  /** unit price, or price per kg for weighed products */
  price: number
  categoryId: string
  active: boolean
  unit: ProductUnit
  /**
   * Scannable code. Either a full product barcode (EAN-13/EAN-8/other), or a
   * 7-digit in-store prefix starting with "2" for weight-embedded scale labels.
   */
  barcode?: string
}

export interface Room {
  id: string
  name: string
}

/** footprint shape of a table on the floor plan */
export type TableShape = 'square' | 'round' | 'rect'

export interface Table {
  id: string
  roomId: string
  name: string
  seats: number
  // --- floor-plan placement, in grid cells (Épico A) ---
  x: number
  y: number
  w: number
  h: number
  shape: TableShape
  /** ad-hoc table created mid-service (F2-R30); removed when its bill closes */
  extra?: boolean
  /** set on sub-tables created by dividing a table (F2-R31) */
  parentTableId?: string
  /** a divided parent stays hidden until its sub-tables are rejoined */
  hidden?: boolean
}

/** non-interactive floor-plan elements for orientation (F2-R2) */
export type DecorKind = 'counter' | 'door' | 'wall' | 'plant'

export interface Decor {
  id: string
  roomId: string
  kind: DecorKind
  x: number
  y: number
  w: number
  h: number
}

export interface OrderItem {
  id: string
  productId: string
  name: string
  unitPrice: number
  /** units, or kilograms when unit === 'kg' (fractional) */
  qty: number
  unit: ProductUnit
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
  /** who is serving this order (web accounts, or unset on the desktop build) */
  employeeId?: string
  employeeName?: string
}

export type PayMethod = 'cash' | 'card'

export interface SaleLine {
  productId: string
  name: string
  qty: number
  unitPrice: number
  unit?: ProductUnit
}

export interface Sale {
  id: string
  at: number
  total: number
  method: PayMethod
  lines: SaleLine[]
  employeeId?: string
  employeeName?: string
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
  | 'salesByEmployee'

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
