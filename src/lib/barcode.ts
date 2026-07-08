import type { Product } from './types'

/**
 * Barcode support for grocery-style checkout.
 *
 * Two flows are covered:
 *  1. Plain product barcodes (EAN-13/EAN-8 or any code stored on the product):
 *     scan → add 1 unit (or ask for weight when the product is priced per kg).
 *  2. In-store weight-embedded EAN-13 labels, the standard supermarket flow:
 *     a label scale at the produce section prints `2 IIIIII WWWWW C` —
 *     prefix 2, six-digit item reference, weight in grams, check digit.
 *     The till only needs to scan; no scale integration required.
 */

export function ean13CheckDigit(first12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = first12.charCodeAt(i) - 48
    sum += i % 2 === 0 ? d : d * 3
  }
  return (10 - (sum % 10)) % 10
}

export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false
  return ean13CheckDigit(code.slice(0, 12)) === Number(code[12])
}

export interface ScanResult {
  product: Product
  /** quantity to add: units, or kilograms for per-kg products */
  qty: number
  /** true when the scan identifies the product but the till must ask for a weight */
  needsWeight: boolean
}

export function resolveScan(rawCode: string, products: Product[]): ScanResult | null {
  const code = rawCode.trim()
  if (code.length < 4) return null
  const active = products.filter((p) => p.active && p.barcode)

  // In-store weight-embedded label: 2 + item ref (6) + grams (5) + check digit
  if (isValidEan13(code) && code.startsWith('2')) {
    const prefix = code.slice(0, 7)
    const byPrefix = active.find((p) => p.barcode === prefix)
    if (byPrefix) {
      const grams = Number(code.slice(7, 12))
      const qty = byPrefix.unit === 'kg' ? Math.round(grams) / 1000 : 1
      if (qty > 0) return { product: byPrefix, qty, needsWeight: false }
    }
  }

  // Plain barcode match
  const exact = active.find((p) => p.barcode === code)
  if (!exact) return null
  if (exact.unit === 'kg') return { product: exact, qty: 0, needsWeight: true }
  return { product: exact, qty: 1, needsWeight: false }
}

/**
 * Keyboard-wedge accumulator. USB scanners act as keyboards: they "type" the
 * code very fast and finish with Enter. Humans type slower than the gap
 * threshold, so ordinary typing never triggers a scan.
 */
export class ScanBuffer {
  private buffer = ''
  private lastAt = 0

  constructor(
    private readonly onScan: (code: string) => void,
    private readonly now: () => number = () => Date.now(),
    private readonly maxGapMs = 80,
    private readonly minLength = 4,
  ) {}

  /** Feed one key. Returns true when the key was consumed as part of a scan. */
  key(key: string): boolean {
    const t = this.now()
    if (t - this.lastAt > this.maxGapMs) this.buffer = ''
    this.lastAt = t

    if (key === 'Enter') {
      if (this.buffer.length >= this.minLength) {
        const code = this.buffer
        this.buffer = ''
        this.onScan(code)
        return true
      }
      this.buffer = ''
      return false
    }
    if (/^[0-9A-Za-z\-_.]$/.test(key)) {
      this.buffer += key
      return false
    }
    this.buffer = ''
    return false
  }
}

/** Human-friendly quantity: "2" for units, "0.485 kg" for weighed items. */
export function fmtQty(qty: number, unit: 'each' | 'kg' | undefined): string {
  if (unit === 'kg') return `${qty.toFixed(3).replace(/\.?0+$/, '')} kg`
  return String(qty)
}

/** One-line label for a sale/ticket line: "2× Latte" or "Fruit salad 0.485 kg". */
export function lineText(qty: number, unit: 'each' | 'kg' | undefined, name: string): string {
  return unit === 'kg' ? `${name} ${fmtQty(qty, 'kg')}` : `${qty}× ${name}`
}
