import { describe, expect, it } from 'vitest'
import { ean13CheckDigit, fmtQty, isValidEan13, lineText, resolveScan, ScanBuffer } from '../barcode'
import type { Product } from '../types'

const water: Product = {
  id: 'w',
  name: 'Sparkling water',
  price: 1.5,
  categoryId: 'c',
  active: true,
  unit: 'each',
  barcode: '5601312111111',
}
const fruit: Product = {
  id: 'f',
  name: 'Fruit salad',
  price: 8.9,
  categoryId: 'c',
  active: true,
  unit: 'kg',
  barcode: '2000001',
}
const inactive: Product = { ...water, id: 'x', barcode: '999999', active: false }
const products = [water, fruit, inactive]

describe('EAN-13 validation', () => {
  it('computes known check digits', () => {
    // 4006381333931 is the canonical EAN-13 example
    expect(ean13CheckDigit('400638133393')).toBe(1)
    expect(isValidEan13('4006381333931')).toBe(true)
  })

  it('rejects wrong check digits and malformed codes', () => {
    expect(isValidEan13('4006381333932')).toBe(false)
    expect(isValidEan13('40063813339')).toBe(false)
    expect(isValidEan13('400638133393a')).toBe(false)
    expect(isValidEan13('')).toBe(false)
  })
})

describe('resolveScan', () => {
  it('matches a plain product barcode → one unit', () => {
    const res = resolveScan('5601312111111', products)
    expect(res).not.toBeNull()
    expect(res!.product.id).toBe('w')
    expect(res!.qty).toBe(1)
    expect(res!.needsWeight).toBe(false)
  })

  it('ignores inactive products', () => {
    expect(resolveScan('999999', products)).toBeNull()
  })

  it('returns null for unknown codes', () => {
    expect(resolveScan('1234567890128', products)).toBeNull()
    expect(resolveScan('', products)).toBeNull()
  })

  it('parses weight-embedded in-store labels (2 + ref + grams + check)', () => {
    // prefix 2000001, weight 00485 g → build valid EAN-13
    const first12 = '200000100485'
    const code = first12 + ean13CheckDigit(first12)
    const res = resolveScan(code, products)
    expect(res).not.toBeNull()
    expect(res!.product.id).toBe('f')
    expect(res!.qty).toBeCloseTo(0.485)
    expect(res!.needsWeight).toBe(false)
  })

  it('rejects weight labels with a bad check digit', () => {
    const first12 = '200000100485'
    const bad = first12 + ((ean13CheckDigit(first12) + 1) % 10)
    expect(resolveScan(bad, products)).toBeNull()
  })

  it('scanning a per-kg product by its plain code asks for a weight', () => {
    const res = resolveScan('2000001', products)
    expect(res).not.toBeNull()
    expect(res!.needsWeight).toBe(true)
    expect(res!.qty).toBe(0)
  })
})

describe('ScanBuffer (keyboard-wedge accumulator)', () => {
  function feed(buffer: ScanBuffer, code: string, gap: number, clock: { t: number }) {
    for (const ch of code) {
      clock.t += gap
      buffer.key(ch)
    }
    clock.t += gap
    return buffer.key('Enter')
  }

  it('captures a fast scanner burst ending in Enter', () => {
    const scans: string[] = []
    const clock = { t: 0 }
    const sb = new ScanBuffer((c) => scans.push(c), () => clock.t)
    const consumed = feed(sb, '5601312111111', 10, clock)
    expect(consumed).toBe(true)
    expect(scans).toEqual(['5601312111111'])
  })

  it('ignores human-speed typing (gaps above threshold)', () => {
    const scans: string[] = []
    const clock = { t: 0 }
    const sb = new ScanBuffer((c) => scans.push(c), () => clock.t)
    feed(sb, '5601312111111', 200, clock)
    expect(scans).toEqual([])
  })

  it('ignores short bursts below the minimum length', () => {
    const scans: string[] = []
    const clock = { t: 0 }
    const sb = new ScanBuffer((c) => scans.push(c), () => clock.t)
    feed(sb, '12', 10, clock)
    expect(scans).toEqual([])
  })

  it('resets on non-scan keys', () => {
    const scans: string[] = []
    const clock = { t: 0 }
    const sb = new ScanBuffer((c) => scans.push(c), () => clock.t)
    clock.t += 10
    sb.key('1')
    clock.t += 10
    sb.key('Shift') // breaks the burst
    clock.t += 10
    sb.key('2')
    clock.t += 10
    sb.key('Enter')
    expect(scans).toEqual([])
  })
})

describe('quantity formatting', () => {
  it('formats units and weights', () => {
    expect(fmtQty(2, 'each')).toBe('2')
    expect(fmtQty(0.485, 'kg')).toBe('0.485 kg')
    expect(fmtQty(1.5, 'kg')).toBe('1.5 kg')
    expect(fmtQty(2, 'kg')).toBe('2 kg')
    expect(fmtQty(3, undefined)).toBe('3')
  })

  it('builds line labels', () => {
    expect(lineText(2, 'each', 'Latte')).toBe('2× Latte')
    expect(lineText(0.485, 'kg', 'Fruit salad')).toBe('Fruit salad 0.485 kg')
    expect(lineText(1, undefined, 'Espresso')).toBe('1× Espresso')
  })
})
