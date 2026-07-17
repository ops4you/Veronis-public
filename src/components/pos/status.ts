import type { OrderStatus } from '../../lib/types'

/** shared table/order status visuals for the Service views */
export const STATUS_STYLE: Record<OrderStatus, { tile: string; chip: string }> = {
  open: { tile: 'border-amber-400 bg-amber-50', chip: 'bg-amber-100 text-amber-800' },
  sent: { tile: 'border-blue-400 bg-blue-50', chip: 'bg-blue-100 text-blue-800' },
  ready: { tile: 'border-green-500 bg-green-50', chip: 'bg-green-100 text-green-800' },
  served: { tile: 'border-violet-400 bg-violet-50', chip: 'bg-violet-100 text-violet-800' },
}

export const STATUS_KEY: Record<OrderStatus, string> = {
  open: 'pos.takingOrder',
  sent: 'pos.inKitchen',
  ready: 'pos.readyToServe',
  served: 'pos.awaitingBill',
}
